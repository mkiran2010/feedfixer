import { send } from "../shared/messages";
import { extractActiveShort } from "./extractors";

const PROCESSED = new WeakSet<Element>();
const GRACE_MS = 250;
let overlay: HTMLDivElement | null = null;
let overlayTimer: ReturnType<typeof setTimeout> | null = null;
let pendingSkip: { videoId: string; cancel: () => void } | null = null;

function ensureOverlay(): HTMLDivElement {
  if (overlay) return overlay;
  overlay = document.createElement("div");
  overlay.id = "feedfixer-shorts-overlay";
  overlay.textContent = "Skipping junk in 250ms — tap to keep watching";
  overlay.addEventListener("click", () => {
    pendingSkip?.cancel();
    hideOverlay();
  });
  document.documentElement.appendChild(overlay);
  return overlay;
}

function showOverlay() {
  ensureOverlay().classList.add("visible");
  if (overlayTimer) clearTimeout(overlayTimer);
  overlayTimer = setTimeout(hideOverlay, 1500);
}

function hideOverlay() {
  overlay?.classList.remove("visible");
}

/**
 * Try every known way to advance the YouTube Shorts feed by one.
 * Returns the method that succeeded, or null if all failed.
 */
export function skipCurrentShort(): string | null {
  // 1. Click YouTube's own down navigation button (most reliable — triggers their own handler)
  const navButton = document.querySelector<HTMLElement>(
    "#navigation-button-down button, " +
      "ytd-shorts button[aria-label*='Next video' i], " +
      "ytd-shorts button[aria-label*='Next short' i]",
  );
  if (navButton) {
    navButton.click();
    return "nav-button";
  }

  // 2. Dispatch synthetic ArrowDown keydown
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
    // also dispatch on document for sites that listen there
    document.dispatchEvent(ev);
    return "keydown";
  }

  // 3. Last resort: scroll the next reel into view
  const active = document.querySelector("ytd-reel-video-renderer[is-active]");
  const next = active?.nextElementSibling;
  if (next instanceof HTMLElement) {
    next.scrollIntoView({ behavior: "smooth", block: "start" });
    return "scrollIntoView";
  }

  return null;
}

function dispatchSkip() {
  skipCurrentShort();
}

async function processActive(reel: Element) {
  if (PROCESSED.has(reel)) return;
  PROCESSED.add(reel);

  const meta = extractActiveShort(reel);
  if (!meta) return;

  let scoresReply;
  try {
    scoresReply = await send({ kind: "score-request", videos: [meta] });
  } catch {
    return;
  }
  if (scoresReply.kind !== "scores") return;
  const hit = scoresReply.scores[meta.videoId];
  if (!hit) return;

  let verdict;
  try {
    verdict = await send({
      kind: "verdict-request",
      videoId: meta.videoId,
      score: hit.score,
    });
  } catch {
    return;
  }
  if (verdict.kind !== "verdict" || verdict.verdict !== "hide") return;

  // Junk + over quota — auto-skip with grace period
  let cancelled = false;
  showOverlay();
  pendingSkip = {
    videoId: meta.videoId,
    cancel: () => {
      cancelled = true;
    },
  };
  setTimeout(() => {
    if (!cancelled && document.querySelector("ytd-reel-video-renderer[is-active]") === reel) {
      console.log(`[feedfixer] skipping short ${meta.videoId} (score=${hit.score})`);
      dispatchSkip();
    }
    pendingSkip = null;
  }, GRACE_MS);
}

export function startShortsObserver() {
  const tick = () => {
    const active = document.querySelector("ytd-reel-video-renderer[is-active]");
    if (active) void processActive(active);
  };
  tick();
  const obs = new MutationObserver(() => tick());
  obs.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["is-active"],
  });
}
