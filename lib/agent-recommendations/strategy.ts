// lib/agent-recommendations/strategy.ts
// Builds strategy snapshot for Zulo context (burns, floors, traits, wallet).

import {
  estimateAPYield,
  findBurnCandidates,
  getBurnMarketNotes,
  normalizeType,
  tierFromRank,
  type APYieldEstimate,
  type OwnedNormieSnapshot,
} from "./burnData"
import {
  isBurnEfficiencyQuery,
  scanBurnEfficiency,
  type BurnEfficiencyResult,
} from "./burnEfficiency"
import {
  analyzeAcquisitionStrategy,
  FLOORS_NOTE,
  type AcquisitionAnalysis,
} from "./marketData"
import {
  isCanvasEvolutionQuery,
  runCanvasEvolution,
  type CanvasEvolutionResult,
} from "./canvasEvolution"
import {
  analyzeGachaRaffle,
  isGachaRaffleQuery,
  type GachaRaffleResult,
} from "./gachaRaffle"
import {
  isMarketSentinelQuery,
  runMarketSentinel,
  type MarketSentinelResult,
} from "./marketSentinel"
import { analyzeTraitCombo, type TraitComboAdvice } from "./traitAnalysis"

export interface StrategySnapshot {
  apEstimateForFocus?: APYieldEstimate
  traitAdvice?: TraitComboAdvice
  burnCandidates?: OwnedNormieSnapshot[]
  keepCandidates?: OwnedNormieSnapshot[]
  burnReasoning?: string
  acquisition?: AcquisitionAnalysis
  burnMarketNotes?: string
  floorsNote?: string
  burnEfficiency?: BurnEfficiencyResult
  marketSentinel?: MarketSentinelResult
  gachaRaffle?: GachaRaffleResult
  canvasEvolution?: CanvasEvolutionResult
  summaryLines: string[]
}

export async function buildStrategySnapshot(input: {
  focusType?: string
  focusRank?: number | null
  focusTraits: Record<string, string | number | boolean | null | undefined>
  owned?: OwnedNormieSnapshot[]
  /** When set, may trigger skill scans from free-text. */
  userQuery?: string
  /** Force efficiency scan even without matching query keywords. */
  forceBurnEfficiency?: boolean
  /** Force PIXEL MARKET Sentinel even without matching query keywords. */
  forceMarketSentinel?: boolean
  /** Force Gacha & Raffle Intelligence even without matching query keywords. */
  forceGachaRaffle?: boolean
  /** Force Canvas Evolution Advisor even without matching query keywords. */
  forceCanvasEvolution?: boolean
  /** Canvas AP on focus Normie — used for gacha/raffle AP allocation. */
  focusActionPoints?: number
  focusTokenId?: number
  isHolder?: boolean
  isAwakened?: boolean
  isPremiumFocus?: boolean
}): Promise<StrategySnapshot> {
  const type = normalizeType(input.focusType)
  const tier = tierFromRank(input.focusRank ?? null)
  const traitAdvice = analyzeTraitCombo(input.focusTraits)

  const runEfficiency =
    input.forceBurnEfficiency === true ||
    (!!input.userQuery && isBurnEfficiencyQuery(input.userQuery))

  const runSentinel =
    input.forceMarketSentinel === true ||
    (!!input.userQuery && isMarketSentinelQuery(input.userQuery))

  const runGacha =
    input.forceGachaRaffle === true ||
    (!!input.userQuery && isGachaRaffleQuery(input.userQuery))

  const runCanvas =
    input.forceCanvasEvolution === true ||
    (!!input.userQuery && isCanvasEvolutionQuery(input.userQuery))

  const focusTokenId = input.focusTokenId ?? 7141

  const [
    apEstimateForFocus,
    acquisition,
    burnMarketNotes,
    burnEfficiency,
    marketSentinel,
    gachaRaffle,
    canvasEvolution,
  ] = await Promise.all([
    estimateAPYield(type, tier, Object.keys(input.focusTraits).length),
    analyzeAcquisitionStrategy(20, 0.05),
    getBurnMarketNotes(),
    runEfficiency
      ? scanBurnEfficiency({
          ownedTokenIds: input.owned?.map((o) => o.tokenId),
        })
      : Promise.resolve(undefined),
    runSentinel ? runMarketSentinel() : Promise.resolve(undefined),
    runGacha
      ? analyzeGachaRaffle({
          budgetAp: input.focusActionPoints,
          userAp: input.focusActionPoints,
          normieCount: input.owned?.length,
          isHolder: input.isHolder,
          isAwakened: input.isAwakened,
        })
      : Promise.resolve(undefined),
    runCanvas
      ? runCanvasEvolution({
          userQuery: input.userQuery || "canvas preview",
          focusTokenId,
          rarityRank: input.focusRank,
          isPremium: input.isPremiumFocus ?? traitAdvice.isPremium,
          watchlist: input.owned?.map((o) => o.tokenId),
        })
      : Promise.resolve(undefined),
  ])

  let burnCandidates: OwnedNormieSnapshot[] | undefined
  let keepCandidates: OwnedNormieSnapshot[] | undefined
  let burnReasoning: string | undefined

  if (input.owned && input.owned.length > 0) {
    const ownedTagged = input.owned.map((o) => ({
      ...o,
      isPremiumCombo: o.isPremiumCombo ?? false,
    }))
    const result = findBurnCandidates(ownedTagged)
    burnCandidates = result.burnCandidates
    keepCandidates = result.keepCandidates
    burnReasoning = result.reasoning
  }

  const summaryLines: string[] = [
    `Focus estimate (${type}/${tier}): ~${apEstimateForFocus.median} AP (range ${apEstimateForFocus.min}–${apEstimateForFocus.max}, confidence ${apEstimateForFocus.confidence}, n=${apEstimateForFocus.sampleSize}).`,
    apEstimateForFocus.notes,
    traitAdvice.advice,
    burnMarketNotes,
    acquisition.recommendation,
    FLOORS_NOTE,
  ]

  if (burnReasoning) summaryLines.push(burnReasoning)
  if (burnCandidates?.length) {
    summaryLines.push(
      `Burn candidates (token IDs): ${burnCandidates.map((b) => `#${b.tokenId}`).join(", ")}`,
    )
  }
  if (burnEfficiency?.scanned) {
    summaryLines.push(burnEfficiency.summary)
    if (burnEfficiency.topCandidates.length) {
      summaryLines.push(
        `Efficiency top 5 (token | price ETH | est AP | AP/ETH): ${burnEfficiency.topCandidates
          .map(
            (c) =>
              `#${c.tokenId} | ${c.floorPriceETH} | ~${c.estimatedAP} | ${c.efficiencyScore}`,
          )
          .join(" · ")}`,
      )
    }
  }
  if (marketSentinel?.scanned) {
    summaryLines.push(marketSentinel.summary)
    summaryLines.push(
      `Market state: floor=${marketSentinel.marketState.floorETH ?? "n/a"} ETH, Δfloor=${marketSentinel.marketState.floorChangePct ?? "n/a"}%, burnRatio=${marketSentinel.marketState.burnVolumeRatio ?? "n/a"}x, whales=${marketSentinel.signals.whaleCount}, AP market=${marketSentinel.marketState.apMarketStatus}`,
    )
  }
  if (gachaRaffle?.scanned) {
    summaryLines.push(gachaRaffle.summary)
    if (gachaRaffle.positiveEv.length) {
      summaryLines.push(
        `+EV opportunities: ${gachaRaffle.positiveEv
          .slice(0, 5)
          .map((p) => `${p.kind}:${p.name} ${p.evRatio.toFixed(2)}×`)
          .join(" · ")}`,
      )
    }
    if (gachaRaffle.apAllocation.lines.length) {
      summaryLines.push(
        `AP allocation plan: ${gachaRaffle.apAllocation.lines
          .map((l) => `${l.opportunityName}=${l.suggestedAp}AP`)
          .join("; ")}`,
      )
    }
  }
  if (canvasEvolution?.scanned) {
    summaryLines.push(canvasEvolution.summary)
    if (canvasEvolution.preview) {
      const p = canvasEvolution.preview
      summaryLines.push(
        `Canvas Preview #${p.tokenId}: ${p.recommendation} @ ${p.confidence}% · ${p.before.pixelCountOn}→${p.after.pixelCountOn} px · cost ${p.costBreakdown.totalApCost} AP`,
      )
    }
    if (canvasEvolution.expansion) {
      summaryLines.push(
        `80×80 readiness #${canvasEvolution.expansion.tokenId}: ${canvasEvolution.expansion.readinessScore}/100`,
      )
    }
  }

  return {
    apEstimateForFocus,
    traitAdvice,
    burnCandidates,
    keepCandidates,
    burnReasoning,
    acquisition,
    burnMarketNotes,
    floorsNote: FLOORS_NOTE,
    burnEfficiency,
    marketSentinel,
    gachaRaffle,
    canvasEvolution,
    summaryLines,
  }
}
