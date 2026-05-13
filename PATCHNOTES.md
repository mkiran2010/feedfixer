# FeedFixer — Patch Notes

## v0.2.0 — Strip to working baseline

Removed everything that wasn't reliably working. Kept only the manual-skip feature, which is verified working end-to-end.

### What works

- **Manual Skip Short button** — popup button advances the current YouTube Short. Three fallback methods (nav-button click → synthetic ArrowDown → scrollIntoView), reports which one succeeded.
- **Active-tab detection** — button is enabled only on `youtube.com/shorts/*`, greyed out elsewhere. Auto-refreshes every second.
- **Build pipeline** — `npm install && npm run build` produces a clean `dist/` ready to load as an unpacked extension.

### What was removed

The following all shipped in v0.1.0 but never worked reliably end-to-end and was burning time. Removed entirely from `main`:

- Claude API scoring (Anthropic SDK, prompt caching, batched scorer)
- IndexedDB score cache, rubric versioning
- Token-bucket controller, junk-percentage slider, threshold logic
- Service worker, message router
- Homepage tile observer, hide/pending CSS states
- Options page (rubric editor, API key, model selector)
- Stats counters, debug toggle, error banner

If we want any of this back, it's in git history (`v0.1.0` tag the previous initial commit).

### Next: `metadata-analysis` branch

The next experiment lives on a branch, not main. Plan:

- On every new active Short, extract metadata from `window.ytInitialData` (title, channel, description, view count, tags)
- Send to Claude with a "junk vs stay" tool definition
- If Claude calls `skip_short`, run the proven `skipCurrentShort()` from this baseline
- Trigger automatically on every reel change via MutationObserver on `[is-active]`

Main stays clean. If the branch works, merge. If not, throw it away without polluting `main` again.
