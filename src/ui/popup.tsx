import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { send } from "../shared/messages";
import type { TabMsg, TabReply } from "../shared/messages";
import type { ScoredReel, Settings } from "../shared/types";

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
  const [skipStatus, setSkipStatus] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [verdict, setVerdict] = useState<ScoredReel | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setTab(await getActiveTab());
    const s = await send({ kind: "get-settings" });
    if (s.kind === "settings") setSettings(s.settings);
    const v = await send({ kind: "get-last-verdict" });
    if (v.kind === "last-verdict") setVerdict(v.result);
    const e = await send({ kind: "get-last-error" });
    if (e.kind === "last-error") setError(e.error);
  };

  useEffect(() => {
    void refresh();
    const id = setInterval(refresh, 1000);
    return () => clearInterval(id);
  }, []);

  if (!settings) return <p>Loading…</p>;

  const onShorts = isShortsUrl(tab?.url);
  const onYouTube = isYouTubeUrl(tab?.url);
  const apiKeyMissing = !settings.apiKey;

  const onSkip = async () => {
    if (!tab?.id) return;
    setSkipStatus("…");
    const reply = await manualSkip(tab.id);
    if (reply.kind === "skipped") setSkipStatus(`Skipped (${reply.method})`);
    else if (reply.kind === "skip-failed") setSkipStatus(`Failed: ${reply.reason}`);
    else setSkipStatus(`No response: ${reply.reason}`);
    setTimeout(() => setSkipStatus(null), 2000);
  };

  const toggleAuto = async () => {
    const reply = await send({
      kind: "set-settings",
      settings: { autoSkipEnabled: !settings.autoSkipEnabled },
    });
    if (reply.kind === "settings") setSettings(reply.settings);
  };

  return (
    <>
      <h2>FeedFixer</h2>
      <p className="hint" style={{ marginTop: 0, marginBottom: 12 }}>
        {onYouTube ? (onShorts ? "On YouTube Shorts" : "On YouTube — open a Short to enable") : "Not on YouTube"}
      </p>

      {apiKeyMissing && (
        <div className="error-banner">
          No API key set.{" "}
          <a href="#" onClick={(e) => { e.preventDefault(); void chrome.runtime.openOptionsPage(); }}>
            Open options
          </a>{" "}
          to add one.
        </div>
      )}

      {error && !apiKeyMissing && (
        <div className="error-banner">
          <strong>Last error:</strong> {error}
        </div>
      )}

      <button
        className="primary"
        style={{ width: "100%", padding: "10px", fontSize: 14 }}
        disabled={!onShorts}
        onClick={() => void onSkip()}
        title={onShorts ? "Manually skip this Short" : "Open a YouTube Short to enable"}
      >
        ⬇ Skip current Short
      </button>
      {skipStatus && (
        <p className="hint" style={{ margin: "6px 0 0", textAlign: "center" }}>
          {skipStatus}
        </p>
      )}

      <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16, fontWeight: 600, fontSize: 13 }}>
        <input
          type="checkbox"
          checked={settings.autoSkipEnabled}
          onChange={() => void toggleAuto()}
        />
        Auto-skip when Claude says &quot;Junk&quot;
      </label>

      {verdict && (
        <div className={`verdict-card ${verdict.verdict.toLowerCase()}`}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>
            Last reel: {verdict.verdict}
          </div>
          <div style={{ opacity: 0.85 }}>{verdict.reason}</div>
        </div>
      )}

      <p className="hint" style={{ marginTop: 12, textAlign: "center" }}>
        <a href="#" onClick={(e) => { e.preventDefault(); void chrome.runtime.openOptionsPage(); }}>
          Edit rubric & API key →
        </a>
      </p>
    </>
  );
}

const root = document.getElementById("root");
if (root) createRoot(root).render(<Popup />);
