const KEY = "syte.installId";

/** Persistent random UUID per Chrome install. Generated once, never changes. */
export async function getInstallId(): Promise<string> {
  const got = await chrome.storage.local.get(KEY);
  const existing = got[KEY] as string | undefined;
  if (existing) return existing;
  const id = crypto.randomUUID();
  await chrome.storage.local.set({ [KEY]: id });
  return id;
}
