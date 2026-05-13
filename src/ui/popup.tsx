import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { TabMsg, TabReply } from "../shared/messages";

async function getActiveTab(): Promise<chrome.tabs.Tab | null> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0] ?? null;
}

function isShortsUrl(url: string | undefined): boolean {
  if (!url) return false;
  return /^https:\/\/(www\.|m\.)?youtube\.com\/shorts\//.test(url);
}

function isYouTubeUrl(url: string | undefined): boolean {
  if (!url) return false;
  return /^https:\/\/(www\.|m\.)?youtube\.com\//.test(url);
}

async function manualSkip(
  tabId: number,
): Promise<TabReply | { kind: "send-failed"; reason: string }> {
  return new Promise((resolve) => {
    const msg: TabMsg = { kind: "manual-skip" };
    chrome.tabs.sendMessage(tabId, msg, (reply: TabReply | undefined) => {
      const err = chrome.runtime.lastError;
      if (err) {
        resolve({ kind: "send-failed", reason: err.message ?? "unknown" });
        return;
      }
      if (!reply) {
        resolve({ kind: "send-failed", reason: "content script returned nothing" });
        return;
      }
      resolve(reply);
    });
  });
}

function Popup() {
  const [tab, setTab] = useState<chrome.tabs.Tab | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    void getActiveTab().then(setTab);
    const id = setInterval(() => void getActiveTab().then(setTab), 1000);
    return () => clearInterval(id);
  }, []);

  const onShorts = isShortsUrl(tab?.url);
  const onYouTube = isYouTubeUrl(tab?.url);

  const onSkip = async () => {
    if (!tab?.id) return;
    setStatus("…");
    const reply = await manualSkip(tab.id);
    if (reply.kind === "skipped") setStatus(`Skipped (${reply.method})`);
    else if (reply.kind === "skip-failed") setStatus(`Failed: ${reply.reason}`);
    else setStatus(`No response: ${reply.reason}`);
    setTimeout(() => setStatus(null), 2000);
  };

  return (
    <>
      <h2>FeedFixer</h2>
      <p className="hint" style={{ marginTop: 0, marginBottom: 12 }}>
        {onYouTube ? (onShorts ? "On YouTube Shorts" : "On YouTube — open a Short to enable") : "Not on YouTube"}
      </p>

      <button
        className="primary"
        style={{ width: "100%", padding: "10px", fontSize: 14 }}
        disabled={!onShorts}
        onClick={() => void onSkip()}
        title={onShorts ? "Skip the current Short" : "Open a YouTube Short to enable"}
      >
        ⬇ Skip current Short
      </button>
      {status && (
        <p className="hint" style={{ margin: "8px 0 0", textAlign: "center" }}>
          {status}
        </p>
      )}
    </>
  );
}

const root = document.getElementById("root");
if (root) createRoot(root).render(<Popup />);
