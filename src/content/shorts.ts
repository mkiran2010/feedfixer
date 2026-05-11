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

function dispatchSkip() {
  document.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "ArrowDown",
      code: "ArrowDown",
      keyCode: 40,
      which: 40,
      bubbles: true,
    }),
  );
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
