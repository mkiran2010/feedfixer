import type { VideoMeta, Verdict, SessionStats, Settings } from "./types";

export type Msg =
  | { kind: "score-request"; videos: VideoMeta[] }
  | { kind: "verdict-request"; videoId: string; score: number }
  | { kind: "get-settings" }
  | { kind: "set-settings"; settings: Partial<Settings> }
  | { kind: "get-stats" }
  | { kind: "reset-stats" }
  | { kind: "reset-cache" }
  | { kind: "get-last-error" };

export type Reply =
  | { kind: "scores"; scores: Record<string, { score: number; reason?: string }> }
  | { kind: "verdict"; videoId: string; verdict: Verdict }
  | { kind: "settings"; settings: Settings }
  | { kind: "stats"; stats: SessionStats }
  | { kind: "last-error"; error: string | null; at: number | null }
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
