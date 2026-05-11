export interface VideoMeta {
  videoId: string;
  title: string;
  channel: string;
  description?: string;
  durationSeconds?: number;
}

export interface Score {
  videoId: string;
  score: number;
  reason?: string;
  scoredAt: number;
  rubricVersion: number;
  model: string;
}

export type Verdict = "allow" | "hide" | "pending";

export interface Settings {
  enabled: boolean;
  apiKey: string;
  model: string;
  rubric: string;
  rubricVersion: number;
  junkPct: number;
  junkThreshold: number;
  pausedUntil: number | null;
  debugForceJunk: boolean;
}

export interface SessionStats {
  shown: number;
  hidden: number;
  scoreSum: number;
  scoreCount: number;
  bucketTokens: number;
  scoreRequestsReceived: number;
  lastScoreRequestAt: number | null;
}

export const DEFAULT_RUBRIC = `Score each video 0-100 on how enriching it is to watch.

100 = teaches a real skill, expands worldview, presents rigorous information, makes me think hard, motivates real action.
75  = thoughtful and substantive (good explainer, deep interview, well-reported story).
50  = entertaining but neutral (well-made entertainment, hobbies, sports analysis).
25  = engagement-bait, gossip, drama, prank, low-effort reaction, manufactured outrage.
0   = pure brainrot — empty stimulation, scammy, deceptive thumbnails, cheap shock.

Educational > entertaining > emotional > inflammatory.
Penalize clickbait titles (ALL CAPS, "you won't believe", arrows, ?!?!).
Reward channels with consistent depth over flashy one-offs.
Be calibrated: most YouTube videos sit between 30-60. Reserve 90+ for genuinely excellent content.`;

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  apiKey: "",
  model: "claude-haiku-4-5",
  rubric: DEFAULT_RUBRIC,
  rubricVersion: 1,
  junkPct: 20,
  junkThreshold: 50,
  pausedUntil: null,
  debugForceJunk: false,
};
