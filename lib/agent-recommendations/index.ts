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
export { analyzeAcquisitionStrategy, CURRENT_FLOORS, FLOORS_NOTE } from "./marketData"
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
