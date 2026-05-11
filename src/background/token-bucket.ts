import type { SessionStats, Verdict } from "../shared/types";

const KEY = "feedfixer.session";

const FRESH: SessionStats = {
  shown: 0,
  hidden: 0,
  scoreSum: 0,
  scoreCount: 0,
  bucketTokens: 0,
  scoreRequestsReceived: 0,
  lastScoreRequestAt: null,
};

export async function bumpScoreRequest(count: number): Promise<void> {
  const stats = await loadStats();
  stats.scoreRequestsReceived += count;
  stats.lastScoreRequestAt = Date.now();
  await chrome.storage.session.set({ [KEY]: stats });
}

export async function loadStats(): Promise<SessionStats> {
  const got = await chrome.storage.session.get(KEY);
  return (got[KEY] as SessionStats | undefined) ?? { ...FRESH };
}

async function saveStats(s: SessionStats): Promise<void> {
  await chrome.storage.session.set({ [KEY]: s });
}

export async function resetStats(): Promise<void> {
  await chrome.storage.session.set({ [KEY]: { ...FRESH } });
}

/**
 * Decide whether to allow a video given its score and the user's junk quota.
 * Long-run ratio of shown junk videos converges on `junkPct`.
 */
export async function decide(
  score: number,
  junkPct: number,
  junkThreshold: number,
): Promise<Verdict> {
  const stats = await loadStats();
  const isJunk = score < junkThreshold;
  const junkAllowed = junkPct / 100;

  if (!isJunk) {
    stats.shown += 1;
    stats.scoreSum += score;
    stats.scoreCount += 1;
    stats.bucketTokens += junkAllowed;
    await saveStats(stats);
    return "allow";
  }

  if (stats.bucketTokens > 0) {
    stats.shown += 1;
    stats.scoreSum += score;
    stats.scoreCount += 1;
    stats.bucketTokens -= 1 - junkAllowed;
    await saveStats(stats);
    return "allow";
  }

  stats.hidden += 1;
  await saveStats(stats);
  return "hide";
}
