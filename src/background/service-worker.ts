import type { Msg, Reply } from "../shared/messages";
import type { Score, Settings, VideoMeta } from "../shared/types";
import { loadSettings, saveSettings } from "../shared/settings";
import { clearCache, getScores, putScores } from "./cache";
import { scoreBatch } from "./scorer";
import { bumpScoreRequest, decide, loadStats, resetStats } from "./token-bucket";

const BATCH_DELAY_MS = 250;
const BATCH_MAX = 20;
const ERROR_KEY = "feedfixer.lastError";

async function recordError(message: string): Promise<void> {
  await chrome.storage.session.set({
    [ERROR_KEY]: { error: message, at: Date.now() },
  });
}

async function clearError(): Promise<void> {
  await chrome.storage.session.remove(ERROR_KEY);
}

async function readError(): Promise<{ error: string | null; at: number | null }> {
  const got = await chrome.storage.session.get(ERROR_KEY);
  const v = got[ERROR_KEY] as { error: string; at: number } | undefined;
  return v ? { error: v.error, at: v.at } : { error: null, at: null };
}

interface PendingItem {
  meta: VideoMeta;
  resolve: (score: number) => void;
  reject: (err: Error) => void;
}

const pending = new Map<string, PendingItem>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flush();
  }, BATCH_DELAY_MS);
}

async function flush(): Promise<void> {
  if (pending.size === 0) return;

  const settings = await loadSettings();
  if (!settings.enabled || isPaused(settings)) {
    for (const item of pending.values()) item.resolve(75);
    pending.clear();
    return;
  }

  const items = Array.from(pending.values()).slice(0, BATCH_MAX);
  for (const item of items) pending.delete(item.meta.videoId);

  try {
    const scores = await scoreBatch(items.map((i) => i.meta), settings);
    await putScores(scores);
    const byId = new Map(scores.map((s) => [s.videoId, s.score]));
    for (const item of items) {
      item.resolve(byId.get(item.meta.videoId) ?? 50);
    }
    await clearError();
    console.log(
      `[feedfixer] scored ${scores.length} videos`,
      scores.map((s) => `${s.videoId}=${s.score}`).join(" "),
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[feedfixer] scoring failed:", err);
    await recordError(msg);
    for (const item of items) item.reject(new Error(msg));
  }

  if (pending.size > 0) scheduleFlush();
}

function isPaused(s: Settings): boolean {
  return s.pausedUntil !== null && s.pausedUntil > Date.now();
}

async function getOrScore(metas: VideoMeta[]): Promise<Map<string, { score: number; reason?: string }>> {
  const settings = await loadSettings();
  const out = new Map<string, { score: number; reason?: string }>();

  if (!settings.enabled || isPaused(settings)) {
    for (const m of metas) out.set(m.videoId, { score: 75 });
    return out;
  }

  if (settings.debugForceJunk) {
    for (const m of metas) out.set(m.videoId, { score: 0, reason: "debug: forced junk" });
    return out;
  }

  const cached = await getScores(
    metas.map((m) => m.videoId),
    settings.rubricVersion,
  );
  const need: VideoMeta[] = [];
  for (const m of metas) {
    const hit = cached.get(m.videoId);
    if (hit) {
      out.set(m.videoId, { score: hit.score, reason: hit.reason });
    } else {
      need.push(m);
    }
  }

  if (need.length === 0) return out;

  const promises = need.map(
    (m) =>
      new Promise<Score>((resolve, reject) => {
        const existing = pending.get(m.videoId);
        if (existing) {
          // duplicate request — chain on the existing one
          const prevResolve = existing.resolve;
          existing.resolve = (score: number) => {
            prevResolve(score);
            resolve({
              videoId: m.videoId,
              score,
              scoredAt: Date.now(),
              rubricVersion: settings.rubricVersion,
              model: settings.model,
            });
          };
          return;
        }
        pending.set(m.videoId, {
          meta: m,
          resolve: (score) =>
            resolve({
              videoId: m.videoId,
              score,
              scoredAt: Date.now(),
              rubricVersion: settings.rubricVersion,
              model: settings.model,
            }),
          reject,
        });
      }),
  );

  scheduleFlush();
  const fresh = await Promise.allSettled(promises);
  for (let i = 0; i < fresh.length; i++) {
    const r = fresh[i];
    if (r.status === "fulfilled") {
      out.set(r.value.videoId, { score: r.value.score, reason: r.value.reason });
    } else {
      out.set(need[i].videoId, { score: 75 });
    }
  }
  return out;
}

chrome.runtime.onMessage.addListener((msg: Msg, _sender, sendResponse) => {
  void (async () => {
    try {
      const reply = await handle(msg);
      sendResponse(reply);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      sendResponse({ kind: "error", message } satisfies Reply);
    }
  })();
  return true;
});

async function handle(msg: Msg): Promise<Reply> {
  switch (msg.kind) {
    case "score-request": {
      await bumpScoreRequest(msg.videos.length);
      const map = await getOrScore(msg.videos);
      const scores: Record<string, { score: number; reason?: string }> = {};
      for (const [k, v] of map) scores[k] = v;
      return { kind: "scores", scores };
    }
    case "verdict-request": {
      const settings = await loadSettings();
      if (!settings.enabled || isPaused(settings)) {
        return { kind: "verdict", videoId: msg.videoId, verdict: "allow" };
      }
      const verdict = await decide(
        msg.score,
        settings.junkPct,
        settings.junkThreshold,
      );
      return { kind: "verdict", videoId: msg.videoId, verdict };
    }
    case "get-settings":
      return { kind: "settings", settings: await loadSettings() };
    case "set-settings":
      return { kind: "settings", settings: await saveSettings(msg.settings) };
    case "get-stats":
      return { kind: "stats", stats: await loadStats() };
    case "reset-stats":
      await resetStats();
      return { kind: "ok" };
    case "reset-cache":
      await clearCache();
      return { kind: "ok" };
    case "get-last-error": {
      const e = await readError();
      return { kind: "last-error", error: e.error, at: e.at };
    }
  }
}

console.log("[feedfixer] service worker ready");
