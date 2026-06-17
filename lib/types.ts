/**
 * Shared types for the Normies + Ethos data layer.
 * Shapes were verified against live API responses.
 */

export interface NormieTrait {
  trait_type: string
  value: string | number
  display_type?: string
}

export interface NormieTraits {
  raw: string
  attributes: NormieTrait[]
}

export interface NormieMetadata {
  name: string
  attributes: NormieTrait[]
  image: string
  animation_url?: string
}

export interface NormieOwner {
  tokenId: string
  owner: string
}

export interface CanvasInfo {
  actionPoints: number
  level: number
  customized: boolean
  delegate: string
  delegateSetBy: string
}

export interface CanvasDiff {
  added: { x: number; y: number }[]
  removed: { x: number; y: number }[]
  addedCount: number
  removedCount: number
  netChange: number
}

export interface AgentInfo {
  tokenId: string
  agentId: string
  chainId: number
  name: string
  type: string
  tagline: string
  backstory: string
  greeting: string
  personalityTraits: string[]
  communicationStyle: string
  quirks: string[]
  systemPrompt: string
  traits?: {
    name: string
    attributes: Record<string, string>
  }
  canvas?: {
    level: number
    actionPoints: number
    customized: boolean
    diff: { addedCount: number; removedCount: number; netChange: number }
  }
  registeredBy?: string
  registeredAt?: string
  txHash?: string
}

/** Combined snapshot used by the dashboard. */
export interface NormieSnapshot {
  tokenId: number
  metadata: NormieMetadata
  traits: NormieTraits
  owner: NormieOwner
  canvas: CanvasInfo
  canvasDiff: CanvasDiff
  agent: AgentInfo
  imageUrl: string
}

// ---- Ethos ----

export type EthosLevel =
  | "Untrusted"
  | "Questionable"
  | "Neutral"
  | "Reputable"
  | "Exemplary"
  | "Revered"

export interface EthosStats {
  review?: {
    received?: { negative: number; neutral: number; positive: number }
  }
  vouch?: {
    given?: { amountWeiTotal: string; count: number }
    received?: { amountWeiTotal: string; count: number }
  }
}

export interface EthosUser {
  id: number
  profileId: number | null
  displayName: string | null
  username: string | null
  avatarUrl: string | null
  description: string | null
  score: number
  status: string
  userkeys: string[]
  xpTotal: number
  xpStreakDays: number
  influenceFactor: number
  influenceFactorPercentile: number
  humanVerificationStatus: string | null
  validatorNftCount: number
  links: {
    profile: string
    scoreBreakdown: string
  }
  stats: EthosStats
}

export interface EthosScoreResult {
  user: EthosUser | null
  level: EthosLevel | null
  found: boolean
  address: string
}
