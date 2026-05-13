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
