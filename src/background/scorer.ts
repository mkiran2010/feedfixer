import type { LocalAIStatus, ScoredReel, Settings, VideoMeta } from "../shared/types";

interface OembedResponse {
  title?: string;
  author_name?: string;
}

export async function fetchMeta(videoId: string): Promise<VideoMeta> {
  const url = `https://www.youtube.com/oembed?url=https%3A//www.youtube.com/shorts/${videoId}&format=json`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`oembed ${r.status} for ${videoId}`);
  const data = (await r.json()) as OembedResponse;
  return {
    videoId,
    title: data.title ?? "(untitled)",
    channel: data.author_name ?? "(unknown channel)",
  };
}

function parseVerdict(text: string): { verdict: "Junk" | "Stay"; reason: string } {
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();
  if (/\bjunk\b/.test(lower) && !/\bstay\b/.test(lower)) {
    return { verdict: "Junk", reason: trimmed };
  }
  if (/\bstay\b/.test(lower) && !/\bjunk\b/.test(lower)) {
    return { verdict: "Stay", reason: trimmed };
  }
  return { verdict: "Stay", reason: `unparseable: ${trimmed.slice(0, 80)}` };
}

function activeFilterDescription(settings: Settings): string {
  if (settings.useCustomInstruction && settings.customInstruction.trim()) {
    return `Custom filter rule: ${settings.customInstruction.trim()}`;
  }
  const level = Math.min(10, Math.max(1, settings.currentLevel));
  const desc = settings.stages[level - 1] ?? "";
  return `Strictness level ${level}/10 — ${desc}`;
}

/* ---------- Chrome built-in AI (LanguageModel) bindings ---------- */
/* The `LanguageModel` global is exposed in service workers and extension pages on
   Chrome 138+ when the user's machine supports it. */

interface PromptParam {
  role: "system" | "user" | "assistant";
  content: string;
}

interface CreateMonitor {
  addEventListener(
    name: "downloadprogress",
    cb: (e: { loaded: number; total: number }) => void,
  ): void;
}

interface LanguageModelSession {
  prompt(input: string | PromptParam[]): Promise<string>;
  destroy(): void;
}

interface LanguageModelStatic {
  availability(): Promise<"available" | "downloadable" | "downloading" | "unavailable">;
  create(opts?: {
    initialPrompts?: PromptParam[];
    monitor?: (m: CreateMonitor) => void;
    expectedInputs?: { type: "text" | "image" | "audio" }[];
    expectedOutputs?: { type: "text"; languages?: string[] }[];
  }): Promise<LanguageModelSession>;
}

function getLanguageModel(): LanguageModelStatic | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = globalThis as any;
  return (g.LanguageModel as LanguageModelStatic | undefined) ?? null;
}

export async function checkLocalAI(): Promise<LocalAIStatus> {
  const lm = getLanguageModel();
  if (!lm) {
    return {
      kind: "unavailable",
      reason:
        "Chrome built-in AI is not exposed on this browser. Needs Chrome 138+ on Windows 10/11, macOS 13+, Linux, or ChromeOS, and a supported device.",
    };
  }
  try {
    const status = await lm.availability();
    switch (status) {
      case "available":
        return { kind: "ready" };
      case "downloadable":
        return { kind: "downloadable" };
      case "downloading":
        return { kind: "downloading" };
      case "unavailable":
        return {
          kind: "unavailable",
          reason: "Chrome reports the on-device model as unavailable for this device.",
        };
    }
  } catch (err) {
    return {
      kind: "unavailable",
      reason: `availability() failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

let progressPct = 0;

export async function triggerLocalAIDownload(): Promise<LocalAIStatus> {
  const lm = getLanguageModel();
  if (!lm) {
    return { kind: "unavailable", reason: "LanguageModel not available" };
  }
  try {
    const session = await lm.create({
      monitor: (m) =>
        m.addEventListener("downloadprogress", (e) => {
          progressPct = e.total > 0 ? Math.round((e.loaded / e.total) * 100) : 0;
          console.log(`[feedfixer] model download ${progressPct}%`);
        }),
    });
    session.destroy();
    return { kind: "ready" };
  } catch (err) {
    return {
      kind: "unavailable",
      reason: `create() failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

export async function scoreReel(
  meta: VideoMeta,
  settings: Settings,
): Promise<ScoredReel> {
  const lm = getLanguageModel();
  if (!lm) throw new Error("Chrome built-in AI not available — see popup for details");

  // Fresh session every call — sessions accumulate conversation history per .prompt(),
  // so reusing one across reels eventually hits the token budget and starts erroring.
  const session = await lm.create({
    initialPrompts: [{ role: "system", content: settings.rubric }],
  });
  try {
    const userPrompt =
      `${activeFilterDescription(settings)}\n\n` +
      `Title: ${meta.title}\n` +
      `Channel: ${meta.channel}\n\n` +
      `Reply with EXACTLY one word: "Junk" or "Stay".`;
    const response = await session.prompt(userPrompt);
    const { verdict, reason } = parseVerdict(response);
    return {
      videoId: meta.videoId,
      verdict,
      reason,
      scoredAt: Date.now(),
    };
  } finally {
    session.destroy();
  }
}
