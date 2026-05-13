import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { send } from "../shared/messages";
import { DEFAULT_RUBRIC, type Settings } from "../shared/types";

const MODELS = [
  { id: "claude-haiku-4-5", label: "Claude Haiku 4.5 — fast + cheap (default)" },
  { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6 — better nuance, ~3x cost" },
];

function Options() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [savedAt, setSavedAt] = useState(0);

  useEffect(() => {
    void (async () => {
      const reply = await send({ kind: "get-settings" });
      if (reply.kind === "settings") setSettings(reply.settings);
    })();
  }, []);

  if (!settings) return <p>Loading…</p>;

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings({ ...settings, [key]: value });
  };

  const save = async () => {
    const reply = await send({ kind: "set-settings", settings });
    if (reply.kind === "settings") {
      setSettings(reply.settings);
      setSavedAt(Date.now());
    }
  };

  const justSaved = Date.now() - savedAt < 2000;

  return (
    <>
      <h1>FeedFixer</h1>
      <p className="hint" style={{ marginTop: -8 }}>
        Auto-skip junk YouTube Shorts via Claude metadata classification.
      </p>

      <div className="field">
        <label htmlFor="apikey">Anthropic API key</label>
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
          . Costs run a few cents/day with Haiku and prompt caching.
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

      <div className="field">
        <label htmlFor="rubric">Classification rubric</label>
        <textarea
          id="rubric"
          rows={12}
          value={settings.rubric}
          onChange={(e) => update("rubric", e.target.value)}
        />
        <p className="hint">
          Defines what counts as "Junk" vs "Stay." Edit in your own voice — Claude follows it literally.
        </p>
        <button
          onClick={() => update("rubric", DEFAULT_RUBRIC)}
          style={{ marginTop: 6 }}
        >
          Reset to default
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
