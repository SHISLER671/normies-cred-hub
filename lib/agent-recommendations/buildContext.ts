// lib/agent-recommendations/buildContext.ts
// Builds recommendation context with Normies + rarity + CredHub PULSE enrichment.

import { NORMIES_API_BASE } from "@/constants/contracts"
import { getAgentPulse } from "@/lib/api/agent-pulse"
import { buildPulseSummary, derivePulseGaps } from "@/lib/erc8257/context"
import { fetchWithTimeout } from "@/lib/fetch-with-timeout"
import { isAddress } from "viem"

import {
  DEFAULT_RESOURCE_LINKS,
  ECOSYSTEM_LINKS,
  MAX_SESSION_HISTORY,
  ZULO_IDENTITY,
} from "./constants"
import { tierFromRank, type OwnedNormieSnapshot } from "./burnData"
import {
  getCollabRailsContextSummary,
  getDualEvalAndPixelMarketContextSummary,
  getErc6551ContextSummary,
  getPaymentSecurityContextSummary,
  getPixelEconomyContextSummary,
  getProtocolsDeepDiveContextSummary,
} from "./loadKnowledge"
import { getPixelCurrencyContextSummary } from "@/lib/knowledge/pixel-currency"
import { estimateBurnApFromPixels, levelFromActionPoints } from "./normiesKnowledge"
import { parseNormieTokenIdsFromText } from "./parseTokenIds"
import { buildStrategySnapshot } from "./strategy"
import { analyzeTraitCombo } from "./traitAnalysis"
import type {
  CredHubPulseData,
  MentionedNormieSnapshot,
  SubjectScope,
  ZuloRecommendationContext,
} from "./types"

type BuildContextParams = {
  normieId?: number
  sessionHistory?: Array<{ userMessage: string; zuloResponse: string }>
  userWallet?: string
  userEns?: string
  /** User free-text — used to trigger skills like Burn Efficiency Optimizer */
  userQuery?: string
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

/** Full NFT metadata from /normie/:id/metadata (includes Pixel Count, Level, AP). */
type MetadataPayload = {
  name?: string
  attributes?: Array<{
    trait_type?: string
    value?: string | number
    display_type?: string
  }>
}

function attrNumber(
  attrs: MetadataPayload["attributes"] | undefined,
  name: string,
): number | undefined {
  if (!attrs) return undefined
  for (const a of attrs) {
    if (a.trait_type !== name) continue
    const n = typeof a.value === "number" ? a.value : Number(a.value)
    if (Number.isFinite(n)) return n
  }
  return undefined
}

function attrString(
  attrs: MetadataPayload["attributes"] | undefined,
  name: string,
): string | undefined {
  if (!attrs) return undefined
  for (const a of attrs) {
    if (a.trait_type !== name) continue
    if (a.value === undefined || a.value === null) return undefined
    return String(a.value)
  }
  return undefined
}

/** Fetch metadata + traits + rarity for one mentioned token (for dual-eval grounding). */
async function fetchMentionedNormieSnapshot(
  tokenId: number,
): Promise<MentionedNormieSnapshot> {
  const rarityUrl = `${ECOSYSTEM_LINKS.rarity}normie/${tokenId}`
  const openseaFallback = `${ECOSYSTEM_LINKS.opensea}/${tokenId}`

  try {
    const [metadata, traits, rarityData] = await Promise.all([
      normiesPath<MetadataPayload>(`/normie/${tokenId}/metadata`, 8_000),
      normiesPath<TraitsPayload>(`/normie/${tokenId}/traits`, 8_000),
      fetchJsonSafe<RarityPayload>(
        `${ECOSYSTEM_LINKS.rarityApi}/normie/${tokenId}`,
        8_000,
      ),
    ])

    if (!metadata && !traits && !rarityData) {
      return {
        tokenId,
        fetchOk: false,
        fetchError: "Normies/rarity APIs returned no data",
        traits: {},
        rarityUrl,
        openseaUrl: openseaFallback,
      }
    }

    const traitRecord = {
      ...traitsToRecord(traits),
    }
    // Fill from metadata attributes when traits empty
    if (Object.keys(traitRecord).length === 0 && metadata?.attributes) {
      for (const attr of metadata.attributes) {
        if (!attr.trait_type || attr.value === undefined || attr.value === null)
          continue
        // Skip canvas numeric attrs from trait map (stored separately)
        if (
          attr.trait_type === "Level" ||
          attr.trait_type === "Pixel Count" ||
          attr.trait_type === "Action Points" ||
          attr.trait_type === "Customized"
        ) {
          continue
        }
        traitRecord[attr.trait_type] = attr.value
      }
    }

    const pixelCount =
      attrNumber(metadata?.attributes, "Pixel Count") ??
      attrNumber(rarityData?.attributes, "Pixel Count")
    const level =
      attrNumber(metadata?.attributes, "Level") ??
      attrNumber(rarityData?.attributes, "Level")
    const actionPoints =
      attrNumber(metadata?.attributes, "Action Points") ??
      attrNumber(rarityData?.attributes, "Action Points")
    const customizedRaw =
      attrString(metadata?.attributes, "Customized") ??
      attrString(rarityData?.attributes, "Customized")
    const customized =
      customizedRaw != null
        ? !/^(no|false|0)$/i.test(customizedRaw.trim())
        : undefined

    const rarityRank =
      typeof rarityData?.rank === "number" && Number.isFinite(rarityData.rank)
        ? rarityData.rank
        : null
    const rarityScore =
      typeof rarityData?.rarityScore === "number" &&
      Number.isFinite(rarityData.rarityScore)
        ? rarityData.rarityScore
        : null

    const burnApFromPixels =
      pixelCount != null ? estimateBurnApFromPixels(pixelCount) : undefined

    return {
      tokenId,
      fetchOk: true,
      name: metadata?.name || rarityData?.name || `Normie #${tokenId}`,
      traits: traitRecord,
      pixelCount,
      level,
      actionPoints,
      customized,
      rarityRank,
      rarityScore,
      openseaUrl: rarityData?.openseaUrl || openseaFallback,
      rarityUrl,
      burnApEstimate: burnApFromPixels
        ? {
            minAp: burnApFromPixels.minAp,
            maxAp: burnApFromPixels.maxAp,
            tierLabel: burnApFromPixels.tier.label,
          }
        : undefined,
    }
  } catch (err) {
    return {
      tokenId,
      fetchOk: false,
      fetchError: err instanceof Error ? err.message : "fetch failed",
      traits: {},
      rarityUrl,
      openseaUrl: openseaFallback,
    }
  }
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
  pulse?: CredHubPulseData | null
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

/** Count "on" pixels from /normie/:id/pixels plain-text bitmap. */
async function fetchPixelCount(tokenId: number): Promise<number | undefined> {
  try {
    const res = await fetchWithTimeout(
      `${NORMIES_API_BASE}/normie/${tokenId}/pixels`,
      {},
      6_000,
    )
    if (!res.ok) return undefined
    const text = (await res.text()).trim()
    if (!text) return undefined
    let on = 0
    for (let i = 0; i < text.length; i++) {
      if (text[i] === "1") on++
    }
    return on
  } catch {
    return undefined
  }
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
  const pulse = input.pulse

  if (pulse) {
    opportunities.push(
      `PULSE: ${pulse.pulseLevel}/${pulse.maxLevel} (${pulse.status}) — signals: ${
        pulse.breakdown.length ? pulse.breakdown.join(", ") : "none yet"
      }. Tool: ${ECOSYSTEM_LINKS.credHubPulseTool}`,
    )
    if (pulse.pulseLevel <= 2) {
      opportunities.push(
        "PULSE strategy: low level — prioritize identity (ERC-8004), active agent card, and clean ownership before heavy Canvas risk.",
      )
    } else if (pulse.pulseLevel >= 4) {
      opportunities.push(
        "PULSE strategy: strong signal set — fair game for agent utility, ecosystem tools, and reputation growth.",
      )
    }
    for (const gap of pulse.gaps.slice(0, 3)) {
      opportunities.push(`PULSE gap: ${gap} — address this signal to raise pulse level.`)
    }
  }

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
  const wallet =
    params.userWallet && isAddress(params.userWallet) ? params.userWallet : ""
  const walletConnected = !!wallet

  const mentionedTokenIds = parseNormieTokenIdsFromText(params.userQuery ?? "", 5)
  const hasActiveSubject =
    typeof params.normieId === "number" &&
    Number.isFinite(params.normieId) &&
    params.normieId >= 0 &&
    params.normieId <= 9999

  // Subject resolution:
  // - Connected Active Normie (client sent normieId) → active_normie
  // - IDs in message only → mentioned_ids (first = primary focus)
  // - Neither → general (no fake user subject; #7141 is Zulo speaker identity only)
  let subjectMode: SubjectScope["mode"]
  let focusTokenId: number
  let normieIsSpeakerIdentityOnly = false

  if (hasActiveSubject) {
    subjectMode = "active_normie"
    focusTokenId = params.normieId as number
  } else if (mentionedTokenIds.length > 0) {
    subjectMode = "mentioned_ids"
    focusTokenId = mentionedTokenIds[0]!
  } else {
    subjectMode = "general"
    focusTokenId = ZULO_IDENTITY.tokenId
    normieIsSpeakerIdentityOnly = true
  }

  const tokenId = focusTokenId
  const isGeneralMode = subjectMode === "general"
  const needZuloCanvasAp = tokenId !== ZULO_IDENTITY.tokenId || isGeneralMode

  // IDs to hydrate into mentionedNormies (always include all named; also focus when not general)
  const idsToSnapshot = new Set<number>(mentionedTokenIds)
  if (!isGeneralMode) idsToSnapshot.add(tokenId)
  // Cap total parallel token snapshots
  const snapshotIds = Array.from(idsToSnapshot).slice(0, 5)

  const [
    agentInfo,
    traits,
    canvasInfo,
    owner,
    binding,
    holders,
    historyStats,
    rarityData,
    pulseResult,
    zuloCanvasInfo,
    pixelCount,
    mentionedNormies,
  ] = await Promise.all([
    isGeneralMode
      ? Promise.resolve(null)
      : normiesPath<AgentInfoPayload>(`/agents/info/${tokenId}`),
    isGeneralMode
      ? Promise.resolve(null)
      : normiesPath<TraitsPayload>(`/normie/${tokenId}/traits`),
    isGeneralMode
      ? Promise.resolve(null)
      : normiesPath<CanvasInfoPayload>(`/normie/${tokenId}/canvas/info`),
    isGeneralMode
      ? Promise.resolve(null)
      : normiesPath<OwnerPayload>(`/normie/${tokenId}/owner`),
    isGeneralMode
      ? Promise.resolve(null)
      : normiesPath<BindingPayload>(`/agents/binding/${tokenId}`),
    wallet ? normiesPath<HoldersPayload>(`/holders/${wallet}`) : Promise.resolve(null),
    normiesPath<HistoryStatsPayload>(`/history/stats`),
    isGeneralMode
      ? Promise.resolve(null)
      : fetchJsonSafe<RarityPayload>(
          `${ECOSYSTEM_LINKS.rarityApi}/normie/${tokenId}`,
          8_000,
        ),
    isGeneralMode
      ? Promise.resolve(null)
      : getAgentPulse(tokenId).catch(() => null),
    needZuloCanvasAp
      ? normiesPath<CanvasInfoPayload>(`/normie/${ZULO_IDENTITY.tokenId}/canvas/info`)
      : Promise.resolve(null),
    isGeneralMode ? Promise.resolve(undefined) : fetchPixelCount(tokenId),
    snapshotIds.length > 0
      ? Promise.all(snapshotIds.map((id) => fetchMentionedNormieSnapshot(id)))
      : Promise.resolve([] as MentionedNormieSnapshot[]),
  ])

  let pulse: CredHubPulseData | undefined
  let pulseSummary = "PULSE unavailable"
  if (pulseResult && "ok" in pulseResult && pulseResult.ok) {
    const gaps = derivePulseGaps(pulseResult.data.breakdown)
    pulse = {
      tokenId: pulseResult.data.token_id,
      agentId: pulseResult.data.agent_id,
      pulseLevel: pulseResult.data.pulse_level,
      maxLevel: pulseResult.data.max_level,
      status: pulseResult.data.status,
      breakdown: pulseResult.data.breakdown,
      gaps,
      nextSignal: pulseResult.data.next_signal,
      note: pulseResult.data.note,
    }
    pulseSummary = buildPulseSummary(pulseResult.data)
  }

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
  /** True when focus token is Zulo's piece — but only treat as *user* subject when not speaker-only. */
  const isZuloIdentityPiece = tokenId === ZULO_IDENTITY.tokenId
  const isZuloUserSubject = isZuloIdentityPiece && !normieIsSpeakerIdentityOnly

  // Prefer pixel count from live pixels endpoint; fall back to metadata snapshot
  const focusMention = mentionedNormies.find((m) => m.tokenId === tokenId)
  const resolvedPixelCount =
    pixelCount ??
    (focusMention?.fetchOk ? focusMention.pixelCount : undefined)

  // Merge traits from mentioned snapshot when primary traits empty (e.g. race)
  if (Object.keys(traitRecord).length === 0 && focusMention?.fetchOk) {
    Object.assign(traitRecord, focusMention.traits)
  }

  const rarityRank =
    typeof rarityData?.rank === "number" && Number.isFinite(rarityData.rank)
      ? rarityData.rank
      : focusMention?.rarityRank ?? null
  const rarityScore =
    typeof rarityData?.rarityScore === "number" && Number.isFinite(rarityData.rarityScore)
      ? rarityData.rarityScore
      : focusMention?.rarityScore ?? null

  const traitHighlights =
    rarityData?.traitBreakdown
      ?.filter((t) => t.trait_type && t.value)
      .slice(0, 8)
      .map((t) => ({
        trait_type: String(t.trait_type),
        value: String(t.value),
        frequency: typeof t.frequency === "number" ? t.frequency : undefined,
      })) ?? []

  const customized =
    canvasCustomized != null
      ? !!canvasCustomized
      : focusMention?.customized != null
        ? !!focusMention.customized
        : false
  const actionPoints =
    canvasAp ??
    focusMention?.actionPoints ??
    0
  const derivedLevel =
    canvasLevel !== undefined
      ? canvasLevel
      : focusMention?.level !== undefined
        ? focusMention.level
        : levelFromActionPoints(actionPoints)
  const burnApFromPixels =
    resolvedPixelCount != null
      ? estimateBurnApFromPixels(resolvedPixelCount)
      : undefined

  // Zulo Canvas AP is always #7141 — not the visitor's focus token
  const zuloCanvasAPBalance =
    typeof zuloCanvasInfo?.actionPoints === "number"
      ? zuloCanvasInfo.actionPoints
      : isZuloUserSubject
        ? actionPoints
        : 0

  // Enrich a capped set of holdings for burn/keep strategy (wallet connected only)
  const ownedSnapshots: OwnedNormieSnapshot[] = []
  const idsToEnrich = isGeneralMode ? [] : holdingIds.slice(0, 10)
  if (idsToEnrich.length > 0) {
    const enriched = await Promise.all(
      idsToEnrich.map(async (id) => {
        try {
          const [t, r] = await Promise.all([
            normiesPath<TraitsPayload>(`/normie/${id}/traits`, 5_000),
            fetchJsonSafe<RarityPayload>(`${ECOSYSTEM_LINKS.rarityApi}/normie/${id}`, 5_000),
          ])
          const tr = traitsToRecord(t)
          const type = String(tr.Type ?? r?.attributes?.find((a) => a.trait_type === "Type")?.value ?? "Unknown")
          const rank =
            typeof r?.rank === "number" && Number.isFinite(r.rank) ? r.rank : 9999
          const traitVals = Object.values(tr).map(String)
          const combo = analyzeTraitCombo(tr)
          return {
            tokenId: id,
            type,
            rarityTier: tierFromRank(rank),
            rarityRank: rank,
            traits: traitVals,
            isPremiumCombo: combo.isPremium,
          } satisfies OwnedNormieSnapshot
        } catch {
          return {
            tokenId: id,
            type: "Unknown",
            rarityTier: "common" as const,
            rarityRank: 9999,
            isPremiumCombo: false,
          } satisfies OwnedNormieSnapshot
        }
      }),
    )
    ownedSnapshots.push(...enriched)
  }

  // Include focus token in owned set for single-hold analysis (not in general/speaker-only mode)
  if (
    !isGeneralMode &&
    !ownedSnapshots.some((o) => o.tokenId === tokenId)
  ) {
    const focusCombo = analyzeTraitCombo(traitRecord)
    ownedSnapshots.push({
      tokenId,
      type: String(traitRecord.Type ?? agentInfo?.type ?? "Unknown"),
      rarityTier: tierFromRank(rarityRank),
      rarityRank: rarityRank ?? 9999,
      traits: Object.values(traitRecord).map(String),
      isPremiumCombo: focusCombo.isPremium,
    })
  }

  // Also fold multi-mentioned snapshots into owned for dual-eval when analyzing named IDs
  if (subjectMode === "mentioned_ids") {
    for (const m of mentionedNormies) {
      if (!m.fetchOk || ownedSnapshots.some((o) => o.tokenId === m.tokenId)) continue
      const combo = analyzeTraitCombo(m.traits)
      ownedSnapshots.push({
        tokenId: m.tokenId,
        type: String(m.traits.Type ?? "Unknown"),
        rarityTier: tierFromRank(m.rarityRank),
        rarityRank: m.rarityRank ?? 9999,
        traits: Object.values(m.traits).map(String),
        isPremiumCombo: combo.isPremium,
      })
    }
  }

  const focusComboForStrategy = analyzeTraitCombo(traitRecord)
  const strategy = await buildStrategySnapshot({
    focusType: String(
      traitRecord.Type ??
        agentInfo?.type ??
        (isGeneralMode ? "general" : "unknown"),
    ),
    focusRank: isGeneralMode ? null : rarityRank,
    focusTraits: isGeneralMode ? {} : traitRecord,
    owned: ownedSnapshots,
    userQuery: params.userQuery,
    focusActionPoints: isGeneralMode ? 0 : actionPoints,
    focusTokenId: isGeneralMode ? ZULO_IDENTITY.tokenId : tokenId,
    isHolder: ownerMatchesUser || (wallet ? holdingIds.length > 0 : false),
    isAwakened: isGeneralMode
      ? true
      : isAwakened || isZuloUserSubject,
    isPremiumFocus: isGeneralMode ? false : focusComboForStrategy.isPremium,
  })

  const earningOpportunities = isGeneralMode
    ? [
        "General mode: no Active Normie scoped — answer collection-level questions; ask for token IDs when burn/hold needs specifics.",
        `Zulo identity: I hold #${ZULO_IDENTITY.tokenId} untouched (speaker posture — not the visitor's token unless they name it or connect).`,
        `Community tools: Multisend (${ECOSYSTEM_LINKS.multisend}), Normifier (${ECOSYSTEM_LINKS.normifier}), API (${ECOSYSTEM_LINKS.api}).`,
        `PULSE tool: ${ECOSYSTEM_LINKS.credHubPulseTool}`,
      ]
    : generateOpportunities({
        tokenId,
        traits: traitRecord,
        customized,
        actionPoints,
        isAwakened: isAwakened || isZuloUserSubject,
        agentType: agentInfo?.type,
        rarityRank,
        rarityScore,
        holdingsCount: wallet ? holdingIds.length : undefined,
        pulse: pulse ?? null,
      })

  // Surface multi-token snapshots in opportunities when user named IDs
  for (const m of mentionedNormies) {
    if (!m.fetchOk) {
      earningOpportunities.unshift(
        `Token #${m.tokenId}: live fetch failed (${m.fetchError ?? "unknown"}) — check ${m.rarityUrl ?? ECOSYSTEM_LINKS.rarity} or OpenSea; do not invent pixels/traits.`,
      )
      continue
    }
    const traitBits = Object.entries(m.traits)
      .slice(0, 6)
      .map(([k, v]) => `${k}=${v}`)
      .join(", ")
    earningOpportunities.unshift(
      `Token #${m.tokenId}: ${m.pixelCount != null ? `${m.pixelCount} px` : "px n/a"} · L${m.level ?? "?"} · ${m.actionPoints ?? "?"} AP · ${m.customized ? "customized" : "untouched"}${m.rarityRank != null ? ` · rank #${m.rarityRank}` : ""}${m.burnApEstimate ? ` · burn band ~${m.burnApEstimate.minAp}–${m.burnApEstimate.maxAp} AP (${m.burnApEstimate.tierLabel})` : ""}${traitBits ? ` · traits: ${traitBits}` : ""}`,
    )
  }

  if (strategy.traitAdvice?.isPremium) {
    earningOpportunities.unshift(`Strategy: ${strategy.traitAdvice.advice}`)
  }
  if (burnApFromPixels && resolvedPixelCount != null && !isGeneralMode) {
    earningOpportunities.unshift(
      `Pixel-tier burn estimate (focus #${tokenId}): ${resolvedPixelCount} on-pixels (tier ${burnApFromPixels.tier.label}, ${burnApFromPixels.tier.minPct}–${burnApFromPixels.tier.maxPct}%) → theoretical ${burnApFromPixels.minAp}–${burnApFromPixels.maxAp} AP before reveal RNG`,
    )
  }
  if (strategy.apEstimateForFocus) {
    const e = strategy.apEstimateForFocus
    earningOpportunities.unshift(
      `Burn AP estimate (history band): ~${e.median} AP (range ${e.min}–${e.max}, confidence ${e.confidence}, n=${e.sampleSize})`,
    )
  }
  if (strategy.burnReasoning) {
    earningOpportunities.push(`Wallet burns: ${strategy.burnReasoning}`)
  }
  if (strategy.floorSnapshot) {
    earningOpportunities.unshift(strategy.floorSnapshot.snapshotLine)
  }
  if (strategy.burnEfficiency?.scanned && strategy.burnEfficiency.topCandidates.length) {
    const top = strategy.burnEfficiency.topCandidates
      .slice(0, 5)
      .map(
        (c) =>
          `#${c.tokenId} (~${c.estimatedAP} AP @ ${c.floorPriceETH} ETH → ${c.efficiencyScore} AP/ETH)`,
      )
      .join("; ")
    earningOpportunities.unshift(
      `Burn Efficiency Optimizer top candidates: ${top}. ${strategy.burnEfficiency.disclaimer}`,
    )
  }
  if (strategy.marketSentinel?.scanned) {
    const ms = strategy.marketSentinel
    earningOpportunities.unshift(
      `PIXEL MARKET Sentinel: ${ms.brief.headline}. Trend ${ms.brief.trend}. ${ms.whaleActivity.summary}`,
    )
    for (const rec of ms.positionRecommendations.slice(0, 2)) {
      earningOpportunities.push(`Market position: ${rec}`)
    }
  }
  if (strategy.gachaRaffle?.scanned) {
    const gr = strategy.gachaRaffle
    earningOpportunities.unshift(
      `Gacha & Raffle Intelligence (${gr.dataStatus}): ${gr.positiveEv.length} +EV / ${gr.highValueRaffles.length} high-value raffles. ${gr.apAllocation.note}`,
    )
    for (const line of gr.apAllocation.lines.slice(0, 2)) {
      earningOpportunities.push(
        `AP plan: ${line.suggestedAp} AP → ${line.opportunityName} (${line.kind}, EV ${line.evRatio.toFixed(2)}×)`,
      )
    }
  }
  if (strategy.canvasEvolution?.scanned) {
    const ce = strategy.canvasEvolution
    if (ce.preview) {
      earningOpportunities.unshift(
        `Canvas Preview #${ce.preview.tokenId}: ${ce.preview.recommendation} (${ce.preview.confidence}% confidence) · ${ce.preview.before.pixelCountOn}→${ce.preview.after.pixelCountOn} on-px · ${ce.preview.costBreakdown.totalApCost} AP cost`,
      )
    }
    if (ce.expansion) {
      earningOpportunities.push(
        `80×80 expansion readiness #${ce.expansion.tokenId}: ${ce.expansion.readinessScore}/100 — ${ce.expansion.recommendation}`,
      )
    }
    if (ce.watch?.alerts.length) {
      earningOpportunities.push(
        `Canvas Watch alerts: ${ce.watch.alerts
          .slice(0, 3)
          .map((a) => a.message)
          .join(" | ")}`,
      )
    }
  }

  const marketState = strategy.marketSentinel?.marketState
  const floorSnapshot = strategy.floorSnapshot
  const gachaRaffleContext = strategy.gachaRaffle
  const canvasEvolution = strategy.canvasEvolution
  const canvasCtx = canvasEvolution?.canvasState

  // Doctrine knowledge — always available for strategy-bearing answers
  const pixelEconomy = getPixelEconomyContextSummary()
  const dualEvalAndPixelMarket = getDualEvalAndPixelMarketContextSummary()
  const collabRails = getCollabRailsContextSummary()
  const pixelCurrency = getPixelCurrencyContextSummary()
  const paymentSecurity = getPaymentSecurityContextSummary()
  const protocolsDeepDive = getProtocolsDeepDiveContextSummary()
  const erc6551 = getErc6551ContextSummary()

  const subjectScope: SubjectScope = {
    mode: subjectMode,
    walletConnected,
    activeNormieId: hasActiveSubject ? (params.normieId as number) : null,
    mentionedTokenIds,
    normieIsSpeakerIdentityOnly,
    userOwnsFocus: ownerMatchesUser,
  }

  // General mode: context.normie is Zulo speaker identity only (not visitor subject)
  const speakerOnly = normieIsSpeakerIdentityOnly

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
      name: speakerOnly
        ? `Zulo · Normie #${ZULO_IDENTITY.tokenId} (speaker identity — not visitor subject)`
        : rarityData?.name ||
          agentInfo?.name ||
          agentInfo?.traits?.name ||
          focusMention?.name ||
          `Normie #${tokenId}`,
      traits: speakerOnly ? {} : traitRecord,
      owner: speakerOnly ? undefined : ownerAddress,
      ownerMatchesUser: speakerOnly ? false : ownerMatchesUser,
      canvas: speakerOnly
        ? undefined
        : canvasLevel !== undefined ||
            canvasAp !== undefined ||
            resolvedPixelCount != null ||
            focusMention?.fetchOk
          ? {
              level: derivedLevel,
              actionPoints: actionPoints,
              customized,
              delegate: canvasInfo?.delegate,
              pixelCount: resolvedPixelCount,
              burnApEstimate: burnApFromPixels
                ? {
                    minAp: burnApFromPixels.minAp,
                    maxAp: burnApFromPixels.maxAp,
                    tierLabel: burnApFromPixels.tier.label,
                    minPct: burnApFromPixels.tier.minPct,
                    maxPct: burnApFromPixels.tier.maxPct,
                  }
                : undefined,
            }
          : undefined,
      rarity: speakerOnly
        ? undefined
        : {
            rank: rarityRank,
            score: rarityScore,
            fairValue: rarityData?.fairValue ?? null,
            awake: rarityData?.awake,
            openseaUrl:
              rarityData?.openseaUrl || focusMention?.openseaUrl,
            traitHighlights: traitHighlights.length
              ? traitHighlights
              : undefined,
          },
      agent: {
        id:
          Number.isFinite(agentIdNum) && agentIdNum > 0
            ? agentIdNum
            : ZULO_IDENTITY.agentId,
        name:
          agentInfo?.name ||
          rarityData?.agentName ||
          (isZuloIdentityPiece ? ZULO_IDENTITY.name : `Agent for #${tokenId}`),
        status:
          speakerOnly || isAwakened || isZuloIdentityPiece
            ? "awakened"
            : "dormant",
        reputation: isZuloIdentityPiece ? 75 : undefined,
        walletAddress: isZuloIdentityPiece
          ? ZULO_IDENTITY.hotWallet
          : undefined,
        ens: isZuloIdentityPiece ? ZULO_IDENTITY.ens : undefined,
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
      currentGoal: isGeneralMode
        ? "general Normies guidance"
        : "maximize agent and Normie value",
    },
    platformContext: {
      currentTime: now,
      subjectScope,
      mentionedNormies,
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
      pulse,
      pulseSummary,
      zuloCanvasAPBalance,
      zuloAPBalance: zuloCanvasAPBalance,
      pixelEconomy,
      dualEvalAndPixelMarket,
      collabRails,
      ...(pixelCurrency ? { pixelCurrency } : {}),
      paymentSecurity,
      protocolsDeepDive,
      erc6551,
      floorSnapshot: floorSnapshot
        ? {
            available: floorSnapshot.available,
            stale: floorSnapshot.stale,
            latestFloorETH: floorSnapshot.latestFloorETH,
            avgFloorETH: floorSnapshot.avgFloorETH,
            minFloorETH: floorSnapshot.minFloorETH,
            maxFloorETH: floorSnapshot.maxFloorETH,
            pctVsAvg: floorSnapshot.pctVsAvg,
            source: floorSnapshot.source,
            asOf: floorSnapshot.asOf,
            historySampleSize: floorSnapshot.historySampleSize,
            historyDays: floorSnapshot.historyDays,
            historyLatestRecordedAt: floorSnapshot.historyLatestRecordedAt,
            openSeaUrl: floorSnapshot.openSeaUrl,
            snapshotLine: floorSnapshot.snapshotLine,
            framingLines: floorSnapshot.framingLines,
            note: floorSnapshot.note,
            floorPriceUsd: floorSnapshot.floorPriceUsd ?? null,
            ethUsd: floorSnapshot.ethUsd ?? null,
          }
        : undefined,
      marketState: marketState
        ? {
            asOf: marketState.asOf,
            floorETH: marketState.floorETH,
            floorSource: marketState.floorSource,
            floorChangePct: marketState.floorChangePct,
            oneDayVolumeETH: marketState.oneDayVolumeETH,
            sevenDayVolumeETH: marketState.sevenDayVolumeETH,
            sales1d: marketState.sales1d,
            sales7d: marketState.sales7d,
            volumeVelocityRatio: marketState.volumeVelocityRatio,
            burnTokensRecent24h: marketState.burnTokensRecent24h,
            burnTokensPrev24h: marketState.burnTokensPrev24h,
            burnVolumeRatio: marketState.burnVolumeRatio,
            historicalApMedian: marketState.historicalApMedian,
            floorBuyEfficiency: marketState.floorBuyEfficiency,
            impliedApCostETH: marketState.impliedApCostETH,
            apMarketStatus: marketState.apMarketStatus,
            apMarketPriceETH: marketState.apMarketPriceETH,
            owners: marketState.owners,
          }
        : undefined,
      gachaRaffle: gachaRaffleContext
        ? {
            dataStatus: gachaRaffleContext.dataStatus,
            poolCount: gachaRaffleContext.gachaPools.length,
            raffleCount: gachaRaffleContext.raffles.length,
            positiveEvCount: gachaRaffleContext.positiveEv.length,
            highValueRaffleCount: gachaRaffleContext.highValueRaffles.length,
            positiveEv: gachaRaffleContext.positiveEv.slice(0, 8),
            apAllocation: gachaRaffleContext.apAllocation,
            pitySummary: gachaRaffleContext.pitySummary,
            qualificationSummary: gachaRaffleContext.qualificationSummary,
            floorETH: gachaRaffleContext.floorETH,
            disclaimer: gachaRaffleContext.disclaimer,
            summary: gachaRaffleContext.summary,
          }
        : undefined,
      canvasEvolution: canvasEvolution
        ? {
            mode: canvasEvolution.mode,
            canvasState: canvasCtx
              ? {
                  tokenId: canvasCtx.tokenId,
                  actionPoints: canvasCtx.actionPoints,
                  level: canvasCtx.level,
                  customized: canvasCtx.customized,
                  pixelCountOn: canvasCtx.pixelCountOn,
                  pixelCountOff: canvasCtx.pixelCountOff,
                  densityPct: canvasCtx.densityPct,
                  diff: canvasCtx.diff,
                }
              : undefined,
            preview: canvasEvolution.preview
              ? {
                  tokenId: canvasEvolution.preview.tokenId,
                  recommendation: canvasEvolution.preview.recommendation,
                  confidence: canvasEvolution.preview.confidence,
                  before: canvasEvolution.preview.before,
                  after: canvasEvolution.preview.after,
                  costBreakdown: canvasEvolution.preview.costBreakdown,
                  aesthetic: canvasEvolution.preview.aesthetic,
                  reasoning: canvasEvolution.preview.reasoning,
                  editorUrl: canvasEvolution.preview.editorUrl,
                  disclaimer: canvasEvolution.preview.disclaimer,
                }
              : undefined,
            expansion: canvasEvolution.expansion
              ? {
                  tokenId: canvasEvolution.expansion.tokenId,
                  readinessScore: canvasEvolution.expansion.readinessScore,
                  actionPoints: canvasEvolution.expansion.actionPoints,
                  level: canvasEvolution.expansion.level,
                  currentGrid: canvasEvolution.expansion.currentGrid,
                  targetGrid: canvasEvolution.expansion.targetGrid,
                  apReadiness: canvasEvolution.expansion.apReadiness,
                  densityReadiness: canvasEvolution.expansion.densityReadiness,
                  levelReadiness: canvasEvolution.expansion.levelReadiness,
                  milestones: canvasEvolution.expansion.milestones,
                  blockers: canvasEvolution.expansion.blockers,
                  recommendation: canvasEvolution.expansion.recommendation,
                }
              : undefined,
            watch: canvasEvolution.watch
              ? {
                  watched: canvasEvolution.watch.watched,
                  alertCount: canvasEvolution.watch.alerts.length,
                  alerts: canvasEvolution.watch.alerts.slice(0, 8),
                  nextDueAt: canvasEvolution.watch.nextDueAt,
                  summary: canvasEvolution.watch.summary,
                }
              : undefined,
            disclaimer: canvasEvolution.disclaimer,
            summary: canvasEvolution.summary,
          }
        : undefined,
      strategy: {
        apEstimateForFocus: strategy.apEstimateForFocus,
        traitAdvice: strategy.traitAdvice,
        burnCandidates: strategy.burnCandidates?.map((b) => ({
          tokenId: b.tokenId,
          type: b.type,
          rarityTier: b.rarityTier,
          rarityRank: b.rarityRank,
        })),
        keepCandidates: strategy.keepCandidates?.map((b) => ({
          tokenId: b.tokenId,
          type: b.type,
          rarityTier: b.rarityTier,
          rarityRank: b.rarityRank,
        })),
        burnReasoning: strategy.burnReasoning,
        acquisition: strategy.acquisition
          ? {
              recommendation: strategy.acquisition.recommendation,
              options: strategy.acquisition.options,
              floorsNote: strategy.acquisition.floorsNote,
              liveFloorETH: strategy.acquisition.liveFloorETH,
              liveFloorSource: strategy.acquisition.liveFloorSource,
              liveFloorUpdatedAt: strategy.acquisition.liveFloorUpdatedAt,
            }
          : undefined,
        burnMarketNotes: strategy.burnMarketNotes,
        floorsNote: strategy.floorsNote,
        summaryLines: strategy.summaryLines,
        floorSnapshot: strategy.floorSnapshot
          ? {
              available: strategy.floorSnapshot.available,
              stale: strategy.floorSnapshot.stale,
              latestFloorETH: strategy.floorSnapshot.latestFloorETH,
              avgFloorETH: strategy.floorSnapshot.avgFloorETH,
              minFloorETH: strategy.floorSnapshot.minFloorETH,
              maxFloorETH: strategy.floorSnapshot.maxFloorETH,
              pctVsAvg: strategy.floorSnapshot.pctVsAvg,
              source: strategy.floorSnapshot.source,
              asOf: strategy.floorSnapshot.asOf,
              historySampleSize: strategy.floorSnapshot.historySampleSize,
              historyDays: strategy.floorSnapshot.historyDays,
              historyLatestRecordedAt:
                strategy.floorSnapshot.historyLatestRecordedAt,
              openSeaUrl: strategy.floorSnapshot.openSeaUrl,
              snapshotLine: strategy.floorSnapshot.snapshotLine,
              framingLines: strategy.floorSnapshot.framingLines,
              note: strategy.floorSnapshot.note,
            }
          : undefined,
        burnEfficiency: strategy.burnEfficiency
          ? {
              scanned: strategy.burnEfficiency.scanned,
              topCandidates: strategy.burnEfficiency.topCandidates.map((c) => ({
                tokenId: c.tokenId,
                floorPriceETH: c.floorPriceETH,
                estimatedAP: c.estimatedAP,
                efficiencyScore: c.efficiencyScore,
                rarityTier: c.rarityTier,
                rarityRank: c.rarityRank,
                type: c.type,
                pixelCount: c.pixelCount,
                priceSource: c.priceSource,
                confidence: c.confidence,
              })),
              collectionFloorETH: strategy.burnEfficiency.collectionFloorETH,
              collectionFloorSource: strategy.burnEfficiency.collectionFloorSource,
              burnSampleSize: strategy.burnEfficiency.burnSampleSize,
              historicalApMedian: strategy.burnEfficiency.historicalApMedian,
              disclaimer: strategy.burnEfficiency.disclaimer,
              summary: strategy.burnEfficiency.summary,
              sources: strategy.burnEfficiency.sources,
            }
          : undefined,
        marketSentinel: strategy.marketSentinel
          ? {
              scanned: strategy.marketSentinel.scanned,
              brief: strategy.marketSentinel.brief,
              signals: strategy.marketSentinel.signals,
              marketState: strategy.marketSentinel.marketState,
              arbitrage: strategy.marketSentinel.arbitrage,
              positionRecommendations: strategy.marketSentinel.positionRecommendations,
              whaleActivity: strategy.marketSentinel.whaleActivity,
              disclaimer: strategy.marketSentinel.disclaimer,
              summary: strategy.marketSentinel.summary,
              sources: strategy.marketSentinel.sources,
            }
          : undefined,
        gachaRaffle: strategy.gachaRaffle
          ? {
              scanned: strategy.gachaRaffle.scanned,
              dataStatus: strategy.gachaRaffle.dataStatus,
              gachaPools: strategy.gachaRaffle.gachaPools.map((g) => ({
                id: g.id,
                name: g.name,
                status: g.status,
                costAp: g.costAp,
                costEth: g.costEth,
                expectedValueAp: g.expectedValueAp,
                expectedValueEth: g.expectedValueEth,
                evRatio: g.evRatio,
                edgePct: g.edgePct,
                isPositiveEv: g.isPositiveEv,
                isHighValue: g.isHighValue,
                pity: g.pity,
                qualification: g.qualification,
                notes: g.notes,
              })),
              raffles: strategy.gachaRaffle.raffles.map((r) => ({
                id: r.id,
                name: r.name,
                status: r.status,
                entryCostAp: r.entryCostAp,
                entryCostEth: r.entryCostEth,
                prizeValueAp: r.prizeValueAp,
                prizeValueEth: r.prizeValueEth,
                totalEntries: r.totalEntries,
                winProbability: r.winProbability,
                expectedValueAp: r.expectedValueAp,
                expectedValueEth: r.expectedValueEth,
                evRatio: r.evRatio,
                edgePct: r.edgePct,
                isPositiveEv: r.isPositiveEv,
                isHighValue: r.isHighValue,
                qualification: r.qualification,
                endsAt: r.endsAt,
                notes: r.notes,
              })),
              positiveEv: strategy.gachaRaffle.positiveEv,
              highValueRaffles: strategy.gachaRaffle.highValueRaffles.map((r) => ({
                id: r.id,
                name: r.name,
                evRatio: r.evRatio,
                edgePct: r.edgePct,
                entryCostAp: r.entryCostAp,
                prizeValueEth: r.prizeValueEth,
                totalEntries: r.totalEntries,
              })),
              apAllocation: strategy.gachaRaffle.apAllocation,
              pitySummary: strategy.gachaRaffle.pitySummary,
              qualificationSummary: strategy.gachaRaffle.qualificationSummary,
              floorETH: strategy.gachaRaffle.floorETH,
              disclaimer: strategy.gachaRaffle.disclaimer,
              summary: strategy.gachaRaffle.summary,
              sources: strategy.gachaRaffle.sources,
            }
          : undefined,
        canvasEvolution: strategy.canvasEvolution
          ? {
              scanned: strategy.canvasEvolution.scanned,
              mode: strategy.canvasEvolution.mode,
              summary: strategy.canvasEvolution.summary,
              disclaimer: strategy.canvasEvolution.disclaimer,
              preview: strategy.canvasEvolution.preview
                ? {
                    tokenId: strategy.canvasEvolution.preview.tokenId,
                    recommendation: strategy.canvasEvolution.preview.recommendation,
                    confidence: strategy.canvasEvolution.preview.confidence,
                    before: strategy.canvasEvolution.preview.before,
                    after: strategy.canvasEvolution.preview.after,
                    costBreakdown: strategy.canvasEvolution.preview.costBreakdown,
                    aesthetic: strategy.canvasEvolution.preview.aesthetic,
                    reasoning: strategy.canvasEvolution.preview.reasoning,
                    editorUrl: strategy.canvasEvolution.preview.editorUrl,
                  }
                : undefined,
              expansion: strategy.canvasEvolution.expansion
                ? {
                    tokenId: strategy.canvasEvolution.expansion.tokenId,
                    readinessScore: strategy.canvasEvolution.expansion.readinessScore,
                    recommendation: strategy.canvasEvolution.expansion.recommendation,
                    actionPoints: strategy.canvasEvolution.expansion.actionPoints,
                    level: strategy.canvasEvolution.expansion.level,
                    currentGrid: strategy.canvasEvolution.expansion.currentGrid,
                    targetGrid: strategy.canvasEvolution.expansion.targetGrid,
                    blockers: strategy.canvasEvolution.expansion.blockers,
                  }
                : undefined,
              watch: strategy.canvasEvolution.watch
                ? {
                    watched: strategy.canvasEvolution.watch.watched,
                    alerts: strategy.canvasEvolution.watch.alerts.slice(0, 8),
                    nextDueAt: strategy.canvasEvolution.watch.nextDueAt,
                    summary: strategy.canvasEvolution.watch.summary,
                  }
                : undefined,
            }
          : undefined,
      },
    },
  }

  return context
}
