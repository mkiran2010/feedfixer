# Lookahead / pre-scoring research

**Goal:** filter junk Shorts *before* the user sees them, so the visible auto-skip jump goes away.

## How the YouTube Shorts feed loads

- The page renders one `ytd-reel-video-renderer` element per reel.
- The currently-playing reel has `[is-active]`. Its siblings are the queue.
- YouTube preloads ~2–3 reels ahead of the active one, so the next videoIds are already in the DOM as `<a href="/shorts/..."` anchors inside those sibling renderers.
- More reels are appended on scroll via XHR to internal endpoints (e.g. `/youtubei/v1/reel/reel_item_watch`).

## What this gives us

We can read the next videoIds *before* the user reaches them, score them in the background, and silently auto-skip past any "Junk" verdicts the moment they become active. Zero visible jump.

## Implementation sketch (when we get there)

1. On every reel transition, walk `nextElementSibling` 1–2 hops, grab `videoId` from each `<a href="/shorts/..."`.
2. For each unseen videoId, fire a `score-reel` request in the background. SW caches scored verdicts in `chrome.storage.session` keyed by videoId.
3. When a new reel becomes active, check the cache. If verdict is "Junk", skip immediately — no API round-trip needed at the moment of skipping.
4. Bonus: pre-fetch oEmbed for the next 3 reels too, so even cold-start latency is hidden.

## What this DOES NOT solve

- The first reel in any session is unavoidably scored on arrival (no lookahead possible).
- If the user scrolls fast (faster than scoring + cache write), the first uncached junk reel will still flash.
- The Shorts feed is infinite; we only get lookahead for what YouTube has loaded into the DOM, not the entire future queue.

## Harder alternative: rewrite the feed JSON

`chrome.webRequest` can observe the `/youtubei/v1/reel/...` response, but MV3 removed the ability to modify response bodies. `declarativeNetRequest` can only block, not rewrite. So filtering the queue at the network layer would require:

- Either a v2 manifest (deprecated)
- Or injecting a script into the page that monkey-patches `fetch`/`XMLHttpRequest` to intercept the response, score the reels, and rewrite the array before YouTube parses it. This is fragile across YouTube updates but it's the only way to get true server-truncated filtering.

## Conclusion

Lookahead via DOM-sibling scoring is the right next step. Network-layer rewriting is a v3 problem.
