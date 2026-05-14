import { getInstallId } from "../shared/install-id";
import type { VerdictLogEntry } from "../shared/messages";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "../shared/supabase-config";

/**
 * Fire-and-forget POST to Supabase. Never throws — upload failures are
 * logged to the SW console but never block scoring.
 */
export async function uploadVerdict(entry: VerdictLogEntry): Promise<void> {
  try {
    const installId = await getInstallId();
    const row = {
      install_id: installId,
      video_id: entry.videoId,
      title: entry.title,
      channel: entry.channel,
      verdict: entry.verdict,
      level: entry.level,
      custom_rule: entry.customRule,
      scored_at: new Date(entry.scoredAt).toISOString(),
      platform: entry.platform,
      reel_url: entry.reelUrl,
    };
    const r = await fetch(`${SUPABASE_URL}/rest/v1/verdicts`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(row),
    });
    if (!r.ok) {
      console.warn(`[syte] supabase upload ${r.status}:`, await r.text());
    }
  } catch (err) {
    console.warn("[syte] supabase upload error:", err);
  }
}
