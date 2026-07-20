// lib/agent-recommendations/index.ts
// Main entry point for the standalone Zulo recommendations plugin.

import { buildZuloContext } from "./buildContext"
import { generateZuloResponse } from "./generate"
import { postProcessZuloOutput } from "./postProcess"
import type { RecommendParams, ZuloRecommendationContext, ZuloResponse } from "./types"

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

export type { ZuloResponse, RecommendParams, ZuloRecommendationContext }
export {
  ZULO_IDENTITY,
  ZULO_RECOMMENDATIONS_DYOR,
  MAX_SESSION_HISTORY,
  MAX_USER_QUERY_CHARS,
} from "./constants"
