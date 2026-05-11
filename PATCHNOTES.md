# FeedFixer — Patch Notes

## v0.1.0 — Initial build

A Manifest V3 Chrome/Edge extension that filters YouTube feeds by sending each video's metadata to the Claude API for a 0–100 "enrichment" score. A token-bucket controller interleaves high-score and low-score videos at a user-set ratio.

---

### What works

- **Project scaffolding** — Vite + crxjs + TypeScript build pipeline. `npm install && npm run build` produces a loadable `dist/` folder.
- **Manifest V3 service worker** — boots cleanly, registers message handlers, listens for `chrome.runtime.onMessage`.
- **Settings persistence** — API key, model, rubric, and rubric version saved to `chrome.storage.local`. Survives reload.
- **Score cache** — IndexedDB store keyed on `(videoId, rubricVersion)`. Editing the rubric bumps the version, forcing re-scoring.
- **Token-bucket controller** — math is correct in isolation; converges on user-set junk percentage over a long enough sample.
- **Options page** — rubric editor, API key field, model dropdown, threshold slider, reset cache button. Save round-trips through the service worker.
- **Popup UI** — junk-allowed slider, shown/hidden/avg-score stats, pause toggles, debug box.
- **Content-script DOM injection** — runs on `https://www.youtube.com/*` and `https://m.youtube.com/*`, injects `inject.css`, attaches MutationObserver. Console emits `[feedfixer] booted on /…` on every page load.
- **Debug toggle** — "Force every video to be junk" checkbox in the popup bypasses the API and forces every video to score 0. Lets you exercise the skip/hide pipeline without hitting the API.
- **Diagnostic counters** — popup shows "Score requests received" and "Last content-script ping" so you can verify the content script is actually reaching the service worker.
- **Error surfacing** — scoring failures from the Claude SDK are caught, stored in `chrome.storage.session`, and rendered as a red banner in the popup.

---

### What's broken / unverified

- **End-to-end scoring has not been verified on a real user's machine.** As of this commit, the user reports zero API spend on the Anthropic console after scrolling YouTube for several minutes. Possible causes still to triage:
  - Claude SDK incompatibility with the MV3 service worker runtime (fetch quirks, environment detection)
  - Content script not reaching the service worker (would show as "Last content-script ping: never" in the new debug box)
  - Silent fallback to score 75 when the API call throws — masks the underlying error
  - User flow issue (API key not saved, extension not reloaded after rebuild)
  - The debug box added in this commit is the diagnostic that pins down which of these it is — next session starts by reading those numbers.

- **Shorts auto-skip is unverified.** Code dispatches an `ArrowDown` keyboard event on the document with a 250ms grace overlay. Never observed actually firing because no Short has yet been classified as junk on a real machine. Needs to be tested with the new "Force junk" debug toggle.

- **Homepage tile hiding is unverified.** Same root cause — no tile has ever been classified as junk on a real machine. Needs the "Force junk" toggle to exercise.

- **Anthropic SDK in service worker** — used `dangerouslyAllowBrowser: true` plus host_permissions for `api.anthropic.com`. Theoretically should work in an MV3 service worker but has not been confirmed end-to-end. If it doesn't, the fallback is a raw `fetch(...)` call to `https://api.anthropic.com/v1/messages`, which sidesteps any SDK-level Node/browser detection.

- **Selector fragility** — DOM selectors for `ytd-rich-item-renderer`, `ytd-compact-video-renderer`, and `ytd-reel-video-renderer[is-active]` are correct as of 2026-05 but YouTube ships UI changes often. May need maintenance.

- **No telemetry on cost** — the popup doesn't surface input/output tokens or estimated cost per session. Could be useful for tuning.

---

### Next-update punch list

In priority order:

1. **Get the user diagnostic readout** ("Score requests received," "Last content-script ping," whether the red error banner appears) — pins down whether this is a content-script wiring issue, a service-worker messaging issue, or an SDK call issue.

2. **If it's the SDK** — drop the `@anthropic-ai/sdk` dependency from the service worker and call `https://api.anthropic.com/v1/messages` directly with `fetch`. Smaller bundle, fewer surprises in the MV3 SW context.

3. **Verify the skip pipeline with the "Force junk" toggle** — tick the box, set junk-allowed to 0%, reload YouTube. Every homepage tile should hide. Visit `/shorts/`, every Short should auto-skip with the corner overlay. If this doesn't happen, the bug is in the content script, not the API.

4. **Add a "test scoring" button** to the options page that sends one fixed video to the scorer and renders the raw response + any error. Removes all DOM/observer variables from the equation.

5. **Better recovery from in-flight failures** — if a tile is stuck in `data-feedfixer-state="pending"` for >5s, retry once instead of leaving it grey forever.

6. **Session-outputs and cost dashboard** — surface input/output tokens, cache hit rate, and estimated $/day in the popup. The current "Avg score" tile is less useful than this would be.

7. **TikTok/Instagram** — out of scope for v1 (research showed neither platform exposes a feed-control surface), but worth revisiting if a browser-extension hook on TikTok web appears.
