// Zulo answer log — server-only writer. Fire-and-forget after the Ask response; never throws, never slows Ask.
// Off unless ZULO_ANSWER_LOG is on and SUPABASE_SERVICE_ROLE_KEY is set (the table is server-only; the public key
// can't write to it). Only Zulo's own words are stored — see answer-log-row.ts.

import { getPrivateDb } from "@/lib/db/supabase"

import { ANSWER_LOG_RETENTION_DAYS, answerLogEnabled, buildAnswerLogRow, type ZuloAnswerForLog } from "./answer-log-row"

export async function recordZuloAnswer(answer: ZuloAnswerForLog, normieId?: number | null): Promise<void> {
  if (!answerLogEnabled()) return
  const row = buildAnswerLogRow(answer, normieId)
  if (!row) return
  try {
    const db = getPrivateDb()
    if (!db) return
    const { error } = await db.from("zulo_answer_log").insert(row)
    if (error) console.warn("[zulo-answer-log] insert failed:", error.message)
    // Retention promised on /privacy: drop answers older than ANSWER_LOG_RETENTION_DAYS (indexed on created_at, cheap).
    const cutoff = new Date(Date.now() - ANSWER_LOG_RETENTION_DAYS * 86_400_000).toISOString()
    const { error: purgeError } = await db.from("zulo_answer_log").delete().lt("created_at", cutoff)
    if (purgeError) console.warn("[zulo-answer-log] retention delete failed:", purgeError.message)
  } catch (err) {
    console.warn("[zulo-answer-log] insert failed:", err instanceof Error ? err.message : err)
  }
}
