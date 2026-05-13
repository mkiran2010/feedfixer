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
  stages: string[];
  currentLevel: number;
  useCustomInstruction: boolean;
  customInstruction: string;
  autoSkipEnabled: boolean;
  autoAdvanceOnEnd: boolean;
}

export interface SessionLock {
  lockedAt: number;
  lockedAtLevel: number;
  customInstructionAtLock: string | null;
}

export const DEFAULT_RUBRIC = `You are classifying a single YouTube Short as "Junk" or "Stay" based on its title and channel name.

The user has provided a filter rule for this session. Apply it literally.

Decision rule:
- If the title/channel match the user's "Junk" criteria → output "Junk"
- Otherwise → output "Stay"
- When uncertain, lean "Junk" — the user wants discipline, not lenience.

Reply with EXACTLY one word: "Junk" or "Stay". No punctuation, no explanation, no quotes.`;

export const DEFAULT_STAGES: string[] = [
  "Block ONLY blatant scams, dangerous misinformation, gore, and clear hate speech. Allow basically all other content including memes, gossip, and clickbait.",
  "Block scams, gore, hate, and the worst clickbait (titles that are pure ALL-CAPS rage-bait). Allow normal memes, gossip, and reactions.",
  "Block scams, gore, hate, and ANY title that is mostly emoji or hashtag-spam. Allow most other entertainment.",
  "Block all of the above plus low-effort meme accounts, generic 'POV' content, and 'wait for it' bait.",
  "Block memes, prank, reaction, gossip, drama, 'tag a friend', and sigma/alpha bait. Allow well-made entertainment, hobbies, sports analysis, and original creative work.",
  "Block all of the above plus generic comedy with no specific topic or original setup. Allow only entertainment with discernible craft (e.g. real comedians, narrative shorts, hobbyist depth).",
  "Allow only educational, journalistic, or thoughtful-commentary content. Block all pure entertainment.",
  "Allow only content that teaches a real skill (cooking technique, code, music theory, language, science, finance) or presents original analysis on a specific topic.",
  "Allow only rigorous educational content from credible-sounding channels (academic, professional, journalist, expert). Block hobbyist explainers and shallow tutorials.",
  "Allow only deep technical, academic, or research-grade content. Block everything else, including most educational shorts that don't go beyond surface level.",
];

export const DEFAULT_CUSTOM_INSTRUCTION = `Only stay on videos that indicate substantive content about science, mathematics, philosophy, history, or skill-based tutorials. Classify anything else (memes, reactions, comedy, sports clips, general entertainment) as junk.`;

export const DEFAULT_SETTINGS: Settings = {
  apiKey: "",
  model: "claude-haiku-4-5",
  rubric: DEFAULT_RUBRIC,
  stages: DEFAULT_STAGES,
  currentLevel: 5,
  useCustomInstruction: false,
  customInstruction: DEFAULT_CUSTOM_INSTRUCTION,
  autoSkipEnabled: true,
  autoAdvanceOnEnd: true,
};
