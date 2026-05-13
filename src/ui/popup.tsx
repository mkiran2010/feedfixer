import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { VerdictLogEntry } from "../shared/messages";
import { sendAs } from "../shared/typed-send";
import type { LocalAIStatus, SessionLock, Settings } from "../shared/types";

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

function fmtAge(ts: number): string {
  const sec = Math.round((Date.now() - ts) / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  return `${Math.floor(min / 60)}h ago`;
}

function localAIBadge(status: LocalAIStatus | null) {
  if (!status) return { text: "checking…", color: "var(--text-muted)" };
  switch (status.kind) {
    case "ready":
      return { text: "on-device AI ready", color: "var(--stay)" };
    case "downloadable":
      return { text: "model not yet downloaded", color: "var(--warning)" };
    case "downloading":
      return { text: `downloading model${status.progressPct ? ` (${status.progressPct}%)` : "…"}`, color: "var(--warning)" };
    case "unavailable":
      return { text: "on-device AI unavailable", color: "var(--junk)" };
  }
}

function Popup() {
  const [tab, setTab] = useState<chrome.tabs.Tab | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lock, setLock] = useState<SessionLock | null>(null);
  const [localAI, setLocalAI] = useState<LocalAIStatus | null>(null);
  const [logEntries, setLogEntries] = useState<VerdictLogEntry[]>([]);

  const refresh = async () => {
    try {
      setTab(await getActiveTab());
      setSettings((await sendAs({ kind: "get-settings" }, "settings")).settings);
      setError((await sendAs({ kind: "get-last-error" }, "last-error")).error);
      setLock((await sendAs({ kind: "get-lock" }, "lock")).lock);
      setLocalAI((await sendAs({ kind: "check-local-ai" }, "local-ai-status")).status);
      setLogEntries((await sendAs({ kind: "get-verdict-log" }, "verdict-log")).entries);
    } catch {
      // SW idle — silently retry
    }
  };

  useEffect(() => {
    void refresh();
    const id = setInterval(refresh, 1500);
    return () => clearInterval(id);
  }, []);

  if (!settings) return <p>Loading…</p>;

  const onShorts = isShortsUrl(tab?.url);
  const onYouTube = isYouTubeUrl(tab?.url);
  const isLocked = lock !== null;
  const usingCustom = settings.useCustomInstruction;
  const aiBadge = localAIBadge(localAI);

  const setLevel = async (level: number) => {
    if (isLocked) return;
    setSettings({ ...settings, currentLevel: level });
    const r = await sendAs({ kind: "set-settings", settings: { currentLevel: level } }, "settings");
    setSettings(r.settings);
  };

  const toggleAuto = async () => {
    const r = await sendAs(
      { kind: "set-settings", settings: { autoSkipEnabled: !settings.autoSkipEnabled } },
      "settings",
    );
    setSettings(r.settings);
  };

  const unlock = async () => {
    await sendAs({ kind: "unlock-session" }, "ok");
    await refresh();
  };

  const downloadModel = async () => {
    setLocalAI({ kind: "downloading" });
    setLocalAI((await sendAs({ kind: "trigger-local-ai-download" }, "local-ai-status")).status);
  };

  const stageDesc = settings.stages[settings.currentLevel - 1] ?? "";

  return (
    <>
      <div className="header">
        <span className="dot" style={{ background: aiBadge.color, boxShadow: `0 0 8px ${aiBadge.color}` }} />
        <h2>Syte</h2>
      </div>
      <p className="hint" style={{ marginTop: 0, marginBottom: 6 }}>
        {onYouTube ? (onShorts ? "On Shorts" : "On YouTube — open a Short") : "Not on YouTube"}
      </p>
      <p className="hint" style={{ marginTop: 0, marginBottom: 14, color: aiBadge.color, fontWeight: 600 }}>
        {aiBadge.text}
      </p>

      {localAI?.kind === "downloadable" && (
        <div className="lock-banner" style={{ marginBottom: 12 }}>
          <span>Gemini Nano needs to download once (~1.7GB).</span>
          <button onClick={() => void downloadModel()}>Download</button>
        </div>
      )}

      {localAI?.kind === "unavailable" && (
        <div className="error-banner">
          <strong>Local AI unavailable:</strong> {localAI.reason}
        </div>
      )}

      {error && (
        <div className="error-banner">
          <strong>Last error:</strong> {error}
        </div>
      )}

      {usingCustom ? (
        <>
          <div className="section-title">Custom rule</div>
          <div
            style={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-soft)",
              borderRadius: 10,
              padding: "10px 12px",
              fontSize: 12,
              lineHeight: 1.5,
              color: "var(--text-muted)",
              minHeight: 50,
            }}
          >
            {settings.customInstruction || "(empty — set one in options)"}
          </div>
          <p className="hint" style={{ marginTop: 6 }}>
            Edit in <a href="#" onClick={(e) => { e.preventDefault(); void chrome.runtime.openOptionsPage(); }}>options</a>.
          </p>
        </>
      ) : (
        <>
          <div className="section-title">Strictness</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
            <span style={{ fontWeight: 700, fontSize: 13 }}>Level {settings.currentLevel} / 10</span>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {settings.currentLevel <= 3 ? "lenient" : settings.currentLevel <= 6 ? "moderate" : settings.currentLevel <= 8 ? "strict" : "extreme"}
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={10}
            step={1}
            value={settings.currentLevel}
            disabled={isLocked}
            onChange={(e) => void setLevel(Number(e.target.value))}
          />
          <p className="hint" style={{ marginTop: 8, lineHeight: 1.4 }}>
            {stageDesc}
          </p>
        </>
      )}

      {isLocked && (
        <div className="lock-banner">
          <span>
            Locked {usingCustom ? "(custom rule)" : `at level ${lock.lockedAtLevel}`} ({fmtAge(lock.lockedAt)})
          </span>
          <button onClick={() => void unlock()}>Unlock</button>
        </div>
      )}

      <div className="divider" />

      <div className="toggle-row">
        <label htmlFor="auto-skip">Auto-skip junk</label>
        <input
          id="auto-skip"
          type="checkbox"
          checked={settings.autoSkipEnabled}
          onChange={() => void toggleAuto()}
        />
      </div>

      <div className="section-title">
        Recent reels{logEntries.length > 0 ? ` (${logEntries.length} total)` : ""}
      </div>
      {logEntries.length === 0 ? (
        <p className="hint">No reels classified yet. Open a YouTube Short.</p>
      ) : (
        <ul className="reel-list">
          {logEntries
            .slice()
            .reverse()
            .slice(0, 8)
            .map((e) => (
              <li key={`${e.videoId}-${e.scoredAt}`} className={`reel-row ${e.verdict.toLowerCase()}`}>
                <span className="reel-verdict">{e.verdict}</span>
                <span className="reel-title" title={e.title}>{e.title}</span>
              </li>
            ))}
        </ul>
      )}

      <p style={{ marginTop: 12, marginBottom: 0, textAlign: "center" }}>
        <a href="#" onClick={(e) => { e.preventDefault(); void chrome.runtime.openOptionsPage(); }}>
          Edit rules →
        </a>
      </p>
    </>
  );
}

const root = document.getElementById("root");
if (root) createRoot(root).render(<Popup />);
