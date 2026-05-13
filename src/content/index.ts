import { startReelWatcher } from "./shorts";

console.log(`[feedfixer] content script loaded on ${window.location.pathname}`);

// Watcher is idempotent on non-shorts pages (it no-ops when URL isn't /shorts/),
// so always start it — that way SPA navigation INTO /shorts/ is covered too.
startReelWatcher();
