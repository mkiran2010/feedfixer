# Syte Privacy Policy

**Last updated:** 2026-05-13

This is the plain-language summary of what Syte does and doesn't do with your data. There is no fine print.

## What gets stored locally on your device

- Your settings (strictness level, custom filter rule if you set one, rubric).
- The last 1,000 reels you've scrolled, with: videoId, title, channel, verdict (Junk or Stay), what strictness level was active, and when. Stored in your browser's local extension storage. You can export this as JSON or wipe it from the options page.
- A random anonymous ID (a UUID) that identifies your install. Generated once on first run, never linked to your name/email/Google account. You can reset it by reinstalling the extension.

## What gets sent over the network

### To YouTube (`youtube.com/oembed`)
For each Short you scroll, we ask YouTube's public oEmbed endpoint for the title and channel name. This is the same data anyone visiting that video sees. No identifying information about you is sent — it's just a request for public metadata.

### To Chrome's on-device AI
The title and channel get classified by Gemini Nano, which **runs entirely on your device**. Nothing about the video, your settings, or your activity is sent to Google during this step.

### To Syte's database (Supabase)
If the **"Share classified-reel data"** toggle is on (default ON, can be turned off in options), every classification is sent to a database we maintain at supabase.co. Each upload includes:
- Your random anonymous install ID
- The videoId, title, channel of the YouTube Short
- The verdict (Junk or Stay) and what strictness level / custom rule produced it
- A timestamp

We use this data to:
- Understand which kinds of reels people skip most
- Improve the default classification rubric
- See whether the product is being used

We do NOT collect:
- Your name, email, Google account, or any other personally identifying information
- Your IP address (Supabase logs may incidentally store one for short periods; we don't query it)
- Your browsing history outside YouTube Shorts
- Audio, video, or screen content

## How to opt out
Open the Syte options page → toggle off **"Share classified-reel data"**. From that moment, no further uploads happen. Your local log is still kept on your device for the popup's "Recent reels" view.

## How to delete your data
Email the project maintainer with your install ID (find it in `chrome://extensions` → Syte → service worker console → run `chrome.storage.local.get('syte.installId', console.log)`). Your rows will be deleted from the database within a reasonable timeframe.

## Where the database lives
Supabase, hosted on AWS in Virginia, USA.

## Who runs this
A solo developer. Source code is open: <https://github.com/mkiran2010/syte>

## Contact
For privacy questions, deletion requests, or anything else: open an issue on GitHub.
