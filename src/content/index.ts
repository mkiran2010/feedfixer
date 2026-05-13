import type { TabMsg, TabReply } from "../shared/messages";
import { skipCurrentShort, startReelWatcher } from "./shorts";

console.log(`[feedfixer] content script loaded on ${window.location.pathname}`);

// Watcher is idempotent across non-shorts pages (it no-ops when URL isn't /shorts/),
// so always start it — that way SPA navigation INTO /shorts/ is covered too.
startReelWatcher();

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
