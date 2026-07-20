// lib/agent-recommendations/types.ts
// Standalone Zulo agent recommendations plugin types.

export interface ZuloRecommendationContext {
  user: {
    ens?: string
    walletAddress: string
    preferences?: {
      riskTolerance?: "low" | "medium" | "high"
      goals?: string[]
      interests?: string[]
    }
    /** Optional live holdings snapshot from Normies API */
    holdings?: {
      normieCount: number
      tokenIds: number[]
    }
  }
  normie: {
    id: number
    name?: string
    traits: Record<string, string | number | boolean | null | undefined>
    owner?: string
    ownerMatchesUser?: boolean
    canvas?: {
      level: number
      actionPoints: number
      customized: boolean
      delegate?: string
    }
    rarity?: {
      rank?: number | null
      score?: number | null
      fairValue?: number | string | null
      awake?: boolean
      openseaUrl?: string
      traitHighlights?: Array<{
        trait_type: string
        value: string
        frequency?: number
      }>
    }
    agent: {
      id: number
      name: string
      status: "awakened" | "dormant"
      reputation?: number
      walletAddress?: string
      ens?: string
      type?: string
      tagline?: string
      backstory?: string
      personalityTraits?: string[]
      communicationStyle?: string
      recentActivity?: Array<{
        type: string
        description: string
        timestamp: string
      }>
    }
  }
  session: {
    history: Array<{
      userMessage: string
      zuloResponse: string
      timestamp: string
    }>
    currentGoal?: string
  }
  platformContext?: {
    currentTime: string
    recentMarketTrends?: string
    /** Contextual earning / utility hints derived from live data */
    earningOpportunities?: string[]
    rarityRank?: number | null
    rarityScore?: number | null
    fairValue?: number | string | null
    resources?: string[]
  }
}

export interface RecommendParams {
  userQuery: string
  normieId?: number
  sessionHistory?: Array<{ userMessage: string; zuloResponse: string }>
  userWallet?: string
  userEns?: string
}

export interface ZuloResponse {
  understanding: string
  recommendation: string | string[]
  reasoning: string
  nextSteps: string[]
  confidence?: number
  /** Optional tool / doc URLs or labels cited in the answer */
  sources?: string[]
}
