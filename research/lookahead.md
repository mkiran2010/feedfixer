# Lookahead / pre-scoring research

**Goal:** filter junk Shorts *before* the user sees them, so the visible auto-skip jump goes away.

## How the YouTube Shorts feed loads (verified 2026-05)

- The page renders one `ytd-reel-video-renderer` per reel.
- The currently-playing reel has the `[is-active]` attribute.
- Adjacent siblings (next 1–3 in the queue) are already in the DOM with their videoIds reachable via inner anchors:
  ```js
  document.querySelector('ytd-reel-video-renderer[is-active]')
    ?.nextElementSibling
    ?.querySelector('a[href*="/shorts/"]')
    ?.getAttribute('href')
  ```
- More reels are appended on scroll via XHR to `/youtubei/v1/reel/reel_item_watch`.

## What this gives us

We can read the next videoIds *before* the user reaches them, score them in the background, and silently skip past any "Junk" verdicts the moment they become active. Zero visible jump.

## Concrete implementation plan

This builds on the current `locality` branch shape (`ReelWatcher` polling URL + per-reel SW message round-trips).

### 1. Verdict cache in SW session storage

Add a `verdictCache: Record<videoId, Verdict>` to `chrome.storage.session`. Keyed by videoId, value is `"Junk" | "Stay"`. Cleared on browser restart. Bounded to last 200 entries (rolling) to avoid quota issues.

```ts
async function getCachedVerdict(videoId: string): Promise<Verdict | null>;
async function setCachedVerdict(videoId: string, v: Verdict): Promise<void>;
```

### 2. Lookahead trigger in content script

In `shorts.ts`, after a reel becomes active and is scored, also extract the next 1–2 videoIds from sibling `ytd-reel-video-renderer` elements and fire `score-reel` for each in the background. They populate the cache.

```ts
function readQueueIds(active: Element, count = 2): string[] {
  const out: string[] = [];
  let cur = active.nextElementSibling;
  while (out.length < count && cur) {
    const href = cur.querySelector('a[href*="/shorts/"]')?.getAttribute('href');
    const m = href?.match(/\/shorts\/([\w-]{11})/);
    if (m) out.push(m[1]);
    cur = cur.nextElementSibling;
  }
  return out;
}
```

### 3. Cache-first scoring in SW

`handleScoreReel` checks the cache first. If hit, return immediately (no API call). If miss, run the normal flow and cache the result.

```ts
async function handleScoreReel(videoId: string): Promise<ScoredReel> {
  const cached = await getCachedVerdict(videoId);
  if (cached) return { videoId, verdict: cached, reason: 'cached', scoredAt: Date.now() };
  // ... existing flow ...
  await setCachedVerdict(videoId, result.verdict);
}
```

### 4. Instant skip on cached Junk

When a new reel becomes active, the watcher already calls `score-reel`. With the cache in place, that call returns *immediately* with the prior verdict. Auto-skip fires with no perceptible delay.

## What this DOES NOT solve

- The very first reel of any session is unavoidably scored on arrival (no lookahead possible — nothing came before).
- If the user scrolls fast enough to outrun the lookahead workers, they may see uncached junk reels briefly.
- The Shorts feed is infinite; we only get lookahead for reels YouTube has already loaded into the DOM, not the entire infinite tail.
- The Chrome AI `LanguageModel.create()` call is the slowest piece (~300–800ms with model warmup). Even with lookahead, scoring throughput is bounded by sequential session creation. Possible mitigation: `LanguageModel.clone()` from a single template — but only worth the complexity if we measure that throughput is the actual bottleneck.

## Harder alternative: rewrite the feed JSON

`chrome.webRequest` can observe the `/youtubei/v1/reel/...` response body, but MV3 removed the ability to *modify* response bodies. `declarativeNetRequest` can only block, not rewrite. So filtering the queue at the network layer would require:

- A v2 manifest (deprecated)
- Or injecting a script into the page that monkey-patches `fetch`/`XMLHttpRequest` to intercept the response, score the reels, and rewrite the array before YouTube parses it (fragile across YouTube updates)

Not recommended. DOM-sibling lookahead gives 90% of the perceived improvement with 10% of the code.

## Sequencing

If we ship lookahead, do it in this order:

1. Add the cache (no behavior change, just storage primitive)
2. Add cache-first lookup in `handleScoreReel` (no behavior change yet, cache always misses)
3. Add lookahead trigger in `shorts.ts` (cache starts populating)
4. Verify: SW console logs "cache hit" for second-and-later reels in a row
5. Measure: timing comparison of "reel becomes active → skip fires" before vs after

Each step is independently committable and reversible.

## Conclusion

Lookahead via DOM-sibling scoring is the right v2 of the locality branch — once the user has had a chance to use the current single-reel scoring and identify what feels bad about it. Network-layer rewriting is a v4 problem, if ever.
