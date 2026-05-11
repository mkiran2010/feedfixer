import type { VideoMeta } from "../shared/types";

const VIDEO_ID_RE = /[?&]v=([\w-]{11})|\/shorts\/([\w-]{11})|\/watch\/([\w-]{11})/;

export function videoIdFromHref(href: string | null): string | null {
  if (!href) return null;
  const m = VIDEO_ID_RE.exec(href);
  return m ? (m[1] ?? m[2] ?? m[3] ?? null) : null;
}

function text(el: Element | null | undefined): string {
  return el?.textContent?.trim().replace(/\s+/g, " ") ?? "";
}

/** Homepage rich-grid tile: ytd-rich-item-renderer */
export function extractRichItem(tile: Element): VideoMeta | null {
  const link = tile.querySelector<HTMLAnchorElement>("a#thumbnail, a#video-title-link");
  const id = videoIdFromHref(link?.href ?? null);
  if (!id) return null;
  const title =
    text(tile.querySelector("#video-title")) ||
    link?.getAttribute("aria-label") ||
    "";
  const channel =
    text(tile.querySelector("ytd-channel-name #text, #channel-name #text")) || "";
  return { videoId: id, title, channel };
}

/** Watch-page sidebar tile: ytd-compact-video-renderer */
export function extractCompactItem(tile: Element): VideoMeta | null {
  const link = tile.querySelector<HTMLAnchorElement>("a.yt-simple-endpoint, a#thumbnail");
  const id = videoIdFromHref(link?.href ?? null);
  if (!id) return null;
  const title = text(tile.querySelector("#video-title"));
  const channel = text(tile.querySelector("#channel-name #text, .ytd-channel-name #text"));
  return { videoId: id, title, channel };
}

/** Active short reel: ytd-reel-video-renderer[is-active] */
export function extractActiveShort(reel: Element): VideoMeta | null {
  const container = reel.querySelector<HTMLElement>("[id^='reel-video-']") ?? reel;
  const id =
    container.getAttribute("data-video-id") ??
    videoIdFromHref(window.location.pathname);
  if (!id) return null;
  const title = text(reel.querySelector("h2.title yt-formatted-string, .reel-player-overlay-renderer h2"));
  const channel = text(reel.querySelector(".ytd-reel-player-header-renderer #channel-info, #channel-info"));
  return { videoId: id, title, channel };
}
