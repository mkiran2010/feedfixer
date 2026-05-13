import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { send } from "../shared/messages";
import {
  DEFAULT_CUSTOM_INSTRUCTION,
  DEFAULT_RUBRIC,
  DEFAULT_STAGES,
  type SessionLock,
  type Settings,
} from "../shared/types";

const MODELS = [
  { id: "claude-haiku-4-5", label: "Claude Haiku 4.5 — fast + cheap (default)" },
  { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6 — better nuance, ~3× cost" },
];

function Options() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [lock, setLock] = useState<SessionLock | null>(null);
  const [savedAt, setSavedAt] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    const r = await send({ kind: "get-settings" });
    if (r.kind === "settings") setSettings(r.settings);
    const l = await send({ kind: "get-lock" });
    if (l.kind === "lock") setLock(l.lock);
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
    const reply = await send({ kind: "set-settings", settings });
    if (reply.kind === "settings") {
      setSettings(reply.settings);
      setSavedAt(Date.now());
    } else if (reply.kind === "error") {
      setError(reply.message);
    }
  };

  const unlock = async () => {
    await send({ kind: "unlock-session" });
    await refresh();
  };

  const isLocked = lock !== null;
  const justSaved = Date.now() - savedAt < 2000;
  const useCustom = settings.useCustomInstruction;

  return (
    <>
      <h1>FeedFixer</h1>
      <p className="hint" style={{ fontSize: 14, marginBottom: 24 }}>
        Configure how aggressively to filter YouTube Shorts.
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

      <div className="section-title">Anthropic API</div>

      <div className="field">
        <label htmlFor="apikey">API key</label>
        <input
          id="apikey"
          type="password"
          placeholder="sk-ant-…"
          value={settings.apiKey}
          onChange={(e) => update("apiKey", e.target.value)}
        />
        <p className="hint">
          Stored locally only.{" "}
          <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">
            Get a key →
          </a>
        </p>
      </div>

      <div className="field">
        <label htmlFor="model">Model</label>
        <select id="model" value={settings.model} onChange={(e) => update("model", e.target.value)}>
          {MODELS.map((m) => (
            <option key={m.id} value={m.id}>{m.label}</option>
          ))}
        </select>
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
            This single rule replaces the 1–10 scale for every classification request. Be specific
            about what to keep — Claude treats anything not matching as junk.
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
            active. Edit in your own voice — Claude follows them literally.
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
        The base prompt sent to Claude. Usually you don't need to edit this — tune the active
        rule above instead.
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
          <p className="hint">When Claude says "Junk", silently advance the Short.</p>
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

      <div className="actions">
        <button className="primary" onClick={save}>Save</button>
        <span className={`saved ${justSaved ? "show" : ""}`}>Saved.</span>
      </div>
    </>
  );
}

const root = document.getElementById("root");
if (root) createRoot(root).render(<Options />);
