import { send } from "../shared/messages";

const REEL_ID_RE = /^\/reels?\/([A-Za-z0-9_-]+)/;

function currentReelId(): string | null {
  const m = REEL_ID_RE.exec(window.location.pathname);
  return m ? m[1] : null;
}

/**
 * Try every known way to advance the Instagram Reels feed by one.
 * Returns the selector / method that succeeded, or null if none did.
 */
export function skipInstagramReel(): string | null {
  const selectors = [
    'button[aria-label="Next"]',
    'button[aria-label*="Next" i]',
    '[role="button"][aria-label*="Next" i]',
    'svg[aria-label*="Next" i]',
    'button[aria-label*="below" i]',
    'button[aria-label*="down" i]',
  ];
  for (const sel of selectors) {
    const el = document.querySelector<HTMLElement>(sel);
    if (!el) continue;
    const target = el.tagName.toLowerCase() === "svg"
      ? (el.closest("button, [role='button'], a") as HTMLElement | null) ?? el
      : el;
    target.click();
    return sel;
  }
  // Fallback: ArrowDown
  const ev = new KeyboardEvent("keydown", {
    key: "ArrowDown",
    code: "ArrowDown",
    keyCode: 40,
    which: 40,
    bubbles: true,
    cancelable: true,
    composed: true,
  });
  if (document.body.dispatchEvent(ev)) {
    document.dispatchEvent(ev);
    return "keydown";
  }
  return null;
}

/** Find the <video> closest to the viewport center. That's the active reel. */
function findActiveVideo(): HTMLVideoElement | null {
  const videos = Array.from(document.querySelectorAll<HTMLVideoElement>("video"));
  if (videos.length === 0) return null;
  const viewportCenter = window.innerHeight / 2;
  let best: HTMLVideoElement | null = null;
  let bestDistance = Infinity;
  for (const v of videos) {
    const rect = v.getBoundingClientRect();
    if (rect.height === 0 || rect.bottom < 0 || rect.top > window.innerHeight) continue;
    const center = rect.top + rect.height / 2;
    const distance = Math.abs(center - viewportCenter);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = v;
    }
  }
  return best;
}

/**
 * Walk up from the active video looking for the tightest container that
 * looks like a single reel (not the whole feed, not a sidebar).
 * Heuristic: container is taller than half the viewport but narrower than 700px.
 */
function findReelContainer(video: HTMLVideoElement): HTMLElement | null {
  let cur: HTMLElement | null = video.parentElement;
  while (cur && cur !== document.body) {
    const r = cur.getBoundingClientRect();
    const tallEnough = r.height > window.innerHeight * 0.5;
    const notTooWide = r.width < 700;
    const hasUsernameLink = !!cur.querySelector('a[href^="/"][href$="/"]');
    if (tallEnough && notTooWide && hasUsernameLink) return cur;
    cur = cur.parentElement;
  }
  return null;
}

/** Extract caption + author from a scoped reel container. */
function extractActiveReelMeta(): { title: string; channel: string } | null {
  const video = findActiveVideo();
  if (!video) return null;
  const container = findReelContainer(video);
  if (!container) return null;

  // Author: first profile link inside the scoped container
  let channel = "(unknown)";
  const profileLink = container.querySelector<HTMLAnchorElement>('a[href^="/"][href$="/"]');
  if (profileLink) {
    const m = profileLink.getAttribute("href")?.match(/^\/([^/]+)\//);
    if (m) channel = `@${m[1]}`;
  }

  // Caption: prefer elements with dir="auto" (Instagram's marker for user-typed text).
  // Fall back to spans/h1s within the container. Filter out music attribution and counts.
  const candidates: string[] = [];
  for (const el of container.querySelectorAll<HTMLElement>('[dir="auto"], h1, h2, span')) {
    const text = (el.innerText || "").trim();
    if (text.length < 5 || text.length > 500) continue;
    if (/^@\w+$/.test(text)) continue;                     // pure @handle
    if (/^\d+(\.\d+)?[KkMm]?$/.test(text)) continue;       // counts (29K, 1.2M)
    if (/·\s*\w/.test(text)) continue;                     // music attribution ("artist · song")
    if (/^(follow|like|comment|share|save|more|remix|sound|view|reply|translate|see translation)$/i.test(text)) continue;
    candidates.push(text);
  }
  candidates.sort((a, b) => b.length - a.length);
  const title = candidates[0] ?? "(no caption)";

  return { title, channel };
}

const scoredIds = new Set<string>();
let lastTriggeredId: string | null = null;
let triggerTimer: ReturnType<typeof setTimeout> | null = null;

async function triggerScore(videoId: string): Promise<void> {
  if (scoredIds.has(videoId)) return;
  const meta = extractActiveReelMeta();
  if (!meta) {
    console.warn(`[syte] no metadata extractable for ${videoId} — skipping score`);
    return;
  }
  console.log(`[syte] scoring instagram ${videoId}: "${meta.title.slice(0, 60)}" / ${meta.channel}`);
  let reply;
  try {
    reply = await send({
      kind: "score-meta",
      videoId,
      title: meta.title,
      channel: meta.channel,
      platform: "instagram",
    });
  } catch (err) {
    console.error(`[syte] score-meta failed for ${videoId}:`, err);
    return;
  }
  if (reply.kind !== "verdict") {
    console.warn(`[syte] unexpected reply for ${videoId}:`, reply);
    return;
  }
  scoredIds.add(videoId);
  const { verdict } = reply.result;
  console.log(`[syte] ${videoId} → ${verdict}`);
  if (verdict === "Junk" && reply.autoSkipEnabled && currentReelId() === videoId) {
    const method = skipInstagramReel();
    console.log(`[syte] auto-skipped junk ${videoId} via ${method}`);
  }
}

function checkForNewActiveReel(): void {
  const id = currentReelId();
  if (!id) return;
  if (id === lastTriggeredId) return;
  console.log(`[syte] new active instagram reel: ${id}`);
  lastTriggeredId = id;
  if (triggerTimer) clearTimeout(triggerTimer);
  triggerTimer = setTimeout(() => {
    triggerTimer = null;
    void triggerScore(id);
  }, 400); // Insta DOM takes a moment to settle on a new reel
}

export function startInstagramWatcher(): void {
  checkForNewActiveReel();
  window.addEventListener("popstate", checkForNewActiveReel);
  setInterval(checkForNewActiveReel, 500);
}
