import { startHomepageObserver } from "./homepage";
import { startShortsObserver } from "./shorts";

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
