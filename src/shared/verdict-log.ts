import type { VerdictLogEntry } from "./messages";

const KEY = "syte.verdictLog";
const MAX_ENTRIES = 1000;

export async function getLog(): Promise<VerdictLogEntry[]> {
  const got = await chrome.storage.local.get(KEY);
  return (got[KEY] as VerdictLogEntry[] | undefined) ?? [];
}

export async function appendLog(entry: VerdictLogEntry): Promise<void> {
  const existing = await getLog();
  const next = [...existing, entry];
  // Roll oldest entries off so we don't overflow chrome.storage.local quota
  const trimmed = next.length > MAX_ENTRIES ? next.slice(-MAX_ENTRIES) : next;
  await chrome.storage.local.set({ [KEY]: trimmed });
}

export async function clearLog(): Promise<void> {
  await chrome.storage.local.remove(KEY);
}
