// Pulse + access + relevance scoring for path candidates.

import type {
  AccessStatus,
  PathCandidate,
  PathScore,
  RankPathsSubject,
  ScoreWeights,
} from "./types"
import { DEFAULT_SCORE_WEIGHTS } from "./types"

export { DEFAULT_SCORE_WEIGHTS }
import { keywordRelevanceScore, tagOverlapScore } from "./intents"
import type { IntentTag, ParsedIntent } from "./types"

/**
 * Access component (0–1).
 * Prefer open/granted paths; still surface gated with lower score.
 */
export function accessScore(status: AccessStatus): number {
  switch (status) {
    case "open":
      return 1
    case "granted":
      return 0.95
    case "n/a":
      return 0.85
    case "unknown":
      return 0.55
    case "gated":
      return 0.35
    default:
      return 0.5
  }
}

/**
 * Pulse component (0–1).
 * Uses subject pulse + gaps + candidate affinity from existing scorers.
 */
export function pulseScore(
  candidate: PathCandidate,
  subject: RankPathsSubject,
  intentTags: IntentTag[],
): number {
  // No Normie loaded → neutral pulse axis; relevance/access drive rank
  if (subject.tokenId == null || subject.pulse_level == null) {
    return 0.5
  }

  const level = subject.pulse_level
  const gaps = subject.gaps ?? []
  let score = 0.4

  // Normalize pulseAffinity (typically 0–80 from scoreToolForAgent-ish)
  const affinity = Math.min(1, Math.max(0, candidate.pulseAffinity / 80))
  score += affinity * 0.35

  // Gap-closing boosts by path kind / tags
  if (gaps.includes("ERC-8004 registered") || gaps.includes("Has active agent card")) {
    if (
      candidate.tags.includes("identity") ||
      candidate.tags.includes("pulse") ||
      candidate.skillId === "pulse-analysis"
    ) {
      score += 0.2
    }
  }
  if (gaps.includes("Canvas activity detected")) {
    if (candidate.tags.includes("canvas") || candidate.skillId === "canvas-evolution") {
      score += 0.18
    }
  }
  if (gaps.includes("Clean ownership & delegation")) {
    if (candidate.tags.includes("access") || candidate.tags.includes("identity")) {
      score += 0.1
    }
  }

  // Low pulse → identity / pulse / reputation paths win
  if (level <= 2) {
    if (
      candidate.tags.includes("identity") ||
      candidate.tags.includes("pulse") ||
      candidate.skillId === "pulse-analysis"
    ) {
      score += 0.15
    }
  }

  // Strong pulse → canvas / market / burn efficiency fair game
  if (level >= 4) {
    if (
      candidate.tags.includes("canvas") ||
      candidate.tags.includes("burn") ||
      candidate.tags.includes("market")
    ) {
      score += 0.12
    }
  }

  // Intent-aligned pulse tools
  if (intentTags.includes("pulse") && candidate.skillId === "pulse-analysis") {
    score += 0.15
  }
  if (intentTags.includes("pulse") && candidate.pathId.includes(":53")) {
    score += 0.12
  }

  // Canvas with idle canvas + AP
  if (
    (subject.canvasLevel ?? 0) === 0 &&
    (subject.actionPoints ?? 0) > 0 &&
    candidate.tags.includes("canvas")
  ) {
    score += 0.12
  }

  return Math.min(1, Math.max(0, score))
}

/**
 * Relevance component (0–1): intent tags + keywords.
 */
export function relevanceScore(
  candidate: PathCandidate,
  intent: ParsedIntent,
): number {
  const tagPart = tagOverlapScore(candidate.tags, intent.tags)
  const kwPart = keywordRelevanceScore(candidate.keywords, intent.raw)
  // Exact skill↔primary tag boost
  let exact = 0
  if (
    candidate.skillId &&
    candidate.tags[0] &&
    intent.primary === candidate.tags[0]
  ) {
    exact = 0.2
  }
  return Math.min(1, tagPart * 0.7 + kwPart * 0.3 + exact)
}

export function combineScores(
  parts: { pulse: number; access: number; relevance: number },
  weights: ScoreWeights = DEFAULT_SCORE_WEIGHTS,
): PathScore {
  const total =
    weights.pulse * parts.pulse +
    weights.access * parts.access +
    weights.relevance * parts.relevance

  return {
    total: round4(total),
    pulse: round4(parts.pulse),
    access: round4(parts.access),
    relevance: round4(parts.relevance),
  }
}

export function scoreCandidate(
  candidate: PathCandidate,
  subject: RankPathsSubject,
  intent: ParsedIntent,
  weights: ScoreWeights = DEFAULT_SCORE_WEIGHTS,
  signalBoost = 0,
): PathScore {
  const parts = {
    pulse: pulseScore(candidate, subject, intent.tags),
    access: accessScore(candidate.access.status),
    relevance: relevanceScore(candidate, intent),
  }
  const score = combineScores(parts, weights)
  if (signalBoost !== 0) {
    score.total = round4(Math.min(1, Math.max(0, score.total + signalBoost)))
  }
  return score
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000
}
