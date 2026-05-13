import type { ScoredReel, Settings } from "./types";

/** Messages from popup → content script (via chrome.tabs.sendMessage) */
export type TabMsg = { kind: "manual-skip" };
export type TabReply =
  | { kind: "skipped"; method: string }
  | { kind: "skip-failed"; reason: string };

/** Messages from content script / popup → service worker (via chrome.runtime.sendMessage) */
export type Msg =
  | { kind: "score-reel"; videoId: string }
  | { kind: "get-settings" }
  | { kind: "set-settings"; settings: Partial<Settings> }
  | { kind: "get-last-verdict" }
  | { kind: "get-last-error" };

export type Reply =
  | { kind: "verdict"; result: ScoredReel; autoSkipEnabled: boolean }
  | { kind: "settings"; settings: Settings }
  | { kind: "last-verdict"; result: ScoredReel | null }
  | { kind: "last-error"; error: string | null }
  | { kind: "ok" }
  | { kind: "error"; message: string };

export function send<R extends Reply = Reply>(msg: Msg): Promise<R> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(msg, (reply: R | undefined) => {
      const err = chrome.runtime.lastError;
      if (err) {
        reject(new Error(err.message));
        return;
      }
      if (!reply) {
        reject(new Error("no reply"));
        return;
      }
      resolve(reply);
    });
  });
}
