import { send } from "../shared/messages";

/** Try every known way to advance the YouTube Shorts feed by one. */
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
  if (target.dispatchEvent(ev)) {
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

function findActiveVideo(): HTMLVideoElement | null {
  // Prefer the marked-active reel; fall back to whichever <video> is currently playing
  const inActive = document.querySelector<HTMLVideoElement>(
    "ytd-reel-video-renderer[is-active] video",
  );
  if (inActive) return inActive;
  const allVideos = Array.from(document.querySelectorAll<HTMLVideoElement>("video"));
  return allVideos.find((v) => !v.paused && v.currentTime > 0) ?? null;
}

const scoredIds = new Set<string>();
let lastTriggeredId: string | null = null;
let triggerTimer: ReturnType<typeof setTimeout> | null = null;

// Auto-advance: poll-based watcher, attaches immediately on reel change, regardless of verdict
let watcherVideoId: string | null = null;
let watcherInterval: ReturnType<typeof setInterval> | null = null;
let watcherLastTime = 0;
let watcherFireCount = 0;

function detachWatcher(): void {
  if (watcherInterval) clearInterval(watcherInterval);
  watcherInterval = null;
  watcherVideoId = null;
  watcherLastTime = 0;
  watcherFireCount = 0;
}

function attachWatcher(videoId: string): void {
  detachWatcher();
  watcherVideoId = videoId;
  watcherFireCount = 0;
  console.log(`[feedfixer] attaching end-watcher for ${videoId}`);

  watcherInterval = setInterval(() => {
    if (watcherVideoId !== videoId) return;
    if (currentShortIdFromUrl() !== videoId) {
      console.log(`[feedfixer] reel changed away from ${videoId}, detaching watcher`);
      detachWatcher();
      return;
    }
    const video = findActiveVideo();
    if (!video) return;
    const t = video.currentTime;
    const dur = video.duration;
    if (!isFinite(dur) || dur <= 0) return;

    const looped = t < watcherLastTime - 1; // currentTime jumped backward by >1s
    const nearEnd = dur - t < 0.3;

    if (watcherFireCount === 0 && (looped || nearEnd)) {
      watcherFireCount++;
      console.log(
        `[feedfixer] reel ${videoId} ended (t=${t.toFixed(2)} dur=${dur.toFixed(2)} looped=${looped} nearEnd=${nearEnd}) — auto-advancing`,
      );
      const method = skipCurrentShort();
      console.log(`[feedfixer] auto-advance via ${method}`);
      detachWatcher();
      return;
    }

    watcherLastTime = t;
  }, 200);
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
    console.log(`[feedfixer] auto-skipped junk ${videoId} via ${method}`);
    detachWatcher(); // skip will trigger reel change which detaches anyway
    return;
  }

  if (!reply.autoAdvanceOnEnd) {
    console.log(`[feedfixer] auto-advance disabled, detaching watcher`);
    detachWatcher();
  }
}

function checkForNewActiveReel(): void {
  const id = currentShortIdFromUrl();
  if (!id) {
    detachWatcher();
    return;
  }
  if (id === lastTriggeredId) return;
  lastTriggeredId = id;

  // Attach the end-watcher IMMEDIATELY, don't wait for verdict.
  // It will be detached if score returns Junk (URL changes after skip) or if user navigates away.
  attachWatcher(id);

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
