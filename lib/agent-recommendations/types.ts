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
    /** Normies Cred Pulse (ERC-8257 Tool #53) for the focus Normie */
    pulse?: CredHubPulseData
    pulseSummary?: string
    /**
     * Action Points on Normie #7141 Canvas (Zulo).
     * Not a wallet ledger — Canvas AP is per-Normie on-chain.
     */
    zuloCanvasAPBalance?: number
    /** Alias of zuloCanvasAPBalance for marketplace-facing copy */
    zuloAPBalance?: number
    /** Strategic burn / acquisition / trait analysis snapshot */
    strategy?: StrategyContext
  }
}

export interface StrategyContext {
  apEstimateForFocus?: {
    min: number
    max: number
    median: number
    confidence: "low" | "medium" | "high"
    sampleSize: number
    notes: string
  }
  traitAdvice?: {
    isPremium: boolean
    premiumFactor: number
    matchedTraits: string[]
    advice: string
  }
  burnCandidates?: Array<{
    tokenId: number
    type: string
    rarityTier: string
    rarityRank: number
  }>
  keepCandidates?: Array<{
    tokenId: number
    type: string
    rarityTier: string
    rarityRank: number
  }>
  burnReasoning?: string
  acquisition?: {
    recommendation: string
    options: Array<{
      type: string
      cost: number
      expectedAP: number
      efficiency: number
      confidence: "low" | "medium" | "high"
    }>
    floorsNote: string
  }
  burnMarketNotes?: string
  floorsNote?: string
  summaryLines?: string[]
}

/**
 * Real Normies Cred Pulse payload (this app's GET /api/agent/{tokenId}/pulse).
 * Distinct from canvas/rarity fields already on `normie.*`.
 */
export interface CredHubPulseData {
  tokenId: number
  agentId: number | null
  pulseLevel: number
  maxLevel: number
  status: string
  breakdown: string[]
  gaps: string[]
  nextSignal: string | null
  note: string
}

export type ZuloServiceCurrency = "AP" | "PIXEL" | "FREE"

export interface ZuloService {
  id: string
  name: string
  description: string
  price: {
    amount: number
    currency: ZuloServiceCurrency
  }
  endpoint: string
}

export interface ZuloManifest {
  agent: {
    id: number
    name: string
    ens: string
    wallet: string
    type: "ERC-8004"
  }
  services: ZuloService[]
  acceptedCurrencies: Array<"AP" | "PIXEL">
  version: string
  endpoint: string
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

/**
 * UI-facing PULSE snapshot for the unified Zulo experience.
 * Composed from CredHub pulse + canvas + rarity + opportunities (not mock).
 */
export interface ZuloPulseView {
  tokenId: number
  type: string
  status: "awakened" | "dormant"
  canvas: {
    edited: boolean
    actionPoints: number
    level: number
    pixelCount?: number
  }
  rarity: {
    rank: number | null
    score: number | null
    tier: string
  }
  agent: {
    id: number
    name: string
    reputation?: number
    services?: string[]
  }
  /** CredHub Tool #53 pulse level / signals when available */
  credHub?: CredHubPulseData
  pulseSummary?: string
  recommendations: string[]
  lastUpdated: string
}

export interface ZuloPulseApiResponse {
  pulse: ZuloPulseView | null
  zuloAP: number
  error?: string
}
