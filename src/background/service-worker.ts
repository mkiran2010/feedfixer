import type { Msg, Reply } from "../shared/messages";
import type { ScoredReel, SessionLock } from "../shared/types";
import { loadSettings, saveSettings } from "../shared/settings";
import { appendLog, clearLog, getLog } from "../shared/verdict-log";
import { checkLocalAI, fetchMeta, scoreReel, triggerLocalAIDownload } from "./scorer";

const LAST_VERDICT_KEY = "feedfixer.lastVerdict";
const LAST_ERROR_KEY = "feedfixer.lastError";
const LOCK_KEY = "feedfixer.lock";

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
  const meta = await fetchMeta(videoId);
  console.log(`[feedfixer] scoring ${videoId}: "${meta.title}" / ${meta.channel} @ level ${settings.currentLevel}`);
  const result = await scoreReel(meta, settings);
  await recordVerdict(result);
  await appendLog({
    videoId: meta.videoId,
    title: meta.title,
    channel: meta.channel,
    verdict: result.verdict,
    level: settings.currentLevel,
    customRule: settings.useCustomInstruction ? settings.customInstruction : null,
    scoredAt: result.scoredAt,
  });
  await ensureLocked(
    settings.currentLevel,
    settings.useCustomInstruction ? settings.customInstruction : null,
  );
  await clearError();
  console.log(`[feedfixer] verdict ${videoId}: ${result.verdict}`);
  return result;
}

chrome.runtime.onMessage.addListener((msg: Msg, _sender, sendResponse) => {
  void (async () => {
    try {
      const reply = await handle(msg);
      sendResponse(reply);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[feedfixer] handler error:", err);
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

console.log("[feedfixer] service worker ready (locality / local AI mode)");
