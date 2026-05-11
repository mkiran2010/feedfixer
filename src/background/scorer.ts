import Anthropic from "@anthropic-ai/sdk";
import type { Score, Settings, VideoMeta } from "../shared/types";

interface ScoredItem {
  id: string;
  score: number;
  reason?: string;
}

function buildUserPrompt(videos: VideoMeta[]): string {
  const lines = videos.map((v, i) => {
    const desc = (v.description ?? "").slice(0, 280).replace(/\s+/g, " ");
    return `${i + 1}. id=${v.videoId}
   channel: ${v.channel}
   title: ${v.title}
   desc: ${desc}`;
  });
  return `Score the following videos 0-100 for "enrichment" per the rubric in the system prompt.

Return ONLY a JSON array, one entry per video, in the form:
[{"id": "<videoId>", "score": <0-100 integer>, "reason": "<one short clause>"}]

No prose, no markdown fences, no preamble. Just the array.

Videos:
${lines.join("\n\n")}`;
}

function extractJsonArray(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("[");
  const end = body.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("no JSON array in response");
  }
  return JSON.parse(body.slice(start, end + 1));
}

function clamp(n: number): number {
  if (!Number.isFinite(n)) return 50;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export async function scoreBatch(
  videos: VideoMeta[],
  settings: Settings,
): Promise<Score[]> {
  if (videos.length === 0) return [];
  if (!settings.apiKey) {
    throw new Error("missing API key — set one in FeedFixer options");
  }

  const client = new Anthropic({
    apiKey: settings.apiKey,
    dangerouslyAllowBrowser: true,
    timeout: 30_000,
    maxRetries: 1,
  });

  const response = await client.messages.create({
    model: settings.model,
    max_tokens: Math.min(4096, 200 + videos.length * 80),
    system: [
      {
        type: "text",
        text: settings.rubric,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: buildUserPrompt(videos) }],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");

  const parsed = extractJsonArray(text);
  if (!Array.isArray(parsed)) throw new Error("scorer: response not an array");

  const now = Date.now();
  const byId = new Map<string, ScoredItem>();
  for (const item of parsed as ScoredItem[]) {
    if (item && typeof item.id === "string" && typeof item.score === "number") {
      byId.set(item.id, item);
    }
  }

  return videos.map<Score>((v) => {
    const hit = byId.get(v.videoId);
    return {
      videoId: v.videoId,
      score: hit ? clamp(hit.score) : 50,
      reason: hit?.reason,
      scoredAt: now,
      rubricVersion: settings.rubricVersion,
      model: settings.model,
    };
  });
}
