# Publishing Syte to the Chrome Web Store

This is the playbook to get the extension off "developer mode unpacked install" and onto a one-click webstore install.

## Cost & timeline

- **One-time fee:** $5 USD to register as a Chrome Web Store developer. Covers up to 20 extensions on that account, lifetime.
- **Review time:** typically 2–5 business days. Currently slower (~1–3 weeks) due to a 2026 submission surge. If review exceeds 3 weeks, contact developer support.

## Pre-flight checklist

Things we need before submitting:

### Assets
- [ ] **Icon — 128×128 PNG** (required). Right now `manifest.json` has no icon. Add an `icons` field once we have art:
  ```json
  "icons": {
    "16": "icons/icon-16.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  }
  ```
- [ ] **Screenshot — 1280×800 or 640×400 PNG** (required, at least one). Show the popup overlaid on a YouTube Shorts page.
- [ ] **Promo tile (optional but recommended)** — 440×280 small tile and 1400×560 marquee for store discovery.

### Text
- [ ] **Short description** — max 132 chars. Suggested: *"On-device AI filter for YouTube Shorts. Auto-skips junk reels using Chrome's built-in Gemini Nano. No API key, no data leaves your browser."*
- [ ] **Detailed description** — full Markdown-ish text for the listing page. Cover: what it does, how strictness works, the on-device privacy story, supported Chrome versions, the lock-on-scroll discipline feature.
- [ ] **Category** — `Productivity`.
- [ ] **Language** — English.

### Required URLs
- [ ] **Homepage URL** — point at the GitHub repo (or a landing page if we ever build one).
- [ ] **Privacy policy URL** — REQUIRED because we read the active YouTube tab and call `youtube.com/oembed`. Even though everything else is on-device, the privacy policy must disclose:
  - We read the URL of YouTube tabs to detect the active Short
  - We call `https://www.youtube.com/oembed` to fetch title and channel name
  - We send title + channel to Chrome's on-device Gemini Nano model (which Google manages)
  - We do NOT send anything to Syte servers (we have none)
  - We do NOT collect telemetry

  The simplest path: host a `PRIVACY.md` markdown file as a GitHub Pages site or as a gist, and link to that.

### Single-purpose declaration
- Single purpose: *"Filters YouTube Shorts using Chrome's on-device AI."*

### Permission justifications (you'll fill these in the dashboard)
- `activeTab` — needed to detect when the user is on a YouTube Short and to send the manual-skip command to the active tab.
- `storage` — needed to remember the user's strictness settings between sessions.
- `host_permissions: youtube.com` — needed to inject the content script that detects Shorts and dispatches skip events.

## Build & package

```sh
npm run build          # produces dist/
cd dist
zip -r ../syte-v0.5.0.zip *
```

The store wants a single ZIP of the extension contents (manifest.json at the root of the ZIP).

**Watch out:** the ZIP must NOT include `dist/` as a top-level folder — `manifest.json` should be at the root of the archive.

## Submission

1. Go to <https://chrome.google.com/webstore/devconsole>.
2. Pay the $5 fee if not already done. (One-time, persists forever.)
3. Click **New item** → upload the ZIP.
4. Fill out the listing form: short + detailed description, category, screenshot, icon, privacy policy URL, single-purpose declaration, permission justifications.
5. Choose visibility: **Public**, **Unlisted** (link-only, doesn't show in search), or **Private** (just you / a test group).
   - For a beta, **Unlisted** is the right call — your housemate / testers can install via direct link, but it doesn't show up in store searches yet.
6. Submit for review.

## After it's approved

- Listing URL becomes `https://chromewebstore.google.com/detail/<extension-id>`. Anyone with the link installs in one click.
- To push an update: bump `version` in `manifest.json`, rebuild, re-zip, upload as a new package on the same listing. Reviews of updates are typically faster (<48h).
- Auto-update is on by default — installed users get the new version within ~24h of approval.

## Things that get extensions REJECTED

These are the common ones; avoid them:

- **Permissions broader than needed.** We're clean — we don't request `tabs`, `webRequest`, `<all_urls>`, etc.
- **Missing privacy policy** when handling user data. We MUST have one (link in the dashboard).
- **Misleading metadata.** Description must match what the extension actually does.
- **Using `storage` for credentials without disclosure.** We don't store an API key on `locality` — we used to, that's gone.
- **Remote code execution / fetching JavaScript at runtime.** We're clean — all code is bundled.
- **Affiliate links / undisclosed monetization.** N/A.

## What's still missing before we can submit

In rough priority order:

1. **Icons** — need 16/48/128 px PNG art. No design exists yet. Even a placeholder purple "F" on a black square would unblock submission.
2. **Privacy policy** — needs to be written and hosted somewhere with a stable URL.
3. **Screenshot of the popup on YouTube** — easy to capture once everything's working.
4. **Detailed description** — write 2–4 paragraphs.
5. **Decide visibility** — recommend starting with "Unlisted" so we control rollout.
