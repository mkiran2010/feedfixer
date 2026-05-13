/** Messages sent from the popup directly to a content script via chrome.tabs.sendMessage. */
export type TabMsg = { kind: "manual-skip" };

export type TabReply =
  | { kind: "skipped"; method: string }
  | { kind: "skip-failed"; reason: string };
