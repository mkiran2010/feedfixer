import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { sendAs } from "../shared/typed-send";
import {
  DEFAULT_CUSTOM_INSTRUCTION,
  DEFAULT_RUBRIC,
  DEFAULT_STAGES,
  type LocalAIStatus,
  type SessionLock,
  type Settings,
} from "../shared/types";

function aiBadgeText(s: LocalAIStatus | null): string {
  if (!s) return "Checking…";
  switch (s.kind) {
    case "ready": return "Ready — model installed and available.";
    case "downloadable": return "Available — model needs to download once (~1.7 GB).";
    case "downloading": return s.progressPct ? `Downloading model (${s.progressPct}%)…` : "Downloading model…";
    case "unavailable": return `Unavailable — ${s.reason}`;
  }
}

function Options() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [lock, setLock] = useState<SessionLock | null>(null);
  const [savedAt, setSavedAt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [localAI, setLocalAI] = useState<LocalAIStatus | null>(null);

  const refresh = async () => {
    setSettings((await sendAs({ kind: "get-settings" }, "settings")).settings);
    setLock((await sendAs({ kind: "get-lock" }, "lock")).lock);
    setLocalAI((await sendAs({ kind: "check-local-ai" }, "local-ai-status")).status);
  };

  useEffect(() => { void refresh(); }, []);

  if (!settings) return <p>Loading…</p>;

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings({ ...settings, [key]: value });
  };

  const updateStage = (idx: number, value: string) => {
    const next = [...settings.stages];
    next[idx] = value;
    update("stages", next);
  };

  const save = async () => {
    setError(null);
    try {
      const r = await sendAs({ kind: "set-settings", settings }, "settings");
      setSettings(r.settings);
      setSavedAt(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const unlock = async () => {
    await sendAs({ kind: "unlock-session" }, "ok");
    await refresh();
  };

  const downloadModel = async () => {
    setLocalAI({ kind: "downloading" });
    setLocalAI((await sendAs({ kind: "trigger-local-ai-download" }, "local-ai-status")).status);
  };

  const exportLog = async () => {
    const r = await sendAs({ kind: "get-verdict-log" }, "verdict-log");
    const blob = new Blob([JSON.stringify(r.entries, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `feedfixer-verdicts-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearLogStorage = async () => {
    if (!confirm("Clear all classified-reel history? This is irreversible.")) return;
    await sendAs({ kind: "clear-verdict-log" }, "ok");
  };

  const isLocked = lock !== null;
  const justSaved = Date.now() - savedAt < 2000;
  const useCustom = settings.useCustomInstruction;

  const aiColor =
    localAI?.kind === "ready" ? "var(--stay)" :
    localAI?.kind === "unavailable" ? "var(--junk)" :
    "var(--warning)";

  return (
    <>
      <h1>FeedFixer</h1>
      <p className="hint" style={{ fontSize: 14, marginBottom: 24 }}>
        On-device AI filter for YouTube Shorts. No API key, no data leaves your browser.
      </p>

      {isLocked && (
        <div className="lock-banner" style={{ marginBottom: 24 }}>
          <span>
            Session locked. Filter rule, stages, and the custom instruction are read-only
            until you unlock.
          </span>
          <button onClick={() => void unlock()}>Unlock</button>
        </div>
      )}

      {error && <div className="error-banner">{error}</div>}

      <div className="section-title">On-device AI</div>
      <div
        style={{
          padding: 14,
          border: `1px solid ${aiColor}`,
          borderRadius: 12,
          background: "var(--bg-elevated)",
          marginBottom: 24,
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 6, color: aiColor }}>
          {aiBadgeText(localAI)}
        </div>
        <p className="hint" style={{ marginTop: 0 }}>
          FeedFixer uses Chrome's built-in <strong>Gemini Nano</strong> model. It runs entirely
          on your device — no API key, no requests to a server, no spending. Requires Chrome 138+
          on Windows 10/11, macOS 13+, Linux, or ChromeOS.
        </p>
        {localAI?.kind === "downloadable" && (
          <button
            className="primary"
            onClick={() => void downloadModel()}
            style={{ marginTop: 8 }}
          >
            Download model now
          </button>
        )}
      </div>

      <div className="section-title">Filter mode</div>

      <div
        style={{
          display: "flex",
          gap: 6,
          background: "var(--bg-elevated)",
          padding: 6,
          borderRadius: 12,
          border: "1px solid var(--border-soft)",
          marginBottom: 16,
        }}
      >
        <button
          onClick={() => update("useCustomInstruction", false)}
          disabled={isLocked}
          style={{
            flex: 1,
            background: !useCustom ? "var(--primary-strong)" : "transparent",
            color: !useCustom ? "#fff" : "var(--text)",
            border: "none",
            fontWeight: 700,
          }}
        >
          1–10 strictness scale
        </button>
        <button
          onClick={() => update("useCustomInstruction", true)}
          disabled={isLocked}
          style={{
            flex: 1,
            background: useCustom ? "var(--primary-strong)" : "transparent",
            color: useCustom ? "#fff" : "var(--text)",
            border: "none",
            fontWeight: 700,
          }}
        >
          Custom instruction
        </button>
      </div>

      {useCustom ? (
        <div className="field">
          <label htmlFor="custom">Custom filter rule</label>
          <textarea
            id="custom"
            rows={5}
            value={settings.customInstruction}
            disabled={isLocked}
            onChange={(e) => update("customInstruction", e.target.value)}
            placeholder='e.g. "Only stay on videos about chess, philosophy, or rocket science. Anything else is junk."'
          />
          <p className="hint">
            This single rule replaces the 1–10 scale. Be specific about what to keep — Gemini
            Nano treats anything not matching as junk.
          </p>
          <button
            onClick={() => update("customInstruction", DEFAULT_CUSTOM_INSTRUCTION)}
            disabled={isLocked}
            style={{ marginTop: 8 }}
          >
            Use example rule
          </button>
        </div>
      ) : (
        <>
          <p className="hint" style={{ marginBottom: 12 }}>
            Describe what counts as "Junk" at each level. The popup slider picks which level is
            active.
          </p>
          <div style={{ background: "var(--bg-elevated)", borderRadius: 12, padding: "4px 16px", border: "1px solid var(--border-soft)" }}>
            {settings.stages.map((s, i) => (
              <div key={i} className="stage-row">
                <div className="stage-num">{i + 1}</div>
                <textarea
                  rows={2}
                  value={s}
                  disabled={isLocked}
                  onChange={(e) => updateStage(i, e.target.value)}
                />
              </div>
            ))}
          </div>
          <button
            onClick={() => update("stages", DEFAULT_STAGES)}
            disabled={isLocked}
            style={{ marginTop: 10 }}
          >
            Reset all stages to defaults
          </button>
        </>
      )}

      <div className="section-title">Base classification rubric</div>
      <p className="hint" style={{ marginBottom: 12 }}>
        The base prompt sent to Gemini Nano. Usually you don't need to edit this.
      </p>
      <textarea
        rows={8}
        value={settings.rubric}
        onChange={(e) => update("rubric", e.target.value)}
      />
      <button onClick={() => update("rubric", DEFAULT_RUBRIC)} style={{ marginTop: 10 }}>
        Reset rubric to default
      </button>

      <div className="section-title">Behavior</div>

      <div className="toggle-row">
        <div>
          <label htmlFor="auto-skip-opt">Auto-skip junk</label>
          <p className="hint">When the model says "Junk", silently advance the Short.</p>
        </div>
        <input
          id="auto-skip-opt"
          type="checkbox"
          checked={settings.autoSkipEnabled}
          onChange={() => update("autoSkipEnabled", !settings.autoSkipEnabled)}
        />
      </div>

      <div className="toggle-row">
        <div>
          <label htmlFor="auto-end">Auto-advance on end</label>
          <p className="hint">When a "Stay" reel finishes (instead of looping), advance to the next.</p>
        </div>
        <input
          id="auto-end"
          type="checkbox"
          checked={settings.autoAdvanceOnEnd}
          onChange={() => update("autoAdvanceOnEnd", !settings.autoAdvanceOnEnd)}
        />
      </div>

      <div className="section-title">Classified-reel data</div>
      <p className="hint" style={{ marginBottom: 12 }}>
        Every reel scored is logged locally (max 1000 entries, oldest dropped). Each entry stores
        the videoId, title, channel, verdict, and which strictness level / custom rule was active
        at the time. Nothing leaves your browser unless you export it.
      </p>
      <div className="row" style={{ gap: 8 }}>
        <button onClick={() => void exportLog()}>Export as JSON</button>
        <button onClick={() => void clearLogStorage()} style={{ flex: "0 0 auto" }}>
          Clear log
        </button>
      </div>

      <div className="actions">
        <button className="primary" onClick={save}>Save</button>
        <span className={`saved ${justSaved ? "show" : ""}`}>Saved.</span>
      </div>
    </>
  );
}

const root = document.getElementById("root");
if (root) createRoot(root).render(<Options />);
