// Pulse-first guarantee for Ask responses.
// Prompt still instructs the model; this templates the trust signal if it forgets.

import type { ZuloRecommendationContext, ZuloResponse } from "./types"

export const PULSE_UNAVAILABLE_LEAD =
  "Pulse data unavailable for this token → confidence capped."

const UNAVAILABLE_CONFIDENCE_CAP = 55

export type PulseSubject = {
  hasSubject: boolean
  tokenId: number | null
  available: boolean
  pulseLevel: number | null
  maxLevel: number
  status: string | null
  breakdown: string[]
}

export function resolvePulseSubject(
  context: ZuloRecommendationContext,
): PulseSubject {
  const scope = context.platformContext?.subjectScope
  const pulse = context.platformContext?.pulse
  const speakerOnly = scope?.normieIsSpeakerIdentityOnly === true
  const general = scope?.mode === "general" || speakerOnly

  const mentioned = scope?.mentionedTokenIds?.[0]
  const active = scope?.activeNormieId
  const focus =
    pulse?.tokenId ??
    (typeof mentioned === "number" ? mentioned : null) ??
    (typeof active === "number" ? active : null) ??
    (!general ? context.normie.id : null)

  const hasSubject = !general && focus != null

  return {
    hasSubject,
    tokenId: hasSubject ? focus : null,
    available: hasSubject && pulse != null && typeof pulse.pulseLevel === "number",
    pulseLevel: pulse?.pulseLevel ?? null,
    maxLevel: pulse?.maxLevel ?? 5,
    status: pulse?.status ?? null,
    breakdown: pulse?.breakdown ?? [],
  }
}

function keySignals(breakdown: string[]): string {
  if (breakdown.length === 0) return "no signals yet"
  const short = breakdown.slice(0, 3).map((s) =>
    s
      .replace(/^Has active agent card$/i, "active agent card")
      .replace(/^Canvas activity detected$/i, "Canvas activity")
      .replace(/^Clean ownership & delegation$/i, "clean ownership")
      .replace(/^ERC-8004 registered$/i, "ERC-8004 registered"),
  )
  return short.join(" + ")
}

/** Canonical one-line Pulse snapshot for humans and agents. */
export function formatPulseLead(subject: PulseSubject): string | null {
  if (!subject.hasSubject) return null
  if (!subject.available || subject.pulseLevel == null) {
    return PULSE_UNAVAILABLE_LEAD
  }
  const status = subject.status ? ` (${subject.status})` : ""
  return `Pulse ${subject.pulseLevel}/${subject.maxLevel}${status} — ${keySignals(subject.breakdown)}. Ranked paths below are conditioned on this.`
}

export function hasPulseSignal(text: string | string[] | undefined): boolean {
  const blob = Array.isArray(text) ? text.join("\n") : text ?? ""
  return (
    /Pulse\s+\d+\s*\/\s*\d+/i.test(blob) ||
    /Pulse data unavailable/i.test(blob) ||
    /PULSE unavailable/i.test(blob)
  )
}

function prependText(existing: string, lead: string): string {
  const trimmed = existing.trim()
  if (!trimmed) return lead
  if (trimmed.startsWith(lead) || hasPulseSignal(trimmed)) return trimmed
  return `${lead}\n\n${trimmed}`
}

/**
 * Is trust part of this question? Pulse is a trust signal: it belongs on "can I trust / should I check / is this agent
 * legit / tell me about #1234", not on "how many pixels exist" or "how does burning work". Forcing it onto every reply
 * buried the actual answer under an unrelated line (live, 2026-11-10).
 */
export function isPulseRelevant(userQuery: string): boolean {
  return /\b(pulse|trust\w*|agents?|record( card)?|safe|legit\w*|scam\w*|rug\w*|buy\w*|purchas\w*|evaluat\w*|check\w*|compar\w*|vs\.?|versus|owners?|owned|delegat\w*|8004|awake\w*|reputation|ratings?|analy[sz]\w*|look (up|into|at)|tell me about|what about|who is|is #?\d{1,4})\b/i.test(
    userQuery,
  )
}

/**
 * Put the Pulse snapshot on replies where trust is part of the question and a subject token exists.
 * Pass the visitor's question to apply that relevance check; without it (older callers, tests) every subject reply gets it.
 * Never throws. Does not change ranking.
 */
export function ensurePulseFirst(
  response: ZuloResponse,
  context: ZuloRecommendationContext,
  userQuery?: string,
): ZuloResponse {
  if (userQuery !== undefined && !isPulseRelevant(userQuery)) return response
  const subject = resolvePulseSubject(context)
  const lead = formatPulseLead(subject)
  if (!lead) return response

  const confidence =
    subject.available
      ? response.confidence
      : Math.min(
          typeof response.confidence === "number" ? response.confidence : 70,
          UNAVAILABLE_CONFIDENCE_CAP,
        )

  return {
    ...response,
    pulseLead: lead,
    // New-format answers have no "understanding": the lead lives in pulseLead only, so it is not shown twice.
    understanding: response.understanding.trim() ? prependText(response.understanding, lead) : "",
    confidence,
  }
}
