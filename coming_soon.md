# Coming soon — roadmap

Active backlog of Syte improvements, ranked by perceived impact. Captured 2026-05-13 after the first end-to-end Supabase data collection went live.

## Tier 1 — biggest perceptual leaps

### 1. Lookahead scoring
Score the next 1–2 reels in the queue while you watch the current one. Junk reels skip with **zero visible flicker** because the verdict is already cached when they become active. This is the single biggest UX upgrade left.

- Implementation outline: `research/lookahead.md`
- ~100 lines, builds on the existing watcher + SW message round-trip
- Adds a `chrome.storage.session` verdict cache keyed by videoId

### 2. Channel allowlist / blocklist
Pin channels you always trust (skip the LLM, always Stay) or always hate (always Junk). Two benefits: instant verdict for those channels (no API call → faster + free), and the LLM stops getting wrong calls on your favorite educators. The Supabase data lets us suggest channels for the user's allowlist based on their high-scoring history.

### 3. "Wrong call?" feedback button
On each entry in the popup's recent-reels list, a small ✕ that sends a correction back. The correction goes into a Supabase `corrections` table. Two payoffs:
- Statistically derive what users disagree with → tighten the rubric
- Eventually the corrections become training data for a smaller, tuned model

## Tier 2 — quality-of-life

### 4. Pre-warm Gemini Nano on YouTube load
The first reel takes ~15 seconds to score because the on-device model loads into memory on the first call. Pre-fire a throwaway `LanguageModel.create()` the moment the content script detects `/shorts/` — model is hot by the time you focus on the first reel. The 15s gets hidden inside YouTube's own page load. ~20 lines.

### 5. "What did I miss?" insight in the popup
Instead of just listing recent verdicts, show a one-line summary like *"You'd have watched 12 junk reels in the last 5 minutes (avg 18s each = 3:36 saved)"*. Makes the value tangible. The data is already in the local log.

### 6. Onboarding flow
First-install popup explaining: how strictness works, why you should pick a level, the lock mechanic. Right now there's zero handhold for a new user.

## Tier 3 — strategic / longer projects

### 7. Web Store publication
See `PUBLISHING.md`. Need icon polish, privacy policy hosted at a stable URL, screenshots, ~3–7 day review.

### 8. Multi-site (TikTok, Instagram Reels, X)
Already on the `multi-site` branch as a stub. The skip primitive + scoring pipeline is reusable; just needs per-site DOM extraction. TikTok is the obvious next target since it's the canonical brainrot platform.

### 9. Time-based modes
"Strict mode 10pm–6am" — can't loosen at night when willpower's lowest. Discipline feature, fits the original product framing.

### 10. Community-trained rubric
Once ~1000 users have contributed data, statistically derive a "what most people skip" profile and offer it as a one-click default rubric. Network-effect moat.

## Tier 4 — polish

11. Properly-sized icons (current is one source PNG used at all sizes — soft at 16px)
12. Sound cue / animation when auto-skip fires (so users see "yes, the system is working")
13. Pause-for-N-minutes button in popup (had a stub on metadata-analysis branch; removed on locality)

## Recommended sequence

Ship in this order:

1. **Pre-warm fix** (#4) — ~20 lines, fixes the 15s cold start
2. **Lookahead scoring** (#1) — eliminates visible-skip lag
3. **Channel allowlist** (#2) — makes the filter feel personal + fast

After those three, the product feels qualitatively different. Then fork: Web Store launch as v1.0, OR push into multi-site / community features.
