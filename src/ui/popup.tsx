import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { send } from "../shared/messages";
import type { TabMsg, TabReply } from "../shared/messages";
import type { SessionStats, Settings } from "../shared/types";

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

async function manualSkip(tabId: number): Promise<TabReply | { kind: "send-failed"; reason: string }> {
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

function fmtPause(until: number | null): string | null {
  if (until === null) return null;
  const ms = until - Date.now();
  if (ms <= 0) return null;
  const min = Math.ceil(ms / 60000);
  if (min < 60) return `Paused for ${min}m`;
  return `Paused until ${new Date(until).toLocaleTimeString()}`;
}

function Popup() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [stats, setStats] = useState<SessionStats | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<chrome.tabs.Tab | null>(null);
  const [skipResult, setSkipResult] = useState<string | null>(null);

  const refresh = async () => {
    const s = await send({ kind: "get-settings" });
    if (s.kind === "settings") setSettings(s.settings);
    const t = await send({ kind: "get-stats" });
    if (t.kind === "stats") setStats(t.stats);
    const e = await send({ kind: "get-last-error" });
    if (e.kind === "last-error") setLastError(e.error);
    setActiveTab(await getActiveTab());
  };

  useEffect(() => {
    void refresh();
    const id = setInterval(refresh, 1500);
    return () => clearInterval(id);
  }, []);

  const onSkip = async () => {
    if (!activeTab?.id) return;
    setSkipResult("…");
    const reply = await manualSkip(activeTab.id);
    if (reply.kind === "skipped") setSkipResult(`Skipped (${reply.method})`);
    else if (reply.kind === "skip-failed") setSkipResult(`Failed: ${reply.reason}`);
    else setSkipResult(`No response: ${reply.reason}`);
    setTimeout(() => setSkipResult(null), 2000);
  };

  if (!settings || !stats) return <p>Loading…</p>;

  const setJunkPct = async (pct: number) => {
    setSettings({ ...settings, junkPct: pct });
    const reply = await send({ kind: "set-settings", settings: { junkPct: pct } });
    if (reply.kind === "settings") setSettings(reply.settings);
  };

  const toggleEnabled = async () => {
    const reply = await send({
      kind: "set-settings",
      settings: { enabled: !settings.enabled },
    });
    if (reply.kind === "settings") setSettings(reply.settings);
  };

  const pauseFor = async (minutes: number | null) => {
    const pausedUntil = minutes === null ? null : Date.now() + minutes * 60000;
    const reply = await send({ kind: "set-settings", settings: { pausedUntil } });
    if (reply.kind === "settings") setSettings(reply.settings);
  };

  const toggleForceJunk = async () => {
    const reply = await send({
      kind: "set-settings",
      settings: { debugForceJunk: !settings.debugForceJunk },
    });
    if (reply.kind === "settings") setSettings(reply.settings);
  };

  const lastSeen =
    stats.lastScoreRequestAt === null
      ? "never"
      : `${Math.round((Date.now() - stats.lastScoreRequestAt) / 1000)}s ago`;

  const avg =
    stats.scoreCount > 0 ? Math.round(stats.scoreSum / stats.scoreCount) : 0;
  const pauseLabel = fmtPause(settings.pausedUntil);
  const apiKeyMissing = !settings.apiKey;
  const onShorts = isShortsUrl(activeTab?.url);
  const onYouTube = isYouTubeUrl(activeTab?.url);

  return (
    <>
      <h2>FeedFixer</h2>
      <p className="hint" style={{ marginTop: 0, marginBottom: 12 }}>
        {settings.enabled ? "Filtering active" : "Disabled"}
        {onYouTube ? (onShorts ? " · on Shorts" : " · on YouTube") : " · not on YouTube"}
      </p>

      <button
        className="primary"
        style={{ width: "100%", padding: "10px", fontSize: 14, marginBottom: 8 }}
        disabled={!onShorts}
        onClick={() => void onSkip()}
        title={onShorts ? "Skip the current Short" : "Open a YouTube Short to enable"}
      >
        ⬇ Skip current Short
      </button>
      {skipResult && (
        <p className="hint" style={{ margin: "0 0 12px", textAlign: "center" }}>
          {skipResult}
        </p>
      )}

      {apiKeyMissing && (
        <div className="pause-banner">
          No API key set. Open{" "}
          <a href="#" onClick={(e) => { e.preventDefault(); void chrome.runtime.openOptionsPage(); }}>
            options
          </a>{" "}
          to add one.
        </div>
      )}

      {lastError && !apiKeyMissing && (
        <div
          className="pause-banner"
          style={{ background: "#fde2e2", color: "#7a1c1c" }}
        >
          <strong>Scoring failed:</strong> {lastError}
        </div>
      )}

      {pauseLabel && <div className="pause-banner">{pauseLabel}</div>}

      <div className="slider-label">
        <span>Junk allowed</span>
        <span>{settings.junkPct}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={settings.junkPct}
        onChange={(e) => void setJunkPct(Number(e.target.value))}
        style={{ width: "100%" }}
      />
      <p className="hint" style={{ marginTop: 4 }}>
        0% = strict filter. 100% = no filtering.
      </p>

      <div className="stats">
        <div className="stat">
          <div className="num">{stats.shown}</div>
          <div className="lbl">Shown</div>
        </div>
        <div className="stat">
          <div className="num">{stats.hidden}</div>
          <div className="lbl">Hidden</div>
        </div>
        <div className="stat">
          <div className="num">{avg || "—"}</div>
          <div className="lbl">Avg score</div>
        </div>
      </div>

      <div className="row">
        <button onClick={toggleEnabled}>
          {settings.enabled ? "Disable" : "Enable"}
        </button>
        {pauseLabel ? (
          <button onClick={() => void pauseFor(null)}>Resume</button>
        ) : (
          <button onClick={() => void pauseFor(15)}>Pause 15m</button>
        )}
      </div>
      <div className="row">
        <button onClick={() => void pauseFor(60)}>Pause 1h</button>
        <button onClick={() => void send({ kind: "reset-stats" }).then(refresh)}>
          Reset stats
        </button>
      </div>

      <div
        style={{
          marginTop: 12,
          padding: 10,
          border: "1px dashed #999",
          borderRadius: 6,
          fontSize: 12,
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Debug</div>
        <div>Score requests received: <strong>{stats.scoreRequestsReceived}</strong></div>
        <div>Last content-script ping: <strong>{lastSeen}</strong></div>
        <label style={{ display: "flex", alignItems: "center", marginTop: 8, gap: 6, fontWeight: 400 }}>
          <input
            type="checkbox"
            checked={settings.debugForceJunk}
            onChange={() => void toggleForceJunk()}
          />
          <span>Force every video to be junk (no API call)</span>
        </label>
        <p className="hint" style={{ marginTop: 4 }}>
          Use this to test the skip mechanism without scoring. With Junk allowed = 0%, every tile should hide and every Short should auto-skip.
        </p>
      </div>

      <div className="footer">
        <a href="#" onClick={(e) => { e.preventDefault(); void chrome.runtime.openOptionsPage(); }}>
          Edit rubric & API key →
        </a>
      </div>
    </>
  );
}

const root = document.getElementById("root");
if (root) createRoot(root).render(<Popup />);
