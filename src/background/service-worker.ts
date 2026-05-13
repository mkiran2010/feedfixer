import type { Msg, Reply } from "../shared/messages";
import type { ScoredReel, SessionLock } from "../shared/types";
import { loadSettings, saveSettings } from "../shared/settings";
import { appendLog, clearLog, getLog } from "../shared/verdict-log";
import { checkLocalAI, fetchMeta, scoreReel, triggerLocalAIDownload } from "./scorer";
import { uploadVerdict } from "./upload";

const LAST_VERDICT_KEY = "syte.lastVerdict";
const LAST_ERROR_KEY = "syte.lastError";
const LOCK_KEY = "syte.lock";

async function recordVerdict(v: ScoredReel): Promise<void> {
  await chrome.storage.session.set({ [LAST_VERDICT_KEY]: v });
}

async function readLastVerdict(): Promise<ScoredReel | null> {
  const got = await chrome.storage.session.get(LAST_VERDICT_KEY);
  return (got[LAST_VERDICT_KEY] as ScoredReel | undefined) ?? null;
}

async function recordError(message: string): Promise<void> {
  await chrome.storage.session.set({ [LAST_ERROR_KEY]: message });
}

async function clearError(): Promise<void> {
  await chrome.storage.session.remove(LAST_ERROR_KEY);
}

async function readError(): Promise<string | null> {
  const got = await chrome.storage.session.get(LAST_ERROR_KEY);
  return (got[LAST_ERROR_KEY] as string | undefined) ?? null;
}

async function readLock(): Promise<SessionLock | null> {
  const got = await chrome.storage.session.get(LOCK_KEY);
  return (got[LOCK_KEY] as SessionLock | undefined) ?? null;
}

async function ensureLocked(
  currentLevel: number,
  customInstructionAtLock: string | null,
): Promise<void> {
  const existing = await readLock();
  if (existing) return;
  const lock: SessionLock = {
    lockedAt: Date.now(),
    lockedAtLevel: currentLevel,
    customInstructionAtLock,
  };
  await chrome.storage.session.set({ [LOCK_KEY]: lock });
}

async function unlockSession(): Promise<void> {
  await chrome.storage.session.remove(LOCK_KEY);
}

async function handleScoreReel(videoId: string): Promise<ScoredReel> {
  const settings = await loadSettings();

  // oEmbed refuses some videos (age-restricted, region-blocked, private).
  // Default those to Stay so we don't auto-skip something we couldn't classify.
  let meta;
  try {
    meta = await fetchMeta(videoId);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.warn(`[syte] oembed refused ${videoId} (${reason}) — defaulting to Stay`);
    const result: ScoredReel = {
      videoId,
      verdict: "Stay",
      reason: `metadata unavailable (${reason})`,
      scoredAt: Date.now(),
    };
    const logEntry = {
      videoId,
      title: "(metadata unavailable)",
      channel: "(unknown)",
      verdict: "Stay" as const,
      level: settings.currentLevel,
      customRule: settings.useCustomInstruction ? settings.customInstruction : null,
      scoredAt: result.scoredAt,
    };
    await recordVerdict(result);
    await appendLog(logEntry);
    if (settings.uploadEnabled) void uploadVerdict(logEntry);
    return result;
  }

  console.log(`[syte] scoring ${videoId}: "${meta.title}" / ${meta.channel} @ level ${settings.currentLevel}`);
  const result = await scoreReel(meta, settings);
  const logEntry = {
    videoId: meta.videoId,
    title: meta.title,
    channel: meta.channel,
    verdict: result.verdict,
    level: settings.currentLevel,
    customRule: settings.useCustomInstruction ? settings.customInstruction : null,
    scoredAt: result.scoredAt,
  };
  await recordVerdict(result);
  await appendLog(logEntry);
  if (settings.uploadEnabled) void uploadVerdict(logEntry);
  await ensureLocked(
    settings.currentLevel,
    settings.useCustomInstruction ? settings.customInstruction : null,
  );
  await clearError();
  console.log(`[syte] verdict ${videoId}: ${result.verdict}`);
  return result;
}

chrome.runtime.onMessage.addListener((msg: Msg, _sender, sendResponse) => {
  void (async () => {
    try {
      const reply = await handle(msg);
      sendResponse(reply);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[syte] handler error:", err);
      await recordError(message);
      sendResponse({ kind: "error", message } satisfies Reply);
    }
  })();
  return true;
});

async function handle(msg: Msg): Promise<Reply> {
  switch (msg.kind) {
    case "score-reel": {
      const result = await handleScoreReel(msg.videoId);
      const settings = await loadSettings();
      return {
        kind: "verdict",
        result,
        autoSkipEnabled: settings.autoSkipEnabled,
        autoAdvanceOnEnd: settings.autoAdvanceOnEnd,
      };
    }
    case "get-settings":
      return { kind: "settings", settings: await loadSettings() };
    case "set-settings": {
      const lock = await readLock();
      if (lock) {
        const blocked: (keyof typeof msg.settings)[] = [
          "currentLevel",
          "stages",
          "useCustomInstruction",
          "customInstruction",
        ];
        for (const k of blocked) {
          if (k in msg.settings) {
            return {
              kind: "error",
              message: `${k} is locked for this session — unlock first`,
            };
          }
        }
      }
      return { kind: "settings", settings: await saveSettings(msg.settings) };
    }
    case "get-last-verdict":
      return { kind: "last-verdict", result: await readLastVerdict() };
    case "get-last-error":
      return { kind: "last-error", error: await readError() };
    case "get-lock":
      return { kind: "lock", lock: await readLock() };
    case "unlock-session":
      await unlockSession();
      return { kind: "ok" };
    case "check-local-ai":
      return { kind: "local-ai-status", status: await checkLocalAI() };
    case "trigger-local-ai-download":
      return { kind: "local-ai-status", status: await triggerLocalAIDownload() };
    case "get-verdict-log":
      return { kind: "verdict-log", entries: await getLog() };
    case "clear-verdict-log":
      await clearLog();
      return { kind: "ok" };
  }
}

console.log("[syte] service worker ready (locality / local AI mode)");
