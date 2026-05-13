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
  stages: string[]; // 10 entries, level 1 (lenient) → level 10 (strict)
  currentLevel: number; // 1–10
  autoSkipEnabled: boolean;
  autoAdvanceOnEnd: boolean;
}

export interface SessionLock {
  lockedAt: number;
  lockedAtLevel: number;
}

export const DEFAULT_RUBRIC = `You are classifying a single YouTube Short as "Junk" or "Stay" based on its title and channel name.

The user has set a strictness level for this session. Apply their level's description literally.

Decision rule:
- If the title/channel match the user's "Junk" criteria for their current level → output "Junk"
- Otherwise → output "Stay"
- When uncertain, lean "Junk" — the user wants discipline, not lenience.

Reply with EXACTLY one word: "Junk" or "Stay". No punctuation, no explanation, no quotes.`;

export const DEFAULT_STAGES: string[] = [
  // Level 1 — most lenient
  "Block ONLY blatant scams, dangerous misinformation, gore, and clear hate speech. Allow basically all other content including memes, gossip, and clickbait.",
  // Level 2
  "Block scams, gore, hate, and the worst clickbait (titles that are pure ALL-CAPS rage-bait). Allow normal memes, gossip, and reactions.",
  // Level 3
  "Block scams, gore, hate, and ANY title that is mostly emoji or hashtag-spam. Allow most other entertainment.",
  // Level 4
  "Block all of the above plus low-effort meme accounts, generic 'POV' content, and 'wait for it' bait.",
  // Level 5 — moderate
  "Block memes, prank, reaction, gossip, drama, 'tag a friend', and sigma/alpha bait. Allow well-made entertainment, hobbies, sports analysis, and original creative work.",
  // Level 6
  "Block all of the above plus generic comedy with no specific topic or original setup. Allow only entertainment with discernible craft (e.g. real comedians, narrative shorts, hobbyist depth).",
  // Level 7
  "Allow only educational, journalistic, or thoughtful-commentary content. Block all pure entertainment.",
  // Level 8
  "Allow only content that teaches a real skill (cooking technique, code, music theory, language, science, finance) or presents original analysis on a specific topic.",
  // Level 9
  "Allow only rigorous educational content from credible-sounding channels (academic, professional, journalist, expert). Block hobbyist explainers and shallow tutorials.",
  // Level 10 — strictest
  "Allow only deep technical, academic, or research-grade content. Block everything else, including most educational shorts that don't go beyond surface level.",
];

export const DEFAULT_SETTINGS: Settings = {
  apiKey: "",
  model: "claude-haiku-4-5",
  rubric: DEFAULT_RUBRIC,
  stages: DEFAULT_STAGES,
  currentLevel: 5,
  autoSkipEnabled: true,
  autoAdvanceOnEnd: true,
};
