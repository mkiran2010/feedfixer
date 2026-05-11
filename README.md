# FeedFixer

A Chrome/Edge extension that filters your YouTube feeds with an LLM enrichment classifier. Drag a slider to control how much "junk" gets through.

## Quick start

```sh
npm install
npm run build
```

Then in Chrome:

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** and select the `dist/` folder
4. Click the FeedFixer icon → **Edit rubric & API key →** and paste your Anthropic API key (get one at https://console.anthropic.com/settings/keys)
5. Open https://www.youtube.com — tiles will fade in as scoring completes

## How it works

- Content script watches the YouTube DOM for video tiles (homepage, sidebar, channel pages, Shorts player)
- Each tile gets scored 0–100 by an LLM (Claude Haiku 4.5 by default) against your rubric
- A token bucket interleaves high-score and low-score videos at the ratio you set on the popup slider
- Junk Shorts auto-skip after a 250ms grace period (a "keep watching" overlay lets you override)
- Scores are cached in IndexedDB and re-scored only when you edit the rubric

## Dev mode

```sh
npm run dev
```

Hot-reloads the extension as you edit. Reload the YouTube tab after content-script changes.

## Costs

With Claude Haiku 4.5 + prompt caching on the rubric, expect a few cents per day of normal browsing. Heavy users might see a dime. The rubric is the cached system prompt, so per-request input cost is dominated by video metadata only (~50 tokens per video).

Switch to Sonnet 4.6 in options if Haiku scores feel inconsistent — costs go up roughly 3x.

## Verification

End-to-end checks:

1. Open YouTube. Within ~3s, tiles should fade in. Open DevTools console, filter by `[feedfixer]` to see per-video score logs.
2. Slide popup to 0% junk, reload — only high-score tiles should render.
3. Slide to 100% — nothing should be hidden.
4. Slide to 30%, scroll for 5 minutes. In the console: `chrome.storage.session.get('feedfixer.session', console.log)` — verify the long-run shown:hidden ratio matches.
5. Visit `youtube.com/shorts/` — junk shorts should auto-advance after a brief grace period with a corner overlay.
6. Edit rubric in options → save → reload YouTube. Cached scores should refresh (rubricVersion bumps).
7. Cost check: open the Anthropic console, verify cache-hit rate >80% on the rubric block after the first batch.

## Project layout

```
src/
├── background/
│   ├── service-worker.ts   # message router, batches scoring requests
│   ├── scorer.ts           # Claude API client w/ prompt caching
│   ├── cache.ts            # IndexedDB: (videoId, rubricVersion) → score
│   └── token-bucket.ts     # junk-quota controller
├── content/
│   ├── index.ts            # entry, surface routing
│   ├── homepage.ts         # tile observer + filter
│   ├── shorts.ts           # Shorts auto-skip
│   ├── extractors.ts       # DOM → VideoMeta
│   └── inject.css          # tile state styles
├── ui/
│   ├── popup.{html,tsx}    # threshold slider, stats, pause
│   ├── options.{html,tsx}  # rubric editor, API key
│   └── styles.css
└── shared/
    ├── types.ts            # VideoMeta, Score, Settings
    ├── messages.ts         # typed runtime message contract
    └── settings.ts         # chrome.storage.local helpers
```
