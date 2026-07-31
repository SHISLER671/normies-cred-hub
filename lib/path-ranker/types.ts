// Path Board ranking types — intent → short ranked agent/tool paths.

export type IntentTag =
  | "pulse"
  | "burn"
  | "market"
  | "canvas"
  | "identity"
  | "access"
  | "strategy"

export type PathKind =
  | "zulo-skill"
  | "erc8257-tool"
  | "normies-tool"
  | "community-tool"

export type AccessStatus = "open" | "granted" | "gated" | "unknown" | "n/a"

export type PathScore = {
  total: number
  pulse: number
  access: number
  relevance: number
}

export type PathPublisher = {
  name: string
  agentId?: number
  tokenId?: number
}

export type PathNextStep = {
  label: string
  href?: string
  method?: "GET" | "POST" | "link"
  endpoint?: string
}

export type RankedPath = {
  rank: number
  pathId: string
  kind: PathKind
  title: string
  publisher: PathPublisher
  pulse: {
    level: number | null
    status: string | null
    badge: string
  }
  access: {
    status: AccessStatus
    note: string
  }
  score: PathScore
  rationale: string
  nextStep: PathNextStep
  intentTags: IntentTag[]
}

/** Internal candidate before final scoring / slice. */
export type PathCandidate = {
  pathId: string
  kind: PathKind
  title: string
  description?: string
  publisher: PathPublisher
  /** Tags used for intent relevance matching */
  tags: IntentTag[]
  /** Free-text keywords for soft relevance */
  keywords: string[]
  access: {
    status: AccessStatus
    note: string
  }
  nextStep: PathNextStep
  /**
   * Affinity to pulse gaps / level from existing scorers (0–100-ish).
   * Higher = better fit for current pulse state.
   */
  pulseAffinity: number
  /** Skill id when kind is zulo-skill */
  skillId?: string
  category?: string
}

export type RankPathsInput = {
  intent?: string
  intentTag?: IntentTag
  tokenId?: number
  wallet?: string
  limit?: number
}

export type ParsedIntent = {
  raw: string
  tags: IntentTag[]
  /** Chip id if user picked one, else primary tag */
  primary: IntentTag
}

export type RankPathsSubject = {
  tokenId: number | null
  pulse_level: number | null
  status: string | null
  gaps: string[]
  /** Present signals from CredHub Pulse breakdown (for context rebuild). */
  breakdown?: string[]
  canvasLevel?: number | null
  actionPoints?: number | null
  isAwakened?: boolean
}

export type RankPathsResult = {
  ok: true
  intent: ParsedIntent
  subject: RankPathsSubject
  paths: RankedPath[]
  zulo: {
    role: "path-finder"
    note: string
  }
  payments: { status: "planned" }
  asOf: string
}

export type RankPathsError = {
  ok: false
  error: string
}

export type ScoreWeights = {
  pulse: number
  access: number
  relevance: number
}

/** Default weights: Pulse primary, then access, then relevance. */
export const DEFAULT_SCORE_WEIGHTS: ScoreWeights = {
  pulse: 0.45,
  access: 0.3,
  relevance: 0.25,
}

export const MAX_PATHS = 5
export const MIN_PATHS = 3
export const MAX_INTENT_CHARS = 200
