import { DEFAULT_SETTINGS, type Settings } from "./types";

const KEY = "feedfixer.settings";

export async function loadSettings(): Promise<Settings> {
  const got = await chrome.storage.local.get(KEY);
  const stored = got[KEY] as Partial<Settings> | undefined;
  return { ...DEFAULT_SETTINGS, ...(stored ?? {}) };
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const current = await loadSettings();
  const next: Settings = { ...current, ...patch };
  if (patch.rubric !== undefined && patch.rubric !== current.rubric) {
    next.rubricVersion = current.rubricVersion + 1;
  }
  await chrome.storage.local.set({ [KEY]: next });
  return next;
}
