import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { send } from "../shared/messages";
import { DEFAULT_RUBRIC, DEFAULT_STAGES, type SessionLock, type Settings } from "../shared/types";

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

  const resetStages = () => update("stages", DEFAULT_STAGES);
  const resetRubric = () => update("rubric", DEFAULT_RUBRIC);

  const unlock = async () => {
    await send({ kind: "unlock-session" });
    await refresh();
  };

  const isLocked = lock !== null;
  const justSaved = Date.now() - savedAt < 2000;

  return (
    <>
      <h1>FeedFixer</h1>
      <p className="hint" style={{ fontSize: 14, marginBottom: 24 }}>
        Configure how aggressively to filter YouTube Shorts.
      </p>

      {isLocked && (
        <div className="lock-banner" style={{ marginBottom: 24 }}>
          <span>
            Session is locked at level {lock.lockedAtLevel}. Stage descriptions and current
            level can't be changed until you unlock.
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
          Stored locally only. Get one at{" "}
          <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">
            console.anthropic.com
          </a>
          .
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

      <div className="section-title">Strictness stages (1 = lenient, 10 = strict)</div>
      <p className="hint" style={{ marginBottom: 12 }}>
        Describe what counts as "Junk" at each level. The popup slider picks which level is
        active. Edit these in your own voice — Claude follows them literally.
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
      <button onClick={resetStages} disabled={isLocked} style={{ marginTop: 10 }}>
        Reset all stages to defaults
      </button>

      <div className="section-title">Base classification rubric</div>
      <p className="hint" style={{ marginBottom: 12 }}>
        The base prompt sent to Claude. Usually you don't need to edit this — tune the stages
        instead. The active stage description is appended to every request.
      </p>
      <textarea
        rows={10}
        value={settings.rubric}
        onChange={(e) => update("rubric", e.target.value)}
      />
      <button onClick={resetRubric} style={{ marginTop: 10 }}>Reset rubric to default</button>

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
