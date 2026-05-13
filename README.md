# FeedFixer — `metadata-analysis` branch

Auto-skip junk YouTube Shorts using Claude metadata classification.

This branch builds on `main`'s working manual-skip and adds:
- Detect every new active Short via URL polling + `yt-navigate-finish`
- Fetch title + channel via YouTube's public oEmbed endpoint (no key needed)
- Send to Claude (Haiku 4.5 by default) with a one-word verdict prompt: `Junk` or `Stay`
- If `Junk` and the user is still on that Short, silently call the proven `skipCurrentShort()`

## Build & install

```sh
npm install
npm run build
```

Then in Chrome:

1. `chrome://extensions` → Developer mode → Load unpacked → select `dist/`
2. Click **FeedFixer → Edit rubric & API key →** paste an Anthropic API key from <https://console.anthropic.com/settings/keys> → **Save**
3. Open a YouTube Short, watch the popup — last verdict + reason shows up
4. Toggle **"Auto-skip when Claude says Junk"** to enable/disable the silent skip

## Architecture

```
content script              service worker            Anthropic API
─────────────────           ───────────────           ─────────────
URL poll detects new ─────▶ score-reel ────▶ fetch oEmbed ──┐
active Short                                                 │
                            ◀──── verdict ──── Claude ◀──────┘
auto-skip if "Junk"
+ user still here
```

- Content script: `src/content/shorts.ts` — `startReelWatcher()` polls URL every 500ms
- Service worker: `src/background/service-worker.ts` + `scorer.ts`
- oEmbed: `https://www.youtube.com/oembed?url=…/shorts/{id}&format=json` (no auth)
- Claude: Haiku 4.5 with prompt-cached rubric

## Costs

Each Short = one Claude call. Title + channel (~30 tokens in) + 1 word out (`Junk` or `Stay`). With Haiku 4.5 ($1/$5 per 1M tokens) and rubric caching, expect ~$0.0001 per Short — about 1 cent per 100 Shorts viewed.
