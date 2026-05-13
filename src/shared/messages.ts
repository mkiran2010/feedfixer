import type { LocalAIStatus, ScoredReel, SessionLock, Settings } from "./types";

/** Messages from popup / content script → service worker */
export type Msg =
  | { kind: "score-reel"; videoId: string }
  | { kind: "get-settings" }
  | { kind: "set-settings"; settings: Partial<Settings> }
  | { kind: "get-last-verdict" }
  | { kind: "get-last-error" }
  | { kind: "get-lock" }
  | { kind: "unlock-session" }
  | { kind: "check-local-ai" }
  | { kind: "trigger-local-ai-download" }
  | { kind: "get-verdict-log" }
  | { kind: "clear-verdict-log" };

export type Reply =
  | {
      kind: "verdict";
      result: ScoredReel;
      autoSkipEnabled: boolean;
      autoAdvanceOnEnd: boolean;
    }
  | { kind: "settings"; settings: Settings }
  | { kind: "last-verdict"; result: ScoredReel | null }
  | { kind: "last-error"; error: string | null }
  | { kind: "lock"; lock: SessionLock | null }
  | { kind: "local-ai-status"; status: LocalAIStatus }
  | { kind: "verdict-log"; entries: VerdictLogEntry[] }
  | { kind: "ok" }
  | { kind: "error"; message: string };

export interface VerdictLogEntry {
  videoId: string;
  title: string;
  channel: string;
  verdict: "Junk" | "Stay";
  level: number;
  customRule: string | null;
  scoredAt: number;
}

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
