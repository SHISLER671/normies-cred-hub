// lib/agent-recommendations/index.ts
// Main entry point for the standalone Zulo recommendations plugin.

import { buildZuloContext } from "./buildContext"
import { isCollectionMathQuery } from "./collectionMath"
import { loadCollectionMath } from "./collectionMath.server"
import { ASK_BUDGET_MS, generateZuloResponse } from "./generate"
import { postProcessZuloOutput } from "./postProcess"
import { ensurePulseFirst } from "./pulseFirst"
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
  // The request budget starts now, so a slow context build leaves less for the model.
  const deadlineMs = Date.now() + ASK_BUDGET_MS
  const [context, collectionMath] = await Promise.all([
    buildZuloContext({
      normieId: params.normieId,
      sessionHistory: params.sessionHistory,
      userWallet: params.userWallet,
      userEns: params.userEns,
      userQuery: params.userQuery,
    }),
    // Collection-wide questions ("if every Normie burned…") get exact sums from the index. Null on any failure.
    isCollectionMathQuery(params.userQuery) ? loadCollectionMath() : Promise.resolve(null),
  ])
  if (collectionMath && context.platformContext) context.platformContext.collectionMath = collectionMath

  const rawOutput = await generateZuloResponse(context, params.userQuery, deadlineMs)
  const processed = postProcessZuloOutput(rawOutput)
  return ensurePulseFirst(processed, context, params.userQuery)
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
  resolveLiveCollectionFloor,
  CURRENT_FLOORS,
  FLOORS_NOTE,
  OPENSEA_COLLECTION_URL,
} from "./marketData"
export {
  fetchFloorSnapshot,
  isFloorMarketBurnQuery,
  FLOOR_SNAPSHOT_FRAMING,
} from "./floorContext"
export type { FloorSnapshot } from "./floorContext"
export {
  scanBurnEfficiency,
  isBurnEfficiencyQuery,
  fetchOpenSeaBestListings,
  BURN_EFFICIENCY_DISCLAIMER,
} from "./burnEfficiency"
export type {
  BurnEfficiencyCandidate,
  BurnEfficiencyResult,
  FloorVsHistory,
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
  analyzeCanvasCosts,
  analyzeExpansionReadiness,
  fetchCanvasPrices,
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
  CanvasCostsResult,
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

export { parseNormieTokenIdsFromText } from "./parseTokenIds"
export {
  formatBurnMath,
  parsePaidEthFromQuery,
  deriveEthUsd,
} from "./burnMath"

export {
  loadAgentToolsKnowledge,
  loadZuloPersona,
  loadPixelEconomyKnowledge,
  loadPaymentSecurityKnowledge,
  loadProtocolsDeepDiveKnowledge,
  loadProtocolsCondensedKnowledge,
  loadErc6551Knowledge,
  loadCollabRailsKnowledge,
  buildAgentToolsPromptBlock,
  buildPersonaPromptBlock,
  buildPixelEconomyPromptBlock,
  buildDualEvalAndPixelMarketPromptBlock,
  buildCollabRailsPromptBlock,
  buildPaymentSecurityPromptBlock,
  buildProtocolsPromptBlock,
  buildProtocolsDeepDivePromptBlock,
  buildErc6551PromptBlock,
  queryNeedsFullProtocolsKnowledge,
  queryNeedsErc6551Knowledge,
  queryNeedsCollabRailsKnowledge,
  getPixelEconomyContextSummary,
  getDualEvalAndPixelMarketContextSummary,
  getCollabRailsContextSummary,
  getPaymentSecurityContextSummary,
  getProtocolsDeepDiveContextSummary,
  getErc6551ContextSummary,
} from "./loadKnowledge"

export {
  ZULO_STRATEGY_SKILLS,
  ZULO_CORE_SKILLS,
  getAllZuloSkills,
} from "./skillsCatalog"
export type { ZuloSkillDef, ZuloSkillId } from "./skillsCatalog"

export { getManifest } from "./manifest"
export {
  verifyAPPayment,
  requirePaymentIfNeeded,
  getPaymentRailStatus,
  isHolder,
  getServicePrice,
  type PaymentVerification,
} from "./verifyPayment"

/**
 * Pixel currency scaffolding (feature-flagged; default off).
 * Safe for client bundles — no fs/path. Knowledge helpers stay in
 * @/lib/knowledge/pixel-currency (imported only from server modules).
 */
export {
  CURRENCIES,
  convertCurrency,
  formatCurrencyAmount,
  displayCurrencyLabel,
  type CurrencyCode,
} from "@/lib/currencies"
export {
  isPixelCurrencyEnabled,
  getDefaultCurrency,
  getAcceptedCurrencies,
  getPaymentCurrencyConfig,
  getPixelCurrencyStatus,
} from "@/lib/payments/config"
