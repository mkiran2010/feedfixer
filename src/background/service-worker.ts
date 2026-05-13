import type { Msg, Reply } from "../shared/messages";
import type { ScoredReel } from "../shared/types";
import { loadSettings, saveSettings } from "../shared/settings";
import { fetchMeta, scoreReel } from "./scorer";

const LAST_VERDICT_KEY = "feedfixer.lastVerdict";
const LAST_ERROR_KEY = "feedfixer.lastError";

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

async function handleScoreReel(videoId: string): Promise<ScoredReel> {
  const settings = await loadSettings();
  const meta = await fetchMeta(videoId);
  console.log(`[feedfixer] scoring ${videoId}: "${meta.title}" / ${meta.channel}`);
  const result = await scoreReel(meta, settings);
  await recordVerdict(result);
  await clearError();
  console.log(`[feedfixer] verdict ${videoId}: ${result.verdict} — ${result.reason}`);
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
      return { kind: "verdict", result, autoSkipEnabled: settings.autoSkipEnabled };
    }
    case "get-settings":
      return { kind: "settings", settings: await loadSettings() };
    case "set-settings":
      return { kind: "settings", settings: await saveSettings(msg.settings) };
    case "get-last-verdict":
      return { kind: "last-verdict", result: await readLastVerdict() };
    case "get-last-error":
      return { kind: "last-error", error: await readError() };
  }
}

console.log("[feedfixer] service worker ready");
