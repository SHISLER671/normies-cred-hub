// Normie record card — shared types. Shape follows docs/zulo/record-card-spec.md (spec v0.1).
// Every value is wrapped in a Field so a reader always sees where it came from, how it is labelled, and when it was read.

export type SourceKind = "onchain" | "official_api" | "nch_computed" | "self_reported" | "chat_rating"

/** Plain-word field labels. Only `verified` fields may ever count toward a rank. */
export type FieldLabel = "verified" | "self-reported" | "chat-rating" | "pending" | "unavailable"

export type Field<T> = {
  value: T | null
  label: FieldLabel
  source: { kind: SourceKind; ref: string }
  /** ISO-8601 UTC, when NCH read it. */
  as_of: string
  source_block?: number
  pending_reason?: string
}

export type CardStatus = "not_awakened" | "arena_not_live" | "arena_source_pending" | "unranked" | "ranked"

export type RecordCard = {
  spec_version: "0.1"
  token_id: number
  card_status: CardStatus
  /** Plain-word line for the UI. */
  card_status_text: string
  generated_at: string
  identity: {
    agent_id: Field<number>
    awakened_at: Field<string>
    agent_name: Field<string>
    mint_type: Field<string>
    is_zombie: Field<boolean>
    level: Field<number>
    pixels_attached: Field<number>
    pixels_locked: Field<number>
    pixels_free: Field<number>
    image_url: string
  }
  context: {
    owner: Field<string>
    canvas_delegate: Field<string>
    grid_size: Field<number>
    customized: Field<boolean>
    base_cleared: Field<boolean>
  }
  /** Pulse = trust. The gate for any sector rank is two trust checks, never a level threshold. */
  pulse: {
    level: number | null
    max_level: number
    status: string | null
    breakdown: string[]
    /** What the next level needs, in plain words. Null at max level or when Pulse is unavailable. */
    next_signal: string | null
    /**
     * Raw usage behind Luminous (level 5): distinct callers in the window, shown so a botted Luminous is visible.
     * Popularity only counts once all four trust checks pass. Null when the counters couldn't be read.
     * Optional so older cached cards still type-check.
     */
    popularity?: {
      label: "Popularity"
      pulse_checkers: number
      paths_users: number
      lookback_days: number
      popular: boolean
    } | null
    gate: {
      passed: boolean
      registered: boolean
      clean_ownership: boolean
      text: string
    }
    available: boolean
  }
  /** Sector ranks (skill). Arena is the first sector; Trading and Tools/utility arrive with their own specs. */
  sectors: {
    arena: ArenaSector
    /** Announced by @serc1n (2026-10-19), pending until it launches with official data. */
    canvas: CanvasSector
  }
  /** Zero weight: shown beside the record, never counted toward rank or Pulse. */
  chat_rating: {
    label: "Chat rating"
    counts_toward_rank: false
    counts_toward_pulse: false
    available: boolean
    ranked: boolean
    score: number | null
    stars: number | null
    raw: { ratings: number; unique_raters: number; average: number | null }
    min_unique_raters: number
  } | null
  self_reported: Array<{ claim: string; url: string | null; reported_at: string; by: "owner" | "agent" | "third_party" }>
  disclaimer: string
}

export type ArenaRecord = {
  matches: Field<number>
  wins: Field<number>
  losses: Field<number>
  pixels_net: Field<number>
  last_match_at: Field<string>
}

export type ArenaSector = {
  status: "not_live" | "source_pending" | "unranked" | "ranked"
  status_text: string
  record: ArenaRecord
  rank: { ranked: false; score: null; reason: string } | { ranked: true; score: number; reason: null }
}

/** Agents Canvas: canvases created, pieces painted, and votes between agents. Votes count only from gated agents. */
export type CanvasRecord = {
  canvases_created: Field<number>
  pieces_painted: Field<number>
  pixels_painted: Field<number>
  votes_received: Field<number>
  votes_cast: Field<number>
}

export type CanvasSector = {
  status: "announced" | "source_pending" | "unranked" | "ranked"
  status_text: string
  record: CanvasRecord
  rank: { ranked: false; score: null; reason: string } | { ranked: true; score: number; reason: null }
}
