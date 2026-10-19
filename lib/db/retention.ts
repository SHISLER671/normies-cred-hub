// Retention for server-only Supabase tables (promised on /privacy). Never throws; a failed delete is logged and
// retried on the next write or cron run.
//
// - recommendation_feedback (Move 👍/👎, may hold an unverified wallet): 180 days (Ryan, 2026-10-19).
// - zulo_answer_log (Zulo's own words only): 180 days (lib/zulo/answer-log-row.ts).
//
// Runs after each rating is saved and on every authorized cron call, so rows still expire when nobody rates.

import { getPrivateDb } from "@/lib/db/supabase"
import { ANSWER_LOG_RETENTION_DAYS } from "@/lib/zulo/answer-log-row"

import { RATINGS_RETENTION_DAYS, retentionCutoff } from "./retention-policy"

export async function purgeExpiredRows(now = new Date()): Promise<{ ok: boolean }> {
  const db = getPrivateDb()
  if (!db) return { ok: false }
  let ok = true
  for (const [table, days] of [
    ["recommendation_feedback", RATINGS_RETENTION_DAYS],
    ["zulo_answer_log", ANSWER_LOG_RETENTION_DAYS],
  ] as const) {
    try {
      const { error } = await db.from(table).delete().lt("created_at", retentionCutoff(now, days))
      if (error) {
        ok = false
        console.warn(`[retention] ${table} delete failed:`, error.message)
      }
    } catch (err) {
      ok = false
      console.warn(`[retention] ${table} delete failed:`, err instanceof Error ? err.message : err)
    }
  }
  return { ok }
}
