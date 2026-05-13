# FeedFixer

Chrome/Edge extension that adds a manual "Skip current Short" button to YouTube. Click the toolbar icon while watching a YouTube Short, hit the button, the Short advances. That's it.

This `main` branch is the minimal, working baseline. The metadata-driven auto-skip lives on the `metadata-analysis` branch.

## Build & install

```sh
npm install
npm run build
```

Then in Chrome:

1. `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** and select the `dist/` folder
4. Open a YouTube Short, click the FeedFixer toolbar icon, hit "⬇ Skip current Short"

## How it works

- Popup queries the active tab via `chrome.tabs.query`
- Button enabled only when URL matches `/shorts/`
- On click, popup sends `{kind: "manual-skip"}` to the active tab via `chrome.tabs.sendMessage`
- Content script on YouTube tabs listens for that message
- Skip routine tries three approaches in order, returns the first that succeeds:
  1. Click YouTube's own down-arrow button
  2. Dispatch a synthetic `ArrowDown` keydown
  3. Scroll the next reel into view
- Status is shown under the button: "Skipped (nav-button)" / "Skipped (keydown)" / etc.

## Project layout

```
src/
├── content/
│   ├── index.ts     # listens for manual-skip messages
│   └── shorts.ts    # skipCurrentShort() — the actual skip routine
├── ui/
│   ├── popup.html
│   ├── popup.tsx    # the button + active-tab detection
│   └── styles.css
└── shared/
    └── messages.ts  # TabMsg / TabReply contract
```

No service worker. No API keys. No background processing. Just popup → content script → DOM.
