import { send } from "../shared/messages";
import type { VideoMeta } from "../shared/types";
import { extractCompactItem, extractRichItem } from "./extractors";

const TILE_SELECTORS = [
  "ytd-rich-item-renderer",
  "ytd-compact-video-renderer",
  "ytd-grid-video-renderer",
];

const TILE_SELECTOR = TILE_SELECTORS.join(",");

const seen = new WeakMap<Element, string>();
let pendingScan = false;
let scanTimer: ReturnType<typeof setTimeout> | null = null;

function setState(tile: Element, state: "pending" | "allowed" | "hidden", score?: number) {
  tile.setAttribute("data-feedfixer-state", state);
  if (state === "allowed" && score !== undefined) {
    tile.setAttribute("data-feedfixer-score", String(score));
  }
}

function extract(tile: Element): VideoMeta | null {
  const tag = tile.tagName.toLowerCase();
  if (tag === "ytd-compact-video-renderer") return extractCompactItem(tile);
  return extractRichItem(tile);
}

async function processBatch(tiles: Element[]) {
  const items: { tile: Element; meta: VideoMeta }[] = [];
  for (const tile of tiles) {
    const meta = extract(tile);
    if (!meta) continue;
    if (seen.get(tile) === meta.videoId) continue;
    seen.set(tile, meta.videoId);
    setState(tile, "pending");
    items.push({ tile, meta });
  }
  if (items.length === 0) return;

  let scoresReply;
  try {
    scoresReply = await send({
      kind: "score-request",
      videos: items.map((i) => i.meta),
    });
  } catch (err) {
    console.warn("[feedfixer] score-request failed:", err);
    for (const { tile } of items) setState(tile, "allowed");
    return;
  }

  if (scoresReply.kind !== "scores") {
    for (const { tile } of items) setState(tile, "allowed");
    return;
  }

  for (const { tile, meta } of items) {
    const hit = scoresReply.scores[meta.videoId];
    if (!hit) {
      setState(tile, "allowed");
      continue;
    }
    try {
      const verdict = await send({
        kind: "verdict-request",
        videoId: meta.videoId,
        score: hit.score,
      });
      if (verdict.kind === "verdict") {
        setState(tile, verdict.verdict === "hide" ? "hidden" : "allowed", hit.score);
      } else {
        setState(tile, "allowed", hit.score);
      }
    } catch {
      setState(tile, "allowed", hit.score);
    }
  }
}

function scan() {
  pendingScan = false;
  const tiles = Array.from(document.querySelectorAll(TILE_SELECTOR)).filter(
    (t) => !t.hasAttribute("data-feedfixer-state"),
  );
  if (tiles.length === 0) return;
  void processBatch(tiles);
}

function scheduleScan() {
  if (pendingScan) return;
  pendingScan = true;
  if (scanTimer) clearTimeout(scanTimer);
  scanTimer = setTimeout(scan, 150);
}

export function startHomepageObserver() {
  scheduleScan();
  const obs = new MutationObserver(() => scheduleScan());
  obs.observe(document.body, { childList: true, subtree: true });
}
