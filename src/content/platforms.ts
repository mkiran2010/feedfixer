export type Platform = "youtube" | "tiktok" | "instagram" | "x" | "unknown";

export function detectPlatform(): Platform {
  const h = window.location.hostname;
  if (/(?:^|\.)youtube\.com$/.test(h)) return "youtube";
  if (/(?:^|\.)tiktok\.com$/.test(h)) return "tiktok";
  if (/(?:^|\.)instagram\.com$/.test(h)) return "instagram";
  if (/(?:^|\.)x\.com$/.test(h) || /(?:^|\.)twitter\.com$/.test(h)) return "x";
  return "unknown";
}
