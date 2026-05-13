# Syte

> Auto-skip junk YouTube Shorts using Chrome's on-device AI. No API key. No spend. No data leaves your browser unless you opt in.

Syte watches the YouTube Shorts feed, asks Chrome's built-in Gemini Nano model whether each reel is "Junk" or "Stay" based on a strictness level you set, and silently advances past anything classified as junk. The strictness level **locks** once you start scrolling — so you can't talk yourself into loosening it mid-session when willpower drops.

---

## Requirements

- **Chrome (or Edge) version 138 or newer.** Check yours at `chrome://settings/help`. If older, update first.
- **Operating system** that supports Chrome's built-in AI:
  - Windows 10 or Windows 11
  - macOS 13 (Ventura) or newer
  - Linux
  - ChromeOS (Platform 16389.0.0+)
- **At least 4GB of free disk space** for the on-device Gemini Nano model (Chrome downloads it once, ~1.7GB, and reuses it across all extensions).
- **Node.js 18+ and npm** to build the extension. Get it at <https://nodejs.org/> (the LTS download is fine).
- **Git** to clone the repo. Already installed on macOS and most Linux distros; on Windows get it at <https://git-scm.com/>.

If any of those aren't true, Syte won't run.

---

## Install (5 minutes)

These steps work on Windows, macOS, and Linux. Open a terminal (Command Prompt or PowerShell on Windows, Terminal on Mac/Linux) and run them in order.

### 1. Get the code

```sh
git clone https://github.com/mkiran2010/syte.git
cd syte
```

### 2. Build it

```sh
npm install
npm run build
```

That produces a `dist/` folder containing the loadable extension. The first `npm install` takes ~30 seconds; the build itself takes ~1 second.

### 3. Load it into Chrome

1. Open `chrome://extensions` in Chrome.
2. Toggle **Developer mode** ON (top-right corner).
3. Click **Load unpacked** (top-left).
4. Pick the `dist/` folder you just built.

You should see the Syte icon (purple film-reel) appear in your Chrome toolbar.

### 4. Verify the on-device AI is ready

1. Click the Syte toolbar icon to open the popup.
2. Look at the small status text near the top:
   - **"on-device AI ready"** (green) — you're set, skip to "Use it" below.
   - **"model not yet downloaded"** (yellow) — click the **Download** button. Gemini Nano will download in the background (~1.7GB). Comes back as "ready" when done.
   - **"on-device AI unavailable"** (red) — your Chrome / OS doesn't support the Prompt API. Re-check the requirements above.

---

## Use it

1. Open a YouTube Short — go to <https://www.youtube.com/shorts> or click any Short link.
2. The first reel takes ~15 seconds to classify (the model is warming up). After that, every reel is classified within ~1 second.
3. Click the Syte toolbar icon to:
   - **Adjust strictness** with the 1–10 slider (changes which kinds of content get classified as Junk)
   - **See recent verdicts** in the popup's "Recent reels" list — junk reels get a pink badge, stay reels get a mint badge
   - **Toggle auto-skip** on/off
4. Once the first reel is scored, the strictness slider **locks** for the session. To change it, click "Unlock" in the popup. (This is intentional — prevents in-the-moment loosening.)

### Setting a custom rule instead of 1–10

Click "Edit rules →" at the bottom of the popup to open the options page. Switch to **Custom instruction** mode and write your own rule, e.g. *"Only stay on videos about chess, philosophy, or rocket science. Anything else is junk."* That single rule replaces the strictness scale.

---

## What gets shared

By default, Syte uploads a small record of each classification to a central database to help improve the filter. Each upload contains a random anonymous install ID, the videoId/title/channel of the Short, the verdict, and your strictness level — **no name, email, or other identifying info**.

To opt out: open the options page → toggle off **"Share classified-reel data"**.

Full details: [PRIVACY.md](./PRIVACY.md).

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| "Cannot connect to localhost:5173" page on toolbar click | You ran `npm run dev` instead of `npm run build`. Run `npm run build`, then in `chrome://extensions` click the reload icon on the Syte card. |
| Popup says "Local AI unavailable" | Your Chrome version is too old (need 138+) or your OS isn't supported. Update Chrome via `chrome://settings/help`. |
| Reels aren't being classified | (1) Reload the Syte extension card. (2) Reload the YouTube tab itself with Ctrl+R. The content script in already-open tabs becomes orphaned after an extension reload. |
| First reel takes forever | Cold-start of the model. Subsequent reels are fast. Future versions will pre-warm. |
| 401 errors for some videos | YouTube's metadata endpoint refuses age-restricted/private/region-blocked videos. Syte defaults those to "Stay" (won't auto-skip). Not a bug. |
| Extension reloads breaking things | Always reload extension card AND the YouTube tab. The two-step matters. |

---

## What's next

See [coming_soon.md](./coming_soon.md) for the roadmap. The next three planned features:

1. **Pre-warm Gemini Nano** to eliminate the 15s cold start
2. **Lookahead scoring** so junk reels skip with no visible flicker
3. **Channel allowlist / blocklist** for instant verdicts on trusted channels

---

## Project layout

```
src/
├── background/
│   ├── service-worker.ts   # message router, lock state, verdict storage
│   ├── scorer.ts           # oembed fetch + Chrome AI session call
│   └── upload.ts           # Supabase POST (fire-and-forget)
├── content/
│   ├── index.ts            # boots the watcher
│   └── shorts.ts           # reel detection, skipCurrentShort(), end-watcher
├── shared/
│   ├── messages.ts         # Msg / Reply types + send() helper
│   ├── typed-send.ts       # asserts reply kind, throws on mismatch
│   ├── settings.ts         # chrome.storage.local helpers
│   ├── verdict-log.ts      # local log + cap at 1000 entries
│   ├── install-id.ts       # persistent random UUID per install
│   ├── supabase-config.ts  # public URL + anon key
│   └── types.ts            # Settings, ScoredReel, SessionLock, defaults
└── ui/
    ├── popup.html / popup.tsx     # slider, lock, recent reels, auto-skip
    ├── options.html / options.tsx # API key, mode toggle, stages, rule, rubric
    └── styles.css                  # purple/black theme, Outfit font
```

---

## License

MIT. Use it, fork it, ship it.
