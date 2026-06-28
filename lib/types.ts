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

// ---- Credibility signals (modular, source-agnostic) ----

export type CredibilitySignalSource = "erc8004" | "ethos" | "wire" | "erc8257" | (string & {})

export type CredibilitySignalCategory =
  | "identity"
  | "ownership"
  | "execution"
  | "reputation"
  | "external"
  | "tooling"

/** Normalized credibility signal consumed by the framework UI. */
export interface CredibilitySignal {
  id: string
  source: CredibilitySignalSource
  category: CredibilitySignalCategory
  title: string
  description?: string
  score?: number
  weight?: number
  verifiable: boolean
  metadata?: Record<string, any>
  timestamp?: string
}

/**
 * Prepared for Wire Network UTL (Universal Transaction Layer).
 * Focuses on verifiable execution states — deterministic cross-chain actions,
 * settlement certainty, and execution history rather than traditional reputation.
 */
export interface WireExecutionSignal {
  agentId: string
  crossChainActionsCount?: number
  successRate?: number
  lastVerifiedExecution?: string
  settlementCertainty?: number
  totalTransactions?: number
  verifiedExecutionHistory?: string[]
  metadata?: Record<string, any>
}

/**
 * Prepared for ERC-8257 (draft) — a permissionless on-chain registry where
 * agent tools are registered with a content-addressed URI and may be
 * access-gated by predicate contracts (e.g. NFT ownership or subscription).
 * Lets the curated tools list become on-chain discoverable + verifiable.
 */
export interface ToolRegistrySignal {
  /** Stable tool id (matches the curated `Tool.id` where applicable). */
  toolId: string
  /** Content-addressed location of the tool manifest (e.g. ipfs:// or https://). */
  uri?: string
  /** Hash of the manifest for integrity verification. */
  contentHash?: string
  /** Predicate contract address gating access (NFT/subscription/etc.). */
  gatePredicate?: string
  /** Whether this tool is registered on the ERC-8257 registry. */
  registered?: boolean
  /** Whether the connected agent currently satisfies the gate predicate. */
  accessGranted?: boolean
  registeredAt?: string
  metadata?: Record<string, any>
}

/** AgentCheck API response (from agentcheck-bice.vercel.app) */
export interface AgentCheckResult {
  wallet?: string
  network?: string
  /** S&P-style grade, e.g. "AAA", "BB", "C", "D" */
  rating?: string
  outlook?: string
  verdict?: string
  /** 0–100 */
  trust_score?: number
  /** 0–100 */
  risk_score?: number
  agent_score?: number
  composite?: number
  address_type?: {
    is_contract?: boolean
    is_eoa?: boolean
    known?: boolean
    label?: string
    category?: string
    verified?: boolean
  }
  report?: {
    highlights?: string[]
    risk_flags?: string[]
    [key: string]: any
  }
  checked_at?: string
  [key: string]: any // flexible for the full report payload
}
