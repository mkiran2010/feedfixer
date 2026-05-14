import { detectPlatform } from "./platforms";
import { startReelWatcher } from "./shorts";

const platform = detectPlatform();
console.log(`[syte] content script loaded on ${window.location.pathname} — platform: ${platform}`);

switch (platform) {
  case "youtube":
    startReelWatcher();
    break;
  case "tiktok":
  case "instagram":
  case "x":
    console.log(
      `[syte] platform "${platform}" detected but not yet implemented — see src/content/platforms.ts. ` +
        `Need: DOM selectors for the active video, a way to advance to the next, and metadata extraction (title + author).`,
    );
    break;
  case "unknown":
    // Content script injected on a host we don't recognize — no-op
    break;
}
