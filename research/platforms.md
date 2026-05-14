# Per-platform notes

What we need to figure out per non-YouTube platform before adding a real adapter. Stub detection is in `src/content/platforms.ts`; this file is the worklist.

Each adapter needs three things:

1. **Active video ID** — how do you tell which video is currently playing?
2. **Skip mechanism** — how do you advance the feed by one?
3. **Metadata extraction** — title, author/channel name (anything the LLM can use to decide Junk vs Stay)

## YouTube — DONE

- Active video ID: URL `pathname` matches `/shorts/{11 chars}`.
- Skip: click `#navigation-button-down button`, fall back to dispatched `ArrowDown` keydown, fall back to `nextElementSibling.scrollIntoView()`.
- Metadata: `youtube.com/oembed?url=...&format=json` returns `title` + `author_name`. Free, no auth.

## TikTok — TODO

URL pattern when scrolling FYP: `https://www.tiktok.com/foryou` and individual videos at `https://www.tiktok.com/@{user}/video/{19-digit-id}`.

Things to check while logged in to TikTok web:

- **Active video element**: inspect the FYP, find the currently-playing video. Likely under `[data-e2e="recommend-list-item-container"]` or similar.
- **How does TikTok's own "next" arrow work?** Desktop site has up/down arrows on the right edge — find the selector and click it.
- **Keyboard fallback**: `ArrowDown` should work in an unfocused-input state.
- **Title/author**: visible in the description overlay. Selectors will need testing.
- **TikTok blocks scrapers aggressively** — DOM selectors may change frequently. Consider a fallback regex on `__UNIVERSAL_DATA_FOR_REHYDRATION__` (giant JSON in a `<script>` tag).

## Instagram Reels — TODO

URL pattern: `https://www.instagram.com/reels/{shortcode}/` (logged-in feed at `/reels/`).

Things to check:

- **Active reel element**: a `<video>` inside `article` containers, but Insta does heavy virtualization.
- **Skip**: scroll the feed container by one viewport height, OR find Insta's own arrow buttons (desktop has them on the right side).
- **Title**: Insta reels don't really have titles — only captions. Use the caption text.
- **Author**: visible profile link.
- **Login requirement**: Reels feed only loads when authenticated. The script will need to handle the case where the user is signed out.

## X (Twitter) — TODO

X doesn't have a dedicated short-video feed; videos live in the main timeline as embedded `<video>` elements inside tweets. The "scroll" model is different — you're scrolling tweets, not videos.

Things to figure out first:

- **Is there a video-only mode?** X's Spaces tab? `x.com/explore`? Most video discovery is the main timeline.
- **What does "skip" even mean here?** On a tweet-based feed, you'd skip past the entire tweet (including text, images, replies) rather than just a video. Likely need to hide the parent `article` or scroll past it.
- **Active video detection**: Intersection Observer on `<video>` elements, "active" = the one most centered in the viewport.
- **Metadata**: tweet text is the closest thing to a title. Author handle is the channel.

Honestly X is the weakest fit for this product as currently designed (we're a *video-feed* filter, X is text-first with optional video). Worth deprioritizing until YouTube + TikTok + Insta are solid.

## Shared infrastructure to add later

Once 2+ adapters are working, extract a `PlatformAdapter` interface:

```ts
interface PlatformAdapter {
  getCurrentVideoId(): string | null;
  extractMeta(videoId: string): Promise<VideoMeta>;
  skipCurrent(): string | null; // returns the method that worked, for logging
  attachEndWatcher?(videoId: string, onEnd: () => void): () => void; // returns detach fn
}
```

The `shorts.ts` watcher loop becomes adapter-driven instead of YouTube-specific. SW stays unchanged — it just receives `score-reel` with a `meta` payload + a `platform` discriminator.

## Sequencing recommendation

1. TikTok first (closest analog to YouTube Shorts, biggest brainrot vector after YouTube)
2. Instagram Reels (similar UI shape but tougher login + scraping tax)
3. X last (different model, lower priority)

For TikTok specifically, plan to spend ~1–2 hours reverse-engineering the DOM with the live page open. Selectors WILL break on TikTok updates, so accept that this is a maintenance-tax adapter, not a write-once one.
