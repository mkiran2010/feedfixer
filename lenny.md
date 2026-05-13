# lenny.md — context handoff for the next Claude session

You are picking up `feedfixer`, a browser extension the user is iterating on. This file gives you everything you need to skip the 5-hour ramp-up that the previous Claude went through.

---

## 1. What this is

A Chrome/Edge extension (Manifest V3) that filters YouTube Shorts in real time. Each new active Short triggers a Claude API call that classifies it as `Junk` or `Stay`. Junk shorts are silently auto-skipped; Stay shorts are watched once, then auto-advanced when they end.

The user's framing, in his own words from the kickoff:
> *"if your going to doom scroll you might as well scroll on important things. most people want good feeds but they cant achieve good feeds because they like watching other interesting content."*

So the value prop is **disciplined doomscrolling**: you can't trust YouTube's algorithm, and you can't trust yourself to manually filter mid-session, so the extension does it for you with a strictness setting that **locks once you start scrolling** to prevent in-the-moment loosening.

---

## 2. Repo state — branches and commits

GitHub: <https://github.com/mkiran2010/feedfixer> (private)

| Branch | Purpose |
|---|---|
| `main` | Minimal working baseline. Just a manual "Skip Short" button in the popup, no API. Has v0.1.0-tagged scaffold attempt + cleanup commits. Two commits total since the strip. |
| `metadata-analysis` | The real product. YouTube auto-skip via Claude metadata classification, 1–10 strictness slider OR custom instruction mode, session lock, auto-advance on reel end, purple/black themed UI with Outfit font. **This is the working branch.** |
| `multi-site` | Branched off `metadata-analysis` head (`bccda77`). Currently identical. Where the next work happens — adapting the extraction + skip pipeline to TikTok web, Instagram Reels web, and X video. After this, the same per-platform structure becomes the substrate for a local-model variant (CLIP/Transformers.js). |

**The user is currently checked out on `multi-site`** — confirm with `git status` before assuming.

---

## 3. Architecture (metadata-analysis branch)

```
┌─ content script ──────────────┐    ┌─ service worker ───────────┐    ┌─ Anthropic API ─┐
│ (runs on youtube.com tabs)    │    │ (MV3 background worker)    │    │                 │
│                               │    │                            │    │                 │
│ poll URL every 500ms ────────▶│    │                            │    │                 │
│ on new /shorts/{id}:          │    │                            │    │                 │
│   - attach end-watcher        │    │                            │    │                 │
│     (200ms setInterval)       │    │                            │    │                 │
│   - send score-reel ─────────▶│ ── score-reel ──▶ fetchMeta ────┼──▶ youtube.com/oembed │
│                               │                                  │    │                 │
│                               │ ◀── verdict ──── scoreReel ◀────┼─── api.anthropic.com │
│                               │                                  │    │ /v1/messages     │
│ if Junk + autoSkip:           │                                  │    │                 │
│   skipCurrentShort()          │                                  │    │                 │
│ if Stay:                      │                                  │    │                 │
│   keep watching, end-watcher  │                                  │    │                 │
│   fires on loop boundary      │                                  │    │                 │
└───────────────────────────────┘    └────────────────────────────┘    └─────────────────┘
                                            │
                                            ▼
                                     ┌─ popup ──────┐
                                     │ slider / lock │
                                     │ verdict card  │
                                     │ auto toggle   │
                                     └───────────────┘
```

Key contracts:

- **`chrome.runtime.sendMessage(msg)`** — content script → SW. The `send()` helper in `src/shared/messages.ts` is the single typed wrapper. Whenever you see "Uncaught (in promise) Error: no reply" in the console with a stack trace pointing at this function, it means the SW didn't respond (usually because the content script is orphaned after an extension reload — see §6 gotchas).
- **`chrome.tabs.sendMessage`** — was popup → content for the manual skip. **Removed in `bccda77`** along with the manual button. Don't add it back unless the user asks.
- **`chrome.storage.local`** — `Settings` (persistent, survives browser restart).
- **`chrome.storage.session`** — `SessionLock`, `lastVerdict`, `lastError` (cleared on browser restart).

---

## 4. File map (metadata-analysis branch)

```
src/
├── background/
│   ├── service-worker.ts   # message router, lock state, verdict storage
│   └── scorer.ts           # oembed fetch + Claude API (raw fetch, no SDK)
├── content/
│   ├── index.ts            # boots the watcher
│   └── shorts.ts           # reel detection, skipCurrentShort(), end-watcher
├── shared/
│   ├── messages.ts         # Msg / Reply types + send() helper
│   ├── settings.ts         # chrome.storage.local helpers
│   └── types.ts            # Settings, ScoredReel, SessionLock, DEFAULT_*
└── ui/
    ├── popup.html / popup.tsx     # slider, lock, verdict card, auto-skip toggle
    ├── options.html / options.tsx # API key, mode toggle, stages, custom rule, rubric
    └── styles.css                  # purple/black theme, Outfit font from Google Fonts

manifest.json   # MV3, host_perms for youtube.com + api.anthropic.com, no activeTab/no tabs
package.json    # vite + crxjs + react. NO @anthropic-ai/sdk anymore (raw fetch).
vite.config.ts  # crxjs handles HTML entries via manifest. Don't add rollupOptions.input
                # (it conflicts with crxjs html plugin and 400s the build).

research/
└── lookahead.md   # plan for pre-scoring next reels in the queue (not implemented)
```

---

## 5. Workflow

### Build & install
```sh
npm install
npm run build
# → dist/ contains the loadable extension
```

In Chrome: `chrome://extensions` → Developer mode → Load unpacked → `dist/`.

### After ANY code change — three-step sequence (CRITICAL)
1. `npm run build` (Chrome doesn't auto-build)
2. `chrome://extensions` → FeedFixer → **circular reload icon ↻** on the card (Chrome doesn't auto-reload from disk)
3. **Reload the YouTube tab itself** (Ctrl+R on the tab — content script in old tabs gets orphaned otherwise)

Skip any of these → user reports "nothing happens" → 30 minutes of debugging. **Always state all three steps** when telling the user to test.

### Dev mode
`npm run dev` runs Vite with HMR. Useful for popup/options work. Content scripts still need a tab reload.

---

## 6. Known gotchas (real ones from this session)

1. **"Could not establish connection. Receiving end does not exist."** → content script in target tab is orphaned after extension reload. User must reload the YouTube tab. This was the #1 cause of "nothing works" reports.

2. **Anthropic API CORS 401** — when calling `https://api.anthropic.com/v1/messages` from any browser context (including MV3 service worker), you MUST set the header `anthropic-dangerous-direct-browser-access: true`. The SDK sets this automatically when `dangerouslyAllowBrowser: true`; raw fetch does not. We use raw fetch — make sure the header is there.

3. **Anthropic SDK in MV3 service worker is a debugging tarpit.** It works, but adds 56KB and obscures errors. We dropped it in favor of raw `fetch()`. SW bundle went from 56KB → ~4KB. Keep it that way.

4. **`window.ytInitialData` requires the main world.** Content scripts run in an isolated world by default, so `window.ytInitialData` is `undefined` from the content script. Use `world: "MAIN"` in the manifest content_scripts entry, OR scrape the `<script>` tag, OR (what we do) use the public oEmbed endpoint. oEmbed is auth-free for YouTube but only gives title + author_name (no description, view count, tags).

5. **YouTube Shorts URL = source of truth for videoId.** `/shorts/{11-char-id}` always reflects the active reel. Polling URL every 500ms is more reliable than DOM mutation observers on `[is-active]`.

6. **The Skip primitive — three fallbacks in order:**
   - Click `#navigation-button-down button` (YouTube's own arrow — most reliable, triggers their handlers)
   - Dispatch synthetic `ArrowDown` keydown
   - `nextElementSibling.scrollIntoView()` on the active reel renderer

7. **Auto-advance must attach IMMEDIATELY on reel change, not after the verdict.** The previous version waited for the API round-trip + a 250ms timeout, by which time the user had already finished watching. Now: attach a `setInterval(200ms)` watcher the moment a new reel is detected, regardless of verdict. Detect loop via either `currentTime < lastTime - 1` (backward jump) or `duration - currentTime < 0.3` (near-end). Detach on URL change.

8. **Vite + crxjs config:** Do NOT put HTML entries in `rollupOptions.input`. crxjs picks them up from the manifest. Doubling them up breaks the html plugin with a confusing "replacement content must be a string" error.

9. **package.json self-reference:** A linter (likely the user's IDE) keeps adding `"feedfixer": "file:"` to dependencies. The system tells me this is intentional. **Leave it alone.** Don't try to remove it — it'll come back.

10. **Lock state is in `chrome.storage.session`** so it auto-clears on browser restart but persists across SW unloads. The first successful score-reel call sets `SessionLock` if it doesn't exist. Slider in popup and stage editors in options are disabled when locked.

11. **Custom instruction mode bypasses the stage system entirely.** When `useCustomInstruction === true`, scorer uses `customInstruction` text directly in place of the stage description. UI must hide/show the right controls.

---

## 7. User preferences (READ THIS FIRST)

### Git
- **Username:** `mkiran2010`
- **Email:** `mkiran678fn@gmail.com` — NOT the Berkeley email that appears in conversation context.
- **Commit message style:** Conventional Commits prefix (`fix:`, `feat:`, `refactor:`, `chore:`) + terse single-line description. **No body paragraphs.** No "what / why" rambles. Example: `fix: manual scroll functionality, fallback to synthetic ArrowDown`
- **NO `Co-Authored-By` line.** User explicitly asked Claude not to be listed.
- Pass identity inline: `git -c user.name="mkiran2010" -c user.email="mkiran678fn@gmail.com" commit -m "..."`. Never modify the global git config.

### Communication style
- Action over speculation. He gets frustrated by long debug-loop chains where Claude asks for diagnostic info repeatedly without making progress.
- One-letter answers ("a", "b") are valid responses to multiple-choice questions — interpret literally and proceed.
- He'll often dump 3–5 distinct requests in a single message. Address them all in the same turn; don't rabbit-hole on the first one.
- He sends screenshots inline (paste files into the project dir). Read them with the Read tool — they're useful debugging signal.
- He'll sometimes "stage" changes himself in git before asking you to commit. Run `git status` before assuming there's nothing staged.

### What works
- Plans presented as clear options with one decision per question (use AskUserQuestion or simple "A / B / C" prose).
- Brief upfront context, then bullet lists of what changed and what to do next.
- Explicit step-by-step "do this exact sequence" when telling him to test (the reload-extension-then-reload-tab trifecta especially).

### What doesn't
- Long diagnostic checklists with 4+ "tell me what you see" items. He'll bail.
- Asking him to open the SW console to read errors. He sometimes does, sometimes won't. Surface errors in the popup UI banner instead — that's what the red "Last error:" card is for.
- Offering to do things you can't do ("let me load the extension for you" — you can't drive Chrome).

---

## 8. Roadmap / future ambitions

Captured in `research/lookahead.md` and in the conversation history:

### Near-term (multi-site branch — what's next)
- Detect site (`youtube.com` / `tiktok.com` / `instagram.com` / `x.com`) at content-script init.
- Adapter pattern: each platform has its own `extractMeta()` and `skipCurrent()` implementation. Shared verdict path stays the same.
- TikTok web: For You feed scrapes via DOM (TikTok actively breaks scrapers — accept fragility).
- Instagram Reels web: similar, fragile.
- X video feed: x.com DOM is hookable.
- Mobile (where doomscrolling actually happens) is **out of scope** — no extension surface, would need an Android Accessibility Service in a separate native app. v3 problem.

### Medium-term (after multi-site lands)
- **Lookahead scoring** (`research/lookahead.md`): score the next 1–2 reels in the DOM queue while the user watches the current one. Eliminates the visible auto-skip jump. Implementation sketch in that file.
- **Local model variant**: replace the Claude API call with a local Transformers.js + CLIP inference on a captured video frame. Pros: zero per-call cost, zero data leaves the browser. Cons: 80–150MB one-time model download, ~500ms per inference, classification accuracy is rougher. The multi-site adapter pattern is what makes this swap clean — just swap the scorer module.

### Long-term
- **Chrome Web Store publication.** Currently NOT published. To use the extension someone has to clone the repo, build, and load unpacked themselves. Publishing requires:
  - $5 one-time developer registration on <https://chrome.google.com/webstore/devconsole>
  - Privacy policy URL
  - Screenshots, description, icon (the extension currently has no icon)
  - Single-purpose declaration
  - ~3–7 day review
  - User has been told this; defer until product is more polished.
- **Cost dashboard in the popup** — surface input/output tokens, estimated $/day, cache hit rate. Useful once usage scales.
- **Watch-time analytics** — show "you saved X minutes this week" to make the value tangible.

### Explicitly NOT roadmap
- Don't reintroduce the manual skip button on metadata-analysis. User asked for its removal.
- Don't reintroduce the homepage tile filter. The v0.1.0 attempt did this and it was a failure. Shorts is the only surface that matters right now.
- Don't add screen-time pause / focus-mode features yet — adjacent but out of scope.

---

## 9. The skill ecosystem you have access to

You have the `claude-api` skill (Anthropic SDK / API patterns), the `update-config` skill (settings.json), and others. The `claude-api` skill was actively used in this project for prompt caching and the raw-fetch migration. If you need to migrate models or add features like batch scoring or compaction, invoke it.

The user has Anthropic API credentials and is on Berkeley email auth. He'll occasionally complain about API spending — Haiku 4.5 with prompt caching is the cost-conscious default and is set as the default model in `DEFAULT_SETTINGS`.

---

## 10. First moves when you pick up

1. `git status` — confirm current branch.
2. `git log --oneline -10` — see recent commits.
3. Read this file (which you just did).
4. Read `README.md` and `PATCHNOTES.md` on whatever branch you're on.
5. Ask the user what they want to work on next. Don't assume from this file — it's a snapshot, not a TODO.
6. When the user describes a bug, your first instinct should be: "did you reload the extension AND the YouTube tab?" 9 times out of 10 that's it.

Good luck. Be terse, be direct, ship working code.
