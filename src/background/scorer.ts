import Anthropic from "@anthropic-ai/sdk";
import type { ScoredReel, Settings, VideoMeta } from "../shared/types";

interface OembedResponse {
  title?: string;
  author_name?: string;
}

export async function fetchMeta(videoId: string): Promise<VideoMeta> {
  const url = `https://www.youtube.com/oembed?url=https%3A//www.youtube.com/shorts/${videoId}&format=json`;
  const r = await fetch(url);
  if (!r.ok) {
    throw new Error(`oembed ${r.status} for ${videoId}`);
  }
  const data = (await r.json()) as OembedResponse;
  return {
    videoId,
    title: data.title ?? "(untitled)",
    channel: data.author_name ?? "(unknown channel)",
  };
}

function parseVerdict(text: string): { verdict: "Junk" | "Stay"; reason: string } {
  const trimmed = text.trim();
  const firstLine = trimmed.split(/\n/)[0].trim();
  const lower = firstLine.toLowerCase();
  if (/\bjunk\b/.test(lower) && !/\bstay\b/.test(lower)) {
    return { verdict: "Junk", reason: trimmed };
  }
  if (/\bstay\b/.test(lower)) {
    return { verdict: "Stay", reason: trimmed };
  }
  // Fallback: scan whole text
  if (/\bjunk\b/i.test(trimmed) && !/\bstay\b/i.test(trimmed)) {
    return { verdict: "Junk", reason: trimmed };
  }
  // Default to Stay if we can't parse — don't accidentally skip the user out of good content
  return { verdict: "Stay", reason: `unparseable: ${trimmed.slice(0, 80)}` };
}

export async function scoreReel(
  meta: VideoMeta,
  settings: Settings,
): Promise<ScoredReel> {
  if (!settings.apiKey) throw new Error("missing API key");

  const client = new Anthropic({
    apiKey: settings.apiKey,
    dangerouslyAllowBrowser: true,
    timeout: 20_000,
    maxRetries: 1,
  });

  const response = await client.messages.create({
    model: settings.model,
    max_tokens: 50,
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
          `Title: ${meta.title}\n` +
          `Channel: ${meta.channel}\n\n` +
          `Reply with EXACTLY one word: "Junk" or "Stay". No punctuation, no explanation.`,
      },
    ],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  const { verdict, reason } = parseVerdict(text);

  return {
    videoId: meta.videoId,
    verdict,
    reason,
    scoredAt: Date.now(),
  };
}
