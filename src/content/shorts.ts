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

// Auto-advance-on-end state — one listener at a time
let endWatchVideo: HTMLVideoElement | null = null;
let endWatchHandler: (() => void) | null = null;
let endWatchVideoId: string | null = null;
let lastTimeForLoopDetect = 0;

function detachEndWatcher(): void {
  if (endWatchVideo && endWatchHandler) {
    endWatchVideo.removeEventListener("timeupdate", endWatchHandler);
  }
  endWatchVideo = null;
  endWatchHandler = null;
  endWatchVideoId = null;
  lastTimeForLoopDetect = 0;
}

function attachEndWatcher(videoId: string): void {
  detachEndWatcher();
  const video = document.querySelector<HTMLVideoElement>(
    "ytd-reel-video-renderer[is-active] video",
  );
  if (!video) {
    console.log(`[feedfixer] no active <video> to watch for ${videoId}`);
    return;
  }
  endWatchVideo = video;
  endWatchVideoId = videoId;
  lastTimeForLoopDetect = video.currentTime;

  endWatchHandler = () => {
    if (!endWatchVideo || endWatchVideoId !== videoId) return;
    if (currentShortIdFromUrl() !== videoId) {
      detachEndWatcher();
      return;
    }
    const t = endWatchVideo.currentTime;
    const dur = endWatchVideo.duration;
    const looped = t < lastTimeForLoopDetect - 1; // currentTime jumped backward
    const nearEnd = isFinite(dur) && dur > 0 && dur - t < 0.25;
    lastTimeForLoopDetect = t;
    if (looped || nearEnd) {
      console.log(`[feedfixer] reel ${videoId} ended (looped=${looped} nearEnd=${nearEnd}) — advancing`);
      const method = skipCurrentShort();
      console.log(`[feedfixer] auto-advance via ${method}`);
      detachEndWatcher();
    }
  };

  video.addEventListener("timeupdate", endWatchHandler);
  console.log(`[feedfixer] end-watcher attached to ${videoId}`);
}

async function triggerScore(videoId: string): Promise<void> {
  if (scoredIds.has(videoId)) return;
  scoredIds.add(videoId);
  console.log(`[feedfixer] requesting score for ${videoId}`);
  let reply;
  try {
    reply = await send({ kind: "score-reel", videoId });
  } catch (err) {
    console.error(`[feedfixer] score-reel failed for ${videoId}:`, err);
    return;
  }
  if (reply.kind !== "verdict") {
    console.warn(`[feedfixer] unexpected reply for ${videoId}:`, reply);
    return;
  }
  const { verdict } = reply.result;
  console.log(`[feedfixer] ${videoId} → ${verdict}`);
  if (
    verdict === "Junk" &&
    reply.autoSkipEnabled &&
    currentShortIdFromUrl() === videoId
  ) {
    const method = skipCurrentShort();
    console.log(`[feedfixer] auto-skipped ${videoId} via ${method}`);
    return;
  }

  // Stay verdict — set up auto-advance-on-end if the user enabled it
  let settings;
  try {
    const r = await send({ kind: "get-settings" });
    settings = r.kind === "settings" ? r.settings : null;
  } catch {
    settings = null;
  }
  if (settings?.autoAdvanceOnEnd && currentShortIdFromUrl() === videoId) {
    // Defer slightly so the active <video> for this reel is in DOM
    setTimeout(() => attachEndWatcher(videoId), 250);
  }
}

function checkForNewActiveReel(): void {
  const id = currentShortIdFromUrl();
  if (!id) {
    detachEndWatcher();
    return;
  }
  if (id === lastTriggeredId) return;
  lastTriggeredId = id;
  detachEndWatcher();

  if (triggerTimer) clearTimeout(triggerTimer);
  triggerTimer = setTimeout(() => {
    triggerTimer = null;
    void triggerScore(id);
  }, 400);
}

export function startReelWatcher(): void {
  checkForNewActiveReel();
  document.addEventListener("yt-navigate-finish", checkForNewActiveReel);
  window.addEventListener("popstate", checkForNewActiveReel);
  setInterval(checkForNewActiveReel, 500);
}
