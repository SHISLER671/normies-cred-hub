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
      /** Count of "on" pixels (0–1600) when pixels endpoint is available */
      pixelCount?: number
      /** Theoretical burn AP range from pixel tier formula */
      burnApEstimate?: {
        minAp: number
        maxAp: number
        tierLabel: string
        minPct: number
        maxPct: number
      }
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
    /**
     * Live floor + Supabase history snapshot for burn / market / floor intents.
     * Same pipeline as GET /api/zulo/history (Moralis/OpenSea + floor_prices).
     */
    floorSnapshot?: {
      available: boolean
      stale: boolean
      latestFloorETH: number | null
      avgFloorETH: number | null
      minFloorETH: number | null
      maxFloorETH: number | null
      pctVsAvg: number | null
      source: string | null
      asOf: string | null
      historySampleSize: number
      historyDays: number
      historyLatestRecordedAt: string | null
      openSeaUrl: string
      snapshotLine: string
      framingLines: string[]
      note: string
    }
    /** PIXEL MARKET Sentinel live market state (when skill runs) */
    marketState?: {
      asOf: string
      floorETH: number | null
      floorSource?: string
      floorChangePct: number | null
      oneDayVolumeETH: number | null
      sevenDayVolumeETH: number | null
      sales1d: number | null
      sales7d: number | null
      volumeVelocityRatio: number | null
      burnTokensRecent24h: number
      burnTokensPrev24h: number
      burnVolumeRatio: number | null
      historicalApMedian: number | null
      impliedApCostETH: number | null
      floorBuyEfficiency: number | null
      apMarketStatus: "planned" | "live"
      apMarketPriceETH: number | null
      owners: number | null
    }
    /** Gacha & Raffle Intelligence compact context (when skill runs) */
    gachaRaffle?: {
      dataStatus: "live" | "partial" | "unavailable"
      poolCount: number
      raffleCount: number
      positiveEvCount: number
      highValueRaffleCount: number
      positiveEv: Array<{
        kind: "gacha" | "raffle"
        id: string
        name: string
        evRatio: number
        edgePct: number
      }>
      apAllocation: {
        budgetAp: number
        lines: Array<{
          opportunityId: string
          opportunityName: string
          kind: "gacha" | "raffle"
          suggestedAp: number
          sharePct: number
          evRatio: number
          reason: string
        }>
        unallocatedAp: number
        note: string
      }
      pitySummary: string[]
      qualificationSummary: string[]
      floorETH: number | null
      disclaimer: string
      summary: string
    }
    /**
     * Pixel economy doctrine — injected on all strategy-bearing contexts
     * (from knowledge/pixel-economy.md).
     */
    pixelEconomy?: {
      title: string
      pillars: string[]
      zuloRole: string[]
      principles: string[]
      source: string
    }
    /**
     * Pixel vs AP currency scaffolding — only when PIXEL_CURRENCY_ENABLED
     * (from lib/knowledge/pixel-currency.md).
     */
    pixelCurrency?: {
      title: string
      status: string
      pillars: string[]
      conversion: string[]
      principles: string[]
      source: string
    }
    /**
     * Payment & platform security — injected on all strategy-bearing contexts
     * (from knowledge/payment-security.md).
     */
    paymentSecurity?: {
      title: string
      posture: string
      layers: string[]
      sevPlaybook: string[]
      principles: string[]
      source: string
    }
    /**
     * Protocol stack (x402 / ERC-8004 / ERC-8257) — injected on all
     * strategy-bearing contexts (from knowledge/protocols-deep-dive.md).
     */
    protocolsDeepDive?: {
      title: string
      stack: string[]
      x402: string[]
      erc8004: string[]
      erc8257: string[]
      zulo: string[]
      source: string
    }
    /**
     * ERC-6551 / TBA optional account plane
     * (from knowledge/erc-6551.md + lib/erc6551).
     */
    erc6551?: {
      title: string
      status: string
      pillars: string[]
      zulo: string[]
      security: string[]
      source: string
    }
    /** Canvas Evolution Advisor — preview / expansion / watch */
    canvasEvolution?: {
      mode: string
      canvasState?: {
        tokenId: number
        actionPoints: number
        level: number
        customized: boolean
        pixelCountOn: number
        pixelCountOff: number
        densityPct: number
        diff: { addedCount: number; removedCount: number; netChange: number }
      }
      preview?: {
        tokenId: number
        recommendation: "PROCEED" | "MODIFY" | "ABANDON"
        confidence: number
        before: {
          pixelCountOn: number
          pixelCountOff: number
          actionPoints: number
          level: number
          customized: boolean
          densityPct: number
        }
        after: {
          pixelCountOn: number
          pixelCountOff: number
          actionPoints: number
          level: number
          customized: boolean
          densityPct: number
        }
        costBreakdown: {
          pixelsToAdd: number
          pixelsToRemove: number
          totalFlips: number
          apPerPixel: number
          totalApCost: number
          availableAp: number
          remainingApAfter: number
          canAfford: boolean
          tierRateMidPct: number
          tierRateReferenceAp: number
          notes: string
        }
        aesthetic: {
          placementStrategy: string
          visualCoherence: string
          rarityImplications: string
          puristStatusImpact: string
          densityBeforePct: number
          densityAfterPct: number
          score: number
        }
        reasoning: string[]
        editorUrl: string
        disclaimer: string
      }
      expansion?: {
        tokenId: number
        readinessScore: number
        actionPoints: number
        level: number
        currentGrid: { size: number; capacity: number; pixelsOn: number; densityPct: number }
        targetGrid: { size: number; capacity: number }
        apReadiness: { score: number; note: string }
        densityReadiness: { score: number; note: string }
        levelReadiness: { score: number; note: string }
        milestones: string[]
        blockers: string[]
        recommendation: string
      }
      watch?: {
        watched: number
        alertCount: number
        alerts: Array<{
          tokenId: number
          type: string
          message: string
          pixelChangePct: number | null
          beforePixelsOn: number | null
          afterPixelsOn: number
          at: string
        }>
        nextDueAt: string | null
        summary: string
      }
      disclaimer: string
      summary: string
    }
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
      cost: number | null
      expectedAP: number
      efficiency: number | null
      confidence: "low" | "medium" | "high"
    }>
    floorsNote: string
    liveFloorETH?: number | null
    liveFloorSource?: string
    liveFloorUpdatedAt?: string
  }
  burnMarketNotes?: string
  floorsNote?: string
  summaryLines?: string[]
  /** Live Moralis/OpenSea + Supabase 7d history (burn/market/floor intents) */
  floorSnapshot?: {
    available: boolean
    stale: boolean
    latestFloorETH: number | null
    avgFloorETH: number | null
    minFloorETH: number | null
    maxFloorETH: number | null
    pctVsAvg: number | null
    source: string | null
    asOf: string | null
    historySampleSize: number
    historyDays: number
    historyLatestRecordedAt: string | null
    openSeaUrl: string
    snapshotLine: string
    framingLines: string[]
    note: string
  }
  /** Burn Efficiency Optimizer — top AP/ETH market fodder candidates */
  burnEfficiency?: {
    scanned: boolean
    topCandidates: Array<{
      tokenId: number
      floorPriceETH: number
      estimatedAP: number
      efficiencyScore: number
      rarityTier?: string
      rarityRank?: number | null
      type?: string
      pixelCount?: number
      priceSource?: string
      confidence?: string
    }>
    collectionFloorETH: number | null
    collectionFloorSource?: string
    burnSampleSize: number
    historicalApMedian: number | null
    /** Current floor vs Supabase 7-day average (when history available) */
    floorHistory?: {
      currentFloorETH: number | null
      avg7dFloorETH: number | null
      min7dFloorETH: number | null
      max7dFloorETH: number | null
      sampleSize: number
      pctVs7dAvg: number | null
      vsAvgLabel: "below_avg" | "near_avg" | "above_avg" | "insufficient_data"
    }
    disclaimer: string
    summary: string
    sources?: string[]
  }
  /** PIXEL MARKET Sentinel — floor / burn / whale intelligence brief */
  marketSentinel?: {
    scanned: boolean
    brief: {
      headline: string
      trend: string
      trendContext: string
      triggerAnalysis: string[]
    }
    signals: {
      floorChangePct: number | null
      floorTriggered: boolean
      burnVolumeRatio: number | null
      burnSpikeTriggered: boolean
      whaleCount: number
      whaleTriggered: boolean
      triggers: string[]
    }
    marketState: {
      asOf: string
      floorETH: number | null
      floorSource?: string
      floorChangePct: number | null
      oneDayVolumeETH: number | null
      sevenDayVolumeETH: number | null
      sales1d: number | null
      sales7d: number | null
      volumeVelocityRatio: number | null
      burnTokensRecent24h: number
      burnTokensPrev24h: number
      burnVolumeRatio: number | null
      historicalApMedian: number | null
      impliedApCostETH: number | null
      floorBuyEfficiency: number | null
      apMarketStatus: "planned" | "live"
      apMarketPriceETH: number | null
      owners: number | null
    }
    arbitrage: {
      available: boolean
      floorBuyEfficiency: number | null
      impliedApCostETH: number | null
      apMarketPriceETH: number | null
      apMarketStatus: "planned" | "live"
      spreadNote: string
      opportunity: string
    }
    positionRecommendations: string[]
    whaleActivity: {
      summary: string
      whales: Array<{
        label: string
        tokensMoved: number
        activity: string
        windowNote: string
      }>
      correlationPatterns: string[]
    }
    disclaimer: string
    summary: string
    sources?: string[]
  }
  /** Gacha & Raffle Intelligence — EV pools, raffles, AP allocation */
  gachaRaffle?: {
    scanned: boolean
    dataStatus: "live" | "partial" | "unavailable"
    gachaPools: Array<{
      id: string
      name: string
      status: string
      costAp: number | null
      costEth: number | null
      expectedValueAp: number | null
      expectedValueEth: number | null
      evRatio: number | null
      edgePct: number | null
      isPositiveEv: boolean
      isHighValue: boolean
      pity: {
        counter: number | null
        softPityAt: number | null
        hardPityAt: number | null
        pullsToSoft: number | null
        pullsToHard: number | null
        note: string
      } | null
      qualification: {
        minAp: number | null
        minNormieCount: number | null
        requiresHolder: boolean | null
        requiresAwakened: boolean | null
        note: string
        qualified: boolean | null
      } | null
      notes: string
    }>
    raffles: Array<{
      id: string
      name: string
      status: string
      entryCostAp: number | null
      entryCostEth: number | null
      prizeValueAp: number | null
      prizeValueEth: number | null
      totalEntries: number | null
      winProbability: number | null
      expectedValueAp: number | null
      expectedValueEth: number | null
      evRatio: number | null
      edgePct: number | null
      isPositiveEv: boolean
      isHighValue: boolean
      qualification: {
        minAp: number | null
        minNormieCount: number | null
        requiresHolder: boolean | null
        requiresAwakened: boolean | null
        note: string
        qualified: boolean | null
      } | null
      endsAt: string | null
      notes: string
    }>
    positiveEv: Array<{
      kind: "gacha" | "raffle"
      id: string
      name: string
      evRatio: number
      edgePct: number
    }>
    highValueRaffles: Array<{
      id: string
      name: string
      evRatio: number | null
      edgePct: number | null
      entryCostAp: number | null
      prizeValueEth: number | null
      totalEntries: number | null
    }>
    apAllocation: {
      budgetAp: number
      lines: Array<{
        opportunityId: string
        opportunityName: string
        kind: "gacha" | "raffle"
        suggestedAp: number
        sharePct: number
        evRatio: number
        reason: string
      }>
      unallocatedAp: number
      note: string
    }
    pitySummary: string[]
    qualificationSummary: string[]
    floorETH: number | null
    disclaimer: string
    summary: string
    sources?: string[]
  }
  /** Canvas Evolution Advisor full strategy payload */
  canvasEvolution?: {
    scanned: boolean
    mode: string
    summary: string
    disclaimer: string
    preview?: {
      tokenId: number
      recommendation: "PROCEED" | "MODIFY" | "ABANDON"
      confidence: number
      before: {
        pixelCountOn: number
        pixelCountOff: number
        actionPoints: number
        level: number
        customized: boolean
        densityPct: number
      }
      after: {
        pixelCountOn: number
        pixelCountOff: number
        actionPoints: number
        level: number
        customized: boolean
        densityPct: number
      }
      costBreakdown: {
        pixelsToAdd: number
        pixelsToRemove: number
        totalFlips: number
        apPerPixel: number
        totalApCost: number
        availableAp: number
        remainingApAfter: number
        canAfford: boolean
        tierRateMidPct: number
        tierRateReferenceAp: number
        notes: string
      }
      aesthetic: {
        placementStrategy: string
        visualCoherence: string
        rarityImplications: string
        puristStatusImpact: string
        densityBeforePct: number
        densityAfterPct: number
        score: number
      }
      reasoning: string[]
      editorUrl: string
    }
    expansion?: {
      tokenId: number
      readinessScore: number
      recommendation: string
      actionPoints: number
      level: number
      currentGrid: { size: number; capacity: number; pixelsOn: number; densityPct: number }
      targetGrid: { size: number; capacity: number }
      blockers: string[]
    }
    watch?: {
      watched: number
      alerts: Array<{
        tokenId: number
        type: string
        message: string
        pixelChangePct: number | null
        beforePixelsOn: number | null
        afterPixelsOn: number
        at: string
      }>
      nextDueAt: string | null
      summary: string
    }
  }
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
  /** Product role — strategic-architect (not concierge butler) */
  role?: string
  services: ZuloService[]
  /** Discoverable strategy skills with sample prompts */
  skills?: Array<{
    id: string
    name: string
    status: "live" | "partial" | "planned"
    description: string
    samplePrompt: string
    endpoint: string
  }>
  strategySkills?: string[]
  acceptedCurrencies: Array<"AP" | "PIXEL">
  version: string
  endpoint: string
  /** How agents/users pay Zulo when A2A rails are live */
  payment?: {
    status: "planned" | "live"
    /** Primary settlement currency (remains AP for backward compatibility) */
    currency: "AP" | "PIXEL"
    /** Discovery list — AP first, PIXEL scaffolded for PIXEL MARKET */
    currencies?: Array<"AP" | "PIXEL">
    /** Preferred default (env DEFAULT_CURRENCY; AP unless Pixel enabled) */
    default?: "AP" | "PIXEL"
    /** Always AP for legacy clients */
    fallback?: "AP" | "PIXEL"
    /** Conversion oracle between AP and PIXEL — planned until serc docs */
    conversionOracle?: "planned" | "live"
    /** Pixel currency feature status (not payment enforcement) */
    pixelCurrencyStatus?: "disabled" | "scaffolded" | "live"
    receiverWallet: string
    /** hot-wallet | erc6551-tba — EVM destination adapter */
    receiverMode?: "hot-wallet" | "erc6551-tba"
    receiverNormieTokenId: number
    /** Ordered tip assets: canvas-ap → x402-usdc → eth-mainnet → eth-base */
    tipAssetPriority?: string[]
    verification?: {
      module: string
      enforced: boolean
      methods: string[]
    }
    notes: string[]
    /** Human-readable how-to when marketplace launches */
    howToPayWhenLive: string[]
  }
  integrations?: {
    normiesApi?: string
    opensea?: { collection: string; stats: string }
    pixelMarket?: { status: "planned" | "live"; note: string }
    ethos?: string
  }
  /** Health / readiness probe */
  health?: string
  /** Short public pitch for discovery UIs */
  pitch?: string
  freeAccess?: {
    path: string
    description: string
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
