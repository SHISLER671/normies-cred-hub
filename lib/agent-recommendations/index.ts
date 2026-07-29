// lib/agent-recommendations/index.ts
// Main entry point for the standalone Zulo recommendations plugin.

import { buildZuloContext } from "./buildContext"
import { generateZuloResponse } from "./generate"
import { postProcessZuloOutput } from "./postProcess"
import type {
  CredHubPulseData,
  RecommendParams,
  StrategyContext,
  ZuloManifest,
  ZuloPulseApiResponse,
  ZuloPulseView,
  ZuloRecommendationContext,
  ZuloResponse,
  ZuloService,
} from "./types"

export async function getZuloRecommendation(
  params: RecommendParams,
): Promise<ZuloResponse> {
  const context = await buildZuloContext({
    normieId: params.normieId,
    sessionHistory: params.sessionHistory,
    userWallet: params.userWallet,
    userEns: params.userEns,
    userQuery: params.userQuery,
  })

  const rawOutput = await generateZuloResponse(context, params.userQuery)
  return postProcessZuloOutput(rawOutput)
}

export type {
  ZuloResponse,
  RecommendParams,
  ZuloRecommendationContext,
  CredHubPulseData,
  ZuloManifest,
  ZuloService,
  ZuloPulseView,
  ZuloPulseApiResponse,
  StrategyContext,
}

export { estimateAPYield, findBurnCandidates, fetchLiveBurns } from "./burnData"
export {
  analyzeAcquisitionStrategy,
  getLiveCollectionFloor,
  CURRENT_FLOORS,
  FLOORS_NOTE,
  OPENSEA_COLLECTION_URL,
} from "./marketData"
export {
  scanBurnEfficiency,
  isBurnEfficiencyQuery,
  fetchOpenSeaBestListings,
  BURN_EFFICIENCY_DISCLAIMER,
} from "./burnEfficiency"
export type {
  BurnEfficiencyCandidate,
  BurnEfficiencyResult,
} from "./burnEfficiency"
export {
  runMarketSentinel,
  isMarketSentinelQuery,
  MARKET_SENTINEL_DISCLAIMER,
  FLOOR_CHANGE_THRESHOLD_PCT,
  BURN_SPIKE_RATIO,
  WHALE_TOKEN_THRESHOLD,
} from "./marketSentinel"
export type {
  MarketSentinelResult,
  MarketStateSnapshot,
  MarketIntelligenceBrief,
  WhaleAlert,
} from "./marketSentinel"
export {
  analyzeGachaRaffle,
  isGachaRaffleQuery,
  recommendApAllocation,
  GACHA_RAFFLE_DISCLAIMER,
  POSITIVE_EV_THRESHOLD,
  HIGH_VALUE_EDGE_PCT,
} from "./gachaRaffle"
export type {
  GachaRaffleResult,
  GachaPoolAnalysis,
  RaffleAnalysis,
  ApAllocationLine,
} from "./gachaRaffle"
export {
  previewCanvas,
  analyzeExpansionReadiness,
  runCanvasWatch,
  runCanvasEvolution,
  isCanvasEvolutionQuery,
  parseProposedChanges,
  fetchCanvasState,
  countOnPixels,
  densityPct,
  transformApCost,
  CANVAS_EVOLUTION_DISCLAIMER,
  CANVAS_WATCH_INTERVAL_MS,
  SIGNIFICANT_TRANSFORM_PCT,
  AP_PER_PIXEL_EDIT,
} from "./canvasEvolution"
export type {
  CanvasPreviewResult,
  ExpansionReadinessResult,
  CanvasWatchResult,
  CanvasEvolutionResult,
  ProposedCanvasChanges,
} from "./canvasEvolution"
export { analyzeTraitCombo, PREMIUM_COMBOS } from "./traitAnalysis"
export { buildStrategySnapshot } from "./strategy"
export {
  NORMIES_KNOWLEDGE,
  buildNormiesWisdomPrompt,
  apTierForPixelCount,
  estimateBurnApFromPixels,
  levelFromActionPoints,
} from "./normiesKnowledge"
export {
  COMMUNITY_TOOLS,
  getToolsFor,
  getToolsForAudience,
  getToolsForQuery,
  buildEcosystemGuidePrompt,
} from "./communityTools"
export type { CommunityTool } from "./communityTools"

export {
  ZULO_IDENTITY,
  ZULO_RECOMMENDATIONS_DYOR,
  MAX_SESSION_HISTORY,
  MAX_USER_QUERY_CHARS,
  ECOSYSTEM_LINKS,
  DEFAULT_RESOURCE_LINKS,
  CRED_HUB_PULSE,
  ZULO_SERVICE_PRICES,
} from "./constants"

export { getManifest } from "./manifest"
export {
  verifyAPPayment,
  isHolder,
  getServicePrice,
  type PaymentVerification,
} from "./verifyPayment"
