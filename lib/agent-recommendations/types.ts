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
}
