import type { TabMsg, TabReply } from "../shared/messages";
import { startHomepageObserver } from "./homepage";
import { skipCurrentShort, startShortsObserver } from "./shorts";

function injectStyles() {
  const id = "feedfixer-styles";
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = chrome.runtime.getURL("src/content/inject.css");
  document.documentElement.appendChild(link);
}

function boot() {
  injectStyles();

  const path = window.location.pathname;
  // Homepage observer covers home, /feed/*, watch sidebar, channel pages — anywhere tiles render.
  startHomepageObserver();

  if (path.startsWith("/shorts/")) {
    startShortsObserver();
  }

  console.log(`[feedfixer] booted on ${path}`);
}

// YouTube is a SPA — re-detect the surface on navigation.
let lastPath = "";
function checkPath() {
  const path = window.location.pathname;
  if (path === lastPath) return;
  lastPath = path;
  if (path.startsWith("/shorts/")) startShortsObserver();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}

document.addEventListener("yt-navigate-finish", checkPath);
window.addEventListener("popstate", checkPath);

chrome.runtime.onMessage.addListener(
  (msg: TabMsg, _sender, sendResponse: (reply: TabReply) => void) => {
    if (msg.kind === "manual-skip") {
      const method = skipCurrentShort();
      if (method) {
        console.log(`[feedfixer] manual skip via ${method}`);
        sendResponse({ kind: "skipped", method });
      } else {
        sendResponse({
          kind: "skip-failed",
          reason: "no active short found and no skip method worked",
        });
      }
      return true;
    }
    return false;
  },
);
