// Zulo answer log — pure row builder (no database, no network; tested on its own).
//
// The row holds ONLY Zulo's own words and the public Normie id. It has no field for the person's question, wallet,
// ENS or IP, so there is nothing personal to leak even by mistake. See supabase/sql/2026-10-18-zulo-answer-log.sql.

export const ANSWER_LOG_LIMITS = {
  recommendation: 2000,
  pulseLead: 500,
  nextStep: 300,
  nextSteps: 8,
} as const

/** Answers older than this are deleted on the next write (stated on /privacy). */
export const ANSWER_LOG_RETENTION_DAYS = 180

export type ZuloAnswerLogRow = {
  surface: "ask"
  normie_id: number | null
  recommendation: string
  next_steps: string[]
  confidence: number | null
  pulse_lead: string | null
}

/** The parts of a Zulo answer the log keeps. Anything else passed in is ignored. */
export type ZuloAnswerForLog = {
  recommendation: string | string[]
  nextSteps?: string[]
  confidence?: number
  pulseLead?: string
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

/** Normie id 0–9999, else null. */
function normieIdOrNull(id: unknown): number | null {
  return typeof id === "number" && Number.isInteger(id) && id >= 0 && id <= 9999 ? id : null
}

/** Confidence as 0–1. Accepts 0–1 or a 0–100 percentage; anything else is null. */
function confidenceOrNull(c: unknown): number | null {
  if (typeof c !== "number" || !Number.isFinite(c) || c < 0) return null
  const v = c > 1 ? c / 100 : c
  return v <= 1 ? Math.round(v * 1000) / 1000 : null
}

/** Build the row, or null when there is nothing worth grading (empty answer). */
export function buildAnswerLogRow(answer: ZuloAnswerForLog, normieId?: number | null): ZuloAnswerLogRow | null {
  const rec = Array.isArray(answer.recommendation)
    ? answer.recommendation.filter((x) => typeof x === "string").join("\n")
    : typeof answer.recommendation === "string"
      ? answer.recommendation
      : ""
  const recommendation = rec.trim()
  if (!recommendation) return null

  const next_steps = (Array.isArray(answer.nextSteps) ? answer.nextSteps : [])
    .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    .slice(0, ANSWER_LOG_LIMITS.nextSteps)
    .map((x) => clip(x.trim(), ANSWER_LOG_LIMITS.nextStep))

  const lead = typeof answer.pulseLead === "string" ? answer.pulseLead.trim() : ""

  return {
    surface: "ask",
    normie_id: normieIdOrNull(normieId),
    recommendation: clip(recommendation, ANSWER_LOG_LIMITS.recommendation),
    next_steps,
    confidence: confidenceOrNull(answer.confidence),
    pulse_lead: lead ? clip(lead, ANSWER_LOG_LIMITS.pulseLead) : null,
  }
}

/** The switch: logging runs only when ZULO_ANSWER_LOG is on AND the server-only key exists. */
export function answerLogEnabled(env: Record<string, string | undefined> = process.env): boolean {
  const flag = env.ZULO_ANSWER_LOG?.trim().toLowerCase()
  const on = flag === "1" || flag === "true" || flag === "on" || flag === "yes"
  return on && !!env.SUPABASE_SERVICE_ROLE_KEY?.trim()
}
