export interface VideoMeta {
  videoId: string;
  title: string;
  channel: string;
}

export type Verdict = "Junk" | "Stay";

export interface ScoredReel {
  videoId: string;
  verdict: Verdict;
  reason: string;
  scoredAt: number;
}

export interface Settings {
  apiKey: string;
  model: string;
  rubric: string;
  autoSkipEnabled: boolean;
}

export const DEFAULT_RUBRIC = `You are classifying a single YouTube Short as either "Junk" or "Stay" based on title and channel name.

"Junk" = engagement-bait, low-effort meme, prank, gossip, drama, manufactured outrage, generic reaction, "POV" content, sigma/alpha bait, clickbait titles (ALL CAPS, "you won't believe", arrows, multiple ?!?!), brainrot.

"Stay" = teaches a real skill, expands worldview, presents rigorous information, thoughtful commentary, genuine creativity, well-made entertainment, hobbies, sports analysis.

When uncertain, lean "Junk" — the user wants a strict filter.`;

export const DEFAULT_SETTINGS: Settings = {
  apiKey: "",
  model: "claude-haiku-4-5",
  rubric: DEFAULT_RUBRIC,
  autoSkipEnabled: true,
};
