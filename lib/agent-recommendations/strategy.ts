// lib/agent-recommendations/strategy.ts
// Builds strategy snapshot for Zulo context (burns, floors, traits, wallet).

import {
  estimateAPYield,
  getBurnMarketNotes,
  normalizeType,
  tierFromRank,
  type APYieldEstimate,
  type OwnedNormieSnapshot,
} from "./burnData"
import { isBurnEfficiencyQuery } from "./burnEfficiency"
import {
  fetchFloorSnapshot,
  isFloorMarketBurnQuery,
  type FloorSnapshot,
} from "./floorContext"
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
  acquisition?: AcquisitionAnalysis
  burnMarketNotes?: string
  floorsNote?: string
  /** Live Moralis/OpenSea + Supabase history floor context (burn/market/floor intents) */
  floorSnapshot?: FloorSnapshot
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

  // Burn / market / floor / fodder / efficiency → always load real floor context
  const needsFloorSnapshot =
    runEfficiency ||
    runSentinel ||
    (!!input.userQuery && isFloorMarketBurnQuery(input.userQuery))

  const focusTokenId = input.focusTokenId ?? 7141

  const [
    apEstimateForFocus,
    acquisition,
    burnMarketNotes,
    floorSnapshot,
    marketSentinel,
    gachaRaffle,
    canvasEvolution,
  ] = await Promise.all([
    estimateAPYield(type, tier, Object.keys(input.focusTraits).length),
    analyzeAcquisitionStrategy(20, 0.05),
    getBurnMarketNotes(),
    needsFloorSnapshot
      ? fetchFloorSnapshot({ historyDays: 7 })
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

  // AGENTS.md: burn/buy views are fenced to /burn. No wallet burn/keep
  // ranking or AP-per-ETH optimizer is computed for Pulse / Ask Zulo.

  const summaryLines: string[] = []

  // Lead strategy with live floor when this is a burn/market/floor question
  if (floorSnapshot) {
    summaryLines.push(floorSnapshot.snapshotLine)
    for (const line of floorSnapshot.framingLines.slice(0, 4)) {
      summaryLines.push(line)
    }
  }

  summaryLines.push(
    `Focus estimate (${type}/${tier}): ~${apEstimateForFocus.median} AP (range ${apEstimateForFocus.min}–${apEstimateForFocus.max}, confidence ${apEstimateForFocus.confidence}, n=${apEstimateForFocus.sampleSize}).`,
    apEstimateForFocus.notes,
    traitAdvice.advice,
    burnMarketNotes,
    acquisition.recommendation,
    FLOORS_NOTE,
  )

  if (marketSentinel?.scanned) {
    // Drop position calls and arbitrage "opportunity" lines — facts only.
    summaryLines.push(
      marketSentinel.summary
        .split("\n")
        .filter(
          (l) =>
            !l.startsWith("Positions:") &&
            l !== marketSentinel.arbitrage.opportunity,
        )
        .join("\n"),
    )
    summaryLines.push(
      `Market state: floor=${marketSentinel.marketState.floorETH ?? "n/a"} ETH, Δfloor=${marketSentinel.marketState.floorChangePct ?? "n/a"}%, burnRatio=${marketSentinel.marketState.burnVolumeRatio ?? "n/a"}x, whales=${marketSentinel.signals.whaleCount}, AP market=${marketSentinel.marketState.apMarketStatus}`,
    )
  }
  if (gachaRaffle?.scanned) {
    // Facts only: feed status and pool/raffle counts. No +EV picks or AP plan.
    summaryLines.push(
      `Gacha & Raffle status (${gachaRaffle.dataStatus}): ${gachaRaffle.gachaPools.length} gacha pool(s), ${gachaRaffle.raffles.length} raffle(s) in feed. ${gachaRaffle.disclaimer}`,
    )
  }
  if (canvasEvolution?.scanned) {
    summaryLines.push(canvasEvolution.summary)
    if (canvasEvolution.preview) {
      const p = canvasEvolution.preview
      summaryLines.push(
        `Canvas Preview #${p.tokenId}: ${p.recommendation} @ ${p.confidence}% · ${p.before.pixelCountOn}→${p.after.pixelCountOn} px · ${p.costBreakdown.totalFlips} px official #PIXEL budget (not an AP debit)`,
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
    acquisition,
    burnMarketNotes,
    floorsNote: FLOORS_NOTE,
    floorSnapshot,
    marketSentinel,
    gachaRaffle,
    canvasEvolution,
    summaryLines,
  }
}
