import type { ScoredReel, Settings, VideoMeta } from "../shared/types";

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

interface ClaudeContentBlock {
  type: string;
  text?: string;
}

interface ClaudeResponse {
  content?: ClaudeContentBlock[];
  error?: { message?: string; type?: string };
}

function levelDescription(settings: Settings): string {
  const level = Math.min(10, Math.max(1, settings.currentLevel));
  const desc = settings.stages[level - 1] ?? "";
  return `Strictness level ${level}/10 — ${desc}`;
}

export async function scoreReel(
  meta: VideoMeta,
  settings: Settings,
): Promise<ScoredReel> {
  if (!settings.apiKey) throw new Error("missing API key — set one in FeedFixer options");

  const body = {
    model: settings.model,
    max_tokens: 30,
    system: [
      {
        type: "text",
        text: settings.rubric,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content:
          `${levelDescription(settings)}\n\n` +
          `Title: ${meta.title}\n` +
          `Channel: ${meta.channel}\n\n` +
          `Reply with EXACTLY one word: "Junk" or "Stay".`,
      },
    ],
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20_000);

  let response: Response;
  try {
    response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": settings.apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("Claude API timeout (20s)");
    }
    throw new Error(`fetch failed: ${err instanceof Error ? err.message : String(err)}`);
  }
  clearTimeout(timeoutId);

  const raw = await response.text();
  let data: ClaudeResponse;
  try {
    data = JSON.parse(raw) as ClaudeResponse;
  } catch {
    throw new Error(`non-JSON response (${response.status}): ${raw.slice(0, 200)}`);
  }

  if (!response.ok) {
    const apiMsg = data.error?.message ?? raw.slice(0, 200);
    throw new Error(`Claude API ${response.status}: ${apiMsg}`);
  }

  const text =
    (data.content ?? [])
      .filter((b) => b.type === "text" && typeof b.text === "string")
      .map((b) => b.text!)
      .join("") ?? "";

  const { verdict, reason } = parseVerdict(text);

  return {
    videoId: meta.videoId,
    verdict,
    reason,
    scoredAt: Date.now(),
  };
}
