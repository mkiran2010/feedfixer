import { send } from "../shared/messages";

/**
 * Try every known way to advance the YouTube Shorts feed by one.
 * Returns the method that succeeded, or null if all failed.
 */
export function skipCurrentShort(): string | null {
  const navButton = document.querySelector<HTMLElement>(
    "#navigation-button-down button, " +
      "ytd-shorts button[aria-label*='Next video' i], " +
      "ytd-shorts button[aria-label*='Next short' i]",
  );
  if (navButton) {
    navButton.click();
    return "nav-button";
  }

  const target = document.activeElement instanceof HTMLElement ? document.activeElement : document.body;
  const ev = new KeyboardEvent("keydown", {
    key: "ArrowDown",
    code: "ArrowDown",
    keyCode: 40,
    which: 40,
    bubbles: true,
    cancelable: true,
    composed: true,
  });
  const accepted = target.dispatchEvent(ev);
  if (accepted) {
    document.dispatchEvent(ev);
    return "keydown";
  }

  const active = document.querySelector("ytd-reel-video-renderer[is-active]");
  const next = active?.nextElementSibling;
  if (next instanceof HTMLElement) {
    next.scrollIntoView({ behavior: "smooth", block: "start" });
    return "scrollIntoView";
  }

  return null;
}

const VIDEO_ID_RE = /^\/shorts\/([\w-]{11})/;

function currentShortIdFromUrl(): string | null {
  const m = VIDEO_ID_RE.exec(window.location.pathname);
  return m ? m[1] : null;
}

const scoredIds = new Set<string>();
let lastTriggeredId: string | null = null;
let triggerTimer: ReturnType<typeof setTimeout> | null = null;

async function triggerScore(videoId: string): Promise<void> {
  if (scoredIds.has(videoId)) return;
  scoredIds.add(videoId);
  console.log(`[feedfixer] requesting score for ${videoId}`);
  try {
    const reply = await send({ kind: "score-reel", videoId });
    if (reply.kind !== "verdict") {
      console.warn(`[feedfixer] unexpected reply for ${videoId}:`, reply);
      return;
    }
    const { verdict, reason } = reply.result;
    console.log(`[feedfixer] ${videoId} → ${verdict} (${reason})`);
    if (
      verdict === "Junk" &&
      reply.autoSkipEnabled &&
      currentShortIdFromUrl() === videoId
    ) {
      // Only skip if the user is still on this Short; don't yank them out of something they navigated to
      const method = skipCurrentShort();
      console.log(`[feedfixer] auto-skipped ${videoId} via ${method}`);
    }
  } catch (err) {
    console.error(`[feedfixer] score-reel failed for ${videoId}:`, err);
  }
}

function checkForNewActiveReel(): void {
  const id = currentShortIdFromUrl();
  if (!id) return;
  if (id === lastTriggeredId) return;
  lastTriggeredId = id;

  // Debounce — let YouTube settle on the new reel before scoring
  if (triggerTimer) clearTimeout(triggerTimer);
  triggerTimer = setTimeout(() => {
    triggerTimer = null;
    void triggerScore(id);
  }, 400);
}

export function startReelWatcher(): void {
  checkForNewActiveReel();

  // YouTube emits this on SPA nav between Shorts
  document.addEventListener("yt-navigate-finish", checkForNewActiveReel);
  window.addEventListener("popstate", checkForNewActiveReel);

  // Belt-and-suspenders: also poll every 500ms for URL changes the events miss
  setInterval(checkForNewActiveReel, 500);
}
