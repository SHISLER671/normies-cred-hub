// Orchestrate intent → 3–5 ranked paths (Pulse + access + relevance).

import { getAgentPulse } from "@/lib/api/agent-pulse"
import {
  buildZuloToolContext,
  derivePulseGaps,
  type ZuloToolContext,
} from "@/lib/erc8257/context"
import { prepareZuloRegistryTools } from "@/lib/erc8257/zulo-select"
import {
  getBurnOpportunities,
  getFloorTrend,
  isSupabaseConfigured,
} from "@/lib/db/supabase"

import {
  candidatesFromCommunity,
  candidatesFromNormiesTools,
  candidatesFromRegistryTools,
  candidatesFromSkills,
  mergeCandidates,
} from "./candidates"
import { parseIntent } from "./intents"
import { PATH_FINDER_NOTE, buildRationale } from "./rationale"
import { scoreCandidate } from "./score"
import type {
  PathCandidate,
  RankPathsInput,
  RankPathsResult,
  RankPathsSubject,
  RankedPath,
} from "./types"
import { MAX_PATHS, MIN_PATHS } from "./types"

export async function rankPaths(input: RankPathsInput): Promise<RankPathsResult> {
  const intent = parseIntent({
    intent: input.intent,
    intentTag: input.intentTag,
  })

  const limit = clampLimit(input.limit)
  const subject = await loadSubject(input.tokenId)
  const ctx = subject.tokenId != null ? subjectToCtx(subject, input.wallet) : undefined

  // Registry tools (access-enriched when wallet present)
  let registryTools: Awaited<ReturnType<typeof prepareZuloRegistryTools>> = []
  try {
    registryTools = await prepareZuloRegistryTools({
      ctx,
      holderAddress: input.wallet,
      limit: 20,
      maxAccessChecks: input.wallet ? 40 : 0,
    })
  } catch (err) {
    console.warn("[path-ranker] registry tools failed:", err)
  }

  const candidates = mergeCandidates(
    candidatesFromSkills(intent, input.tokenId),
    candidatesFromNormiesTools(ctx, intent, 8),
    candidatesFromRegistryTools(registryTools, ctx, intent, 12),
    candidatesFromCommunity(intent, 2),
  )

  const boosts = await signalBoosts(intent.tags, candidates)

  const scored = candidates.map((c) => {
    const score = scoreCandidate(c, subject, intent, undefined, boosts.get(c.pathId) ?? 0)
    const path: RankedPath = {
      rank: 0,
      pathId: c.pathId,
      kind: c.kind,
      title: c.title,
      publisher: c.publisher,
      pulse: {
        level: subject.pulse_level,
        status: subject.status,
        badge:
          subject.pulse_level != null
            ? `Pulse ${subject.pulse_level}/5${subject.status ? ` · ${subject.status}` : ""}`
            : "Pulse — load a Normie",
      },
      access: c.access,
      score,
      rationale: buildRationale(c, intent, subject),
      nextStep: c.nextStep,
      intentTags: c.tags,
    }
    return path
  })

  scored.sort((a, b) => b.score.total - a.score.total)

  // Drop near-zero relevance noise when we already have enough intent hits
  // (avoids random registry tools on a focused burn/market intent).
  const relevant = scored.filter((p) => p.score.relevance >= 0.15)
  const pool =
    relevant.length >= MIN_PATHS
      ? relevant
      : scored.filter((p) => p.score.relevance > 0 || p.kind === "zulo-skill")

  // Ensure diversity of kinds when possible (avoid 5 identical kinds)
  const paths = diversifyTop(pool.length >= MIN_PATHS ? pool : scored, limit)

  paths.forEach((p, i) => {
    p.rank = i + 1
  })

  return {
    ok: true,
    intent,
    subject: {
      tokenId: subject.tokenId,
      pulse_level: subject.pulse_level,
      status: subject.status,
      gaps: subject.gaps,
      canvasLevel: subject.canvasLevel,
      actionPoints: subject.actionPoints,
      isAwakened: subject.isAwakened,
    },
    paths,
    zulo: {
      role: "path-finder",
      note: PATH_FINDER_NOTE,
    },
    payments: { status: "planned" },
    asOf: new Date().toISOString(),
  }
}

async function loadSubject(tokenId?: number): Promise<RankPathsSubject> {
  if (tokenId == null || !Number.isFinite(tokenId)) {
    return {
      tokenId: null,
      pulse_level: null,
      status: null,
      gaps: [],
    }
  }

  const id = Math.floor(tokenId)
  try {
    const result = await getAgentPulse(id)
    if (!result.ok) {
      return {
        tokenId: id,
        pulse_level: null,
        status: null,
        gaps: [],
      }
    }
    const p = result.data
    return {
      tokenId: id,
      pulse_level: p.pulse_level,
      status: p.status,
      gaps: derivePulseGaps(p.breakdown),
      breakdown: p.breakdown,
      isAwakened: p.agent_id != null,
    }
  } catch {
    return {
      tokenId: id,
      pulse_level: null,
      status: null,
      gaps: [],
    }
  }
}

function subjectToCtx(
  subject: RankPathsSubject,
  wallet?: string,
): ZuloToolContext {
  return buildZuloToolContext({
    tokenId: subject.tokenId ?? 0,
    isAwakened: subject.isAwakened ?? false,
    pulse:
      subject.pulse_level != null
        ? {
            token_id: subject.tokenId ?? 0,
            agent_id: null,
            pulse_level: subject.pulse_level,
            max_level: 5,
            status: subject.status ?? "Unknown",
            breakdown: subject.breakdown ?? [],
            next_signal: null,
            note: "",
          }
        : null,
    canvasLevel: subject.canvasLevel ?? undefined,
    actionPoints: subject.actionPoints ?? undefined,
    holderAddress: wallet,
  })
}

/**
 * Small Supabase signal boosts (≤ 0.1). Reads only; degrade if unavailable.
 */
async function signalBoosts(
  tags: string[],
  candidates: PathCandidate[],
): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  if (!isSupabaseConfigured()) return map

  try {
    if (tags.includes("burn")) {
      const opps = await getBurnOpportunities({ days: 14, limit: 20 })
      const high = opps.filter(
        (o) => o.efficiency_score != null && o.efficiency_score >= 2,
      )
      if (high.length > 0) {
        for (const c of candidates) {
          if (
            c.skillId === "burn-efficiency" ||
            c.pathId.includes("burn") ||
            c.tags.includes("burn")
          ) {
            map.set(c.pathId, (map.get(c.pathId) ?? 0) + 0.08)
          }
        }
      }
    }

    if (tags.includes("market")) {
      const trend = await getFloorTrend(7)
      if (
        trend.sampleSize >= 2 &&
        trend.latestFloorETH != null &&
        trend.avgFloorETH != null &&
        trend.avgFloorETH > 0
      ) {
        const deltaPct =
          Math.abs(trend.latestFloorETH - trend.avgFloorETH) / trend.avgFloorETH
        if (deltaPct >= 0.05) {
          for (const c of candidates) {
            if (
              c.skillId === "market-sentinel" ||
              c.tags.includes("market")
            ) {
              map.set(c.pathId, (map.get(c.pathId) ?? 0) + 0.08)
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn("[path-ranker] signal boosts skipped:", err)
  }

  return map
}

function clampLimit(limit?: number): number {
  if (limit == null || !Number.isFinite(limit)) return MAX_PATHS
  return Math.max(MIN_PATHS, Math.min(MAX_PATHS, Math.floor(limit)))
}

/**
 * Take top scores but prefer variety of kinds in the final 3–5.
 */
function diversifyTop(sorted: RankedPath[], limit: number): RankedPath[] {
  if (sorted.length <= limit) return sorted.slice(0, limit)

  const picked: RankedPath[] = []
  const kindCount = new Map<string, number>()

  // First pass: greedy with soft kind cap
  for (const p of sorted) {
    if (picked.length >= limit) break
    const k = p.kind
    const n = kindCount.get(k) ?? 0
    if (n >= 2 && picked.length < limit - 1) {
      // allow later if we need to fill
      continue
    }
    picked.push(p)
    kindCount.set(k, n + 1)
  }

  // Fill remaining from sorted
  if (picked.length < limit) {
    const ids = new Set(picked.map((p) => p.pathId))
    for (const p of sorted) {
      if (picked.length >= limit) break
      if (ids.has(p.pathId)) continue
      picked.push(p)
      ids.add(p.pathId)
    }
  }

  // Re-sort by score after diversification
  picked.sort((a, b) => b.score.total - a.score.total)
  return picked.slice(0, limit)
}
