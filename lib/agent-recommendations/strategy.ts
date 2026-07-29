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
  summaryLines: string[]
}

export async function buildStrategySnapshot(input: {
  focusType?: string
  focusRank?: number | null
  focusTraits: Record<string, string | number | boolean | null | undefined>
  owned?: OwnedNormieSnapshot[]
  /** When set, may trigger Burn Efficiency Optimizer / Market Sentinel. */
  userQuery?: string
  /** Force efficiency scan even without matching query keywords. */
  forceBurnEfficiency?: boolean
  /** Force PIXEL MARKET Sentinel even without matching query keywords. */
  forceMarketSentinel?: boolean
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

  const [
    apEstimateForFocus,
    acquisition,
    burnMarketNotes,
    burnEfficiency,
    marketSentinel,
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
    summaryLines,
  }
}
