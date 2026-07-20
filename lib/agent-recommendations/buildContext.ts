// lib/agent-recommendations/buildContext.ts
// Builds recommendation context with Normies + rarity API enrichment.

import { NORMIES_API_BASE } from "@/constants/contracts"
import { fetchWithTimeout } from "@/lib/fetch-with-timeout"
import { isAddress } from "viem"

import {
  DEFAULT_RESOURCE_LINKS,
  ECOSYSTEM_LINKS,
  MAX_SESSION_HISTORY,
  ZULO_IDENTITY,
} from "./constants"
import type { ZuloRecommendationContext } from "./types"

type BuildContextParams = {
  normieId?: number
  sessionHistory?: Array<{ userMessage: string; zuloResponse: string }>
  userWallet?: string
  userEns?: string
}

type TraitsPayload = {
  attributes?: Array<{ trait_type?: string; value?: string | number }>
}

type AgentInfoPayload = {
  tokenId?: string | number
  agentId?: string | number
  name?: string
  type?: string
  tagline?: string
  backstory?: string
  personalityTraits?: string[]
  communicationStyle?: string
  traits?: {
    name?: string
    attributes?: Record<string, string>
  }
  canvas?: {
    level?: number
    actionPoints?: number
    customized?: boolean
  }
}

type CanvasInfoPayload = {
  actionPoints?: number
  level?: number
  customized?: boolean
  delegate?: string
}

type OwnerPayload = {
  tokenId?: string
  owner?: string
}

type BindingPayload = {
  agentId?: string | number
  tokenId?: string | number
}

type HoldersPayload = {
  address?: string
  tokenIds?: Array<number | string>
}

type HistoryStatsPayload = {
  totalBurnCommitments?: number
  totalBurnedTokens?: number
  totalTransforms?: number
  totalTokenData?: number
  totalZombies?: number
  totalLegendaryCanvases?: number
  totalActionPointsDistributed?: string | number
  totalBurns?: number
  totalEdits?: number
  totalCustomized?: number
  [key: string]: unknown
}

type RarityPayload = {
  id?: number
  name?: string
  rank?: number
  rarityScore?: number
  fairValue?: number | string | null
  awake?: boolean
  openseaUrl?: string
  agentName?: string | null
  traitBreakdown?: Array<{
    trait_type?: string
    value?: string
    count?: number
    frequency?: number
  }>
  attributes?: Array<{ trait_type?: string; value?: string | number }>
}

type OpportunityInput = {
  tokenId: number
  traits: Record<string, string | number | boolean | null | undefined>
  customized: boolean
  actionPoints: number
  isAwakened: boolean
  agentType?: string
  rarityRank?: number | null
  rarityScore?: number | null
  holdingsCount?: number
}

async function fetchJsonSafe<T>(url: string, timeoutMs = 8_000): Promise<T | null> {
  try {
    const res = await fetchWithTimeout(url, {}, timeoutMs)
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

function normiesPath<T>(path: string, timeoutMs = 8_000): Promise<T | null> {
  return fetchJsonSafe<T>(`${NORMIES_API_BASE}${path}`, timeoutMs)
}

function traitsToRecord(traits: TraitsPayload | null): Record<string, string | number> {
  const out: Record<string, string | number> = {}
  if (!traits?.attributes) return out
  for (const attr of traits.attributes) {
    if (!attr.trait_type || attr.value === undefined || attr.value === null) continue
    out[attr.trait_type] = attr.value
  }
  return out
}

function parseTokenIds(raw: Array<number | string> | undefined): number[] {
  if (!raw?.length) return []
  const ids: number[] = []
  for (const item of raw) {
    const n = typeof item === "number" ? item : Number(item)
    if (Number.isFinite(n) && n >= 0) ids.push(n)
  }
  return ids.slice(0, 40)
}

function mapSessionHistory(
  history: Array<{ userMessage: string; zuloResponse: string }> | undefined,
): ZuloRecommendationContext["session"]["history"] {
  const now = new Date().toISOString()
  return (history ?? [])
    .slice(-MAX_SESSION_HISTORY)
    .map((h) => ({
      userMessage: h.userMessage,
      zuloResponse: h.zuloResponse,
      timestamp: now,
    }))
}

function generateOpportunities(input: OpportunityInput): string[] {
  const opportunities: string[] = []
  const typeValue = String(input.traits.Type ?? input.agentType ?? "")

  if (!input.customized) {
    opportunities.push(
      `Canvas: Untouched status on #${input.tokenId} (purist value) — strategic burns can earn AP for other Normies while keeping this pristine. Editor: ${ECOSYSTEM_LINKS.canvasEdit(input.tokenId)}`,
    )
  } else {
    opportunities.push(
      `Canvas: Modified #${input.tokenId} with ${input.actionPoints} AP remaining — continue editing carefully or lock aesthetics. Editor: ${ECOSYSTEM_LINKS.canvasEdit(input.tokenId)}`,
    )
  }

  if (input.actionPoints > 0) {
    opportunities.push(
      `Action Points: ${input.actionPoints} AP available — preview edits in Normifier (${ECOSYSTEM_LINKS.normifier}) before spending.`,
    )
  }

  if (input.isAwakened || typeValue === "Agent") {
    opportunities.push(
      `Agent: Awakened / Agent-class path — reputation building, Lab agentic tools (${ECOSYSTEM_LINKS.agentic}), future marketplace/delegation.`,
    )
  }

  if (input.rarityRank != null && Number.isFinite(input.rarityRank)) {
    if (input.rarityRank <= 1000) {
      opportunities.push(
        `High rarity rank #${input.rarityRank}${input.rarityScore != null ? ` (score ${input.rarityScore})` : ""} — hold/premium narrative; confirm on ${ECOSYSTEM_LINKS.rarity}`,
      )
    } else if (input.rarityRank > 5000) {
      opportunities.push(
        `More common rank #${input.rarityRank} — strategic Canvas burns for AP, trait targeting, or collection utility over pure rank chase. ${ECOSYSTEM_LINKS.rarity}`,
      )
    } else {
      opportunities.push(
        `Mid rarity rank #${input.rarityRank}${input.rarityScore != null ? ` (score ${input.rarityScore})` : ""} — balance holding vs targeted Canvas work. ${ECOSYSTEM_LINKS.rarity}`,
      )
    }
  }

  if (input.holdingsCount != null && input.holdingsCount > 1) {
    opportunities.push(
      `Holdings: ${input.holdingsCount} Normies — Multisend for batch ops (${ECOSYSTEM_LINKS.multisend}); burn commons, protect favorites.`,
    )
  }

  opportunities.push(
    `Community tools: Multisend (${ECOSYSTEM_LINKS.multisend}), Normifier (${ECOSYSTEM_LINKS.normifier}), API (${ECOSYSTEM_LINKS.api}).`,
  )
  opportunities.push(
    "Future: Normie Arena (PvP / pixel mechanics) — prepare by understanding Canvas and agent identity now.",
  )

  return opportunities
}

function buildMarketTrends(historyStats: HistoryStatsPayload | null): string {
  if (!historyStats) {
    return "Normies activity high with recent burns. Canvas editing active."
  }

  const parts: string[] = []
  if (typeof historyStats.totalBurnedTokens === "number") {
    parts.push(`burned tokens: ${historyStats.totalBurnedTokens}`)
  } else if (typeof historyStats.totalBurns === "number") {
    parts.push(`burns tracked: ${historyStats.totalBurns}`)
  }
  if (typeof historyStats.totalBurnCommitments === "number") {
    parts.push(`burn commitments: ${historyStats.totalBurnCommitments}`)
  }
  if (typeof historyStats.totalTransforms === "number") {
    parts.push(`transforms: ${historyStats.totalTransforms}`)
  } else if (typeof historyStats.totalEdits === "number") {
    parts.push(`canvas edits: ${historyStats.totalEdits}`)
  }
  if (historyStats.totalActionPointsDistributed != null) {
    parts.push(`AP distributed: ${historyStats.totalActionPointsDistributed}`)
  }
  if (typeof historyStats.totalLegendaryCanvases === "number") {
    parts.push(`legendary canvases: ${historyStats.totalLegendaryCanvases}`)
  }

  if (!parts.length) {
    return "Normies activity high with recent burns. Canvas editing active."
  }
  return `Normies activity snapshot — ${parts.join(", ")}.`
}

export async function buildZuloContext(
  params: BuildContextParams,
): Promise<ZuloRecommendationContext> {
  const now = new Date().toISOString()
  const tokenId =
    typeof params.normieId === "number" && Number.isFinite(params.normieId)
      ? params.normieId
      : ZULO_IDENTITY.tokenId

  const wallet =
    params.userWallet && isAddress(params.userWallet) ? params.userWallet : ""

  const [
    agentInfo,
    traits,
    canvasInfo,
    owner,
    binding,
    holders,
    historyStats,
    rarityData,
  ] = await Promise.all([
    normiesPath<AgentInfoPayload>(`/agents/info/${tokenId}`),
    normiesPath<TraitsPayload>(`/normie/${tokenId}/traits`),
    normiesPath<CanvasInfoPayload>(`/normie/${tokenId}/canvas/info`),
    normiesPath<OwnerPayload>(`/normie/${tokenId}/owner`),
    normiesPath<BindingPayload>(`/agents/binding/${tokenId}`),
    wallet ? normiesPath<HoldersPayload>(`/holders/${wallet}`) : Promise.resolve(null),
    normiesPath<HistoryStatsPayload>(`/history/stats`),
    fetchJsonSafe<RarityPayload>(
      `${ECOSYSTEM_LINKS.rarityApi}/normie/${tokenId}`,
      8_000,
    ),
  ])

  const traitRecord = {
    ...traitsToRecord(traits),
    ...(agentInfo?.traits?.attributes ?? {}),
  }

  // Prefer rarity attributes if traits endpoint was empty
  if (Object.keys(traitRecord).length === 0 && rarityData?.attributes) {
    for (const attr of rarityData.attributes) {
      if (!attr.trait_type || attr.value === undefined || attr.value === null) continue
      traitRecord[attr.trait_type] = attr.value
    }
  }

  const agentIdRaw = agentInfo?.agentId ?? binding?.agentId
  const agentIdNum =
    agentIdRaw !== undefined && agentIdRaw !== null && String(agentIdRaw).trim() !== ""
      ? Number(agentIdRaw)
      : tokenId === ZULO_IDENTITY.tokenId
        ? ZULO_IDENTITY.agentId
        : 0

  const isAwakened = !!(agentInfo?.agentId || binding?.agentId || rarityData?.awake)

  const ownerAddress =
    owner?.owner && isAddress(owner.owner) ? owner.owner : undefined
  const ownerMatchesUser =
    !!wallet && !!ownerAddress && wallet.toLowerCase() === ownerAddress.toLowerCase()

  const canvasLevel = canvasInfo?.level ?? agentInfo?.canvas?.level
  const canvasAp = canvasInfo?.actionPoints ?? agentInfo?.canvas?.actionPoints
  const canvasCustomized = canvasInfo?.customized ?? agentInfo?.canvas?.customized

  const holdingIds = parseTokenIds(holders?.tokenIds)
  const isZuloDefault = tokenId === ZULO_IDENTITY.tokenId

  const rarityRank =
    typeof rarityData?.rank === "number" && Number.isFinite(rarityData.rank)
      ? rarityData.rank
      : null
  const rarityScore =
    typeof rarityData?.rarityScore === "number" && Number.isFinite(rarityData.rarityScore)
      ? rarityData.rarityScore
      : null

  const traitHighlights =
    rarityData?.traitBreakdown
      ?.filter((t) => t.trait_type && t.value)
      .slice(0, 8)
      .map((t) => ({
        trait_type: String(t.trait_type),
        value: String(t.value),
        frequency: typeof t.frequency === "number" ? t.frequency : undefined,
      })) ?? []

  const customized = !!canvasCustomized
  const actionPoints = canvasAp ?? 0

  const earningOpportunities = generateOpportunities({
    tokenId,
    traits: traitRecord,
    customized,
    actionPoints,
    isAwakened: isAwakened || isZuloDefault,
    agentType: agentInfo?.type,
    rarityRank,
    rarityScore,
    holdingsCount: wallet ? holdingIds.length : undefined,
  })

  const context: ZuloRecommendationContext = {
    user: {
      ens: params.userEns?.trim() || undefined,
      walletAddress: wallet,
      preferences: {
        riskTolerance: "medium",
        goals: ["earn value", "grow collection", "agent utility"],
        interests: ["music", "art", "web3"],
      },
      holdings: wallet
        ? {
            normieCount: holdingIds.length,
            tokenIds: holdingIds,
          }
        : undefined,
    },
    normie: {
      id: tokenId,
      name:
        rarityData?.name ||
        agentInfo?.name ||
        agentInfo?.traits?.name ||
        (isZuloDefault ? `Normie #${ZULO_IDENTITY.tokenId}` : `Normie #${tokenId}`),
      traits: traitRecord,
      owner: ownerAddress,
      ownerMatchesUser,
      canvas:
        canvasLevel !== undefined || canvasAp !== undefined
          ? {
              level: canvasLevel ?? 0,
              actionPoints: actionPoints,
              customized,
              delegate: canvasInfo?.delegate,
            }
          : isZuloDefault
            ? {
                level: 1,
                actionPoints: 0,
                customized: false,
              }
            : undefined,
      rarity: {
        rank: rarityRank,
        score: rarityScore,
        fairValue: rarityData?.fairValue ?? null,
        awake: rarityData?.awake,
        openseaUrl: rarityData?.openseaUrl,
        traitHighlights: traitHighlights.length ? traitHighlights : undefined,
      },
      agent: {
        id: Number.isFinite(agentIdNum) && agentIdNum > 0 ? agentIdNum : ZULO_IDENTITY.agentId,
        name:
          agentInfo?.name ||
          rarityData?.agentName ||
          (isZuloDefault ? ZULO_IDENTITY.name : `Agent for #${tokenId}`),
        status: isAwakened || isZuloDefault ? "awakened" : "dormant",
        reputation: isZuloDefault ? 75 : undefined,
        walletAddress: isZuloDefault ? ZULO_IDENTITY.hotWallet : undefined,
        ens: isZuloDefault ? ZULO_IDENTITY.ens : undefined,
        type: agentInfo?.type,
        tagline: agentInfo?.tagline,
        backstory: agentInfo?.backstory,
        personalityTraits: agentInfo?.personalityTraits,
        communicationStyle: agentInfo?.communicationStyle,
        recentActivity: [],
      },
    },
    session: {
      history: mapSessionHistory(params.sessionHistory),
      currentGoal: "maximize agent and Normie value",
    },
    platformContext: {
      currentTime: now,
      recentMarketTrends: buildMarketTrends(historyStats),
      earningOpportunities,
      rarityRank,
      rarityScore,
      fairValue: rarityData?.fairValue ?? null,
      resources: [
        ...DEFAULT_RESOURCE_LINKS,
        ECOSYSTEM_LINKS.canvasEdit(tokenId),
        rarityData?.openseaUrl,
      ].filter((u): u is string => typeof u === "string" && u.length > 0),
    },
  }

  return context
}
