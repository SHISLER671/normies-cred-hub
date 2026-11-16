// Normie record card — shared types. Shape follows docs/zulo/record-card-spec.md (spec v0.1).
// Every value is wrapped in a Field so a reader always sees where it came from, how it is labelled, and when it was read.

import type { AgentCardCheck } from "@/lib/agent-card"
import type { OwnershipCheck } from "@/lib/ownership-check"

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
    /** What it was minted as: Human, Cat, Alien or Agent (/agents/identity, or /traits). A Zombie keeps its mint type here. */
    mint_type: Field<string>
    /** What it is now, from the official /metadata (e.g. "Zombie" for #2, minted Human). Optional so older cached cards type-check. */
    type?: Field<string>
    is_zombie: Field<boolean>
    level: Field<number>
    pixels_attached: Field<number>
    pixels_locked: Field<number>
    pixels_free: Field<number>
    /**
     * Arena Canvas rank: a name for the Level band, per the official Arena entry page (lib/normies-canon.ts). A label, never a
     * score: `counts_toward_rank` is always false. Optional so older cached cards type-check.
     */
    arena_canvas_rank?: ArenaCanvasRankField
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
    /** The trust checks still missing, in plain words. Null when all four pass or when Pulse is unavailable. */
    next_signal: string | null
    /**
     * Raw usage behind the "Trending on NCH" badge: distinct callers in the window, shown so a botted spike is visible.
     * Popularity is separate from trust and never changes the level. Null when the counters couldn't be read.
     * Optional so older cached cards still type-check.
     */
    popularity?: {
      label: "Popularity"
      pulse_checkers: number
      paths_users: number
      lookback_days: number
      popular: boolean
    } | null
    /** "Trending on NCH": the popularity threshold is met. False when the counters couldn't be read. Never changes `level`. Optional so older cached cards still type-check. */
    trending?: boolean
    /**
     * Why "Has active agent card" passed or didn't (lib/agent-card.ts): the card was read, with its sha256. It means the card
     * is published and names this agent, not that the agent is online. Null when the Pulse is unavailable. Optional so
     * older cached cards still type-check.
     */
    agent_card?: AgentCardCheck | null
    gate: {
      passed: boolean
      registered: boolean
      clean_ownership: boolean
      text: string
    }
    /**
     * Why "Clean ownership & delegation" passed or didn't (lib/ownership-check.ts), with the same check in plain words.
     * A leftover delegate from a previous owner is listed but doesn't fail the check on its own. Null when the Pulse is
     * unavailable. Optional so older cached cards still type-check.
     */
    ownership_check?: (OwnershipCheck & { lines: string[] }) | null
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

export type ArenaCanvasRankField = Field<string> & {
  counts_toward_rank: false
  /** The Normie's Level the rank was read from (official API), or null when Level is unavailable. */
  from_level: number | null
  source_url: string
  source_published: string
  note: string | null
}

export type ArenaRecord = {
  /** Arena rounds played (the official API's `roundsPlayed`). */
  matches: Field<number>
  wins: Field<number>
  losses: Field<number>
  pixels_net: Field<number>
  last_match_at: Field<string>
}

/** Whether the Normie is registered or entered in Arena. Being registered is not a record. The official data no longer gives a line or position. */
export type ArenaEntry = {
  entered: Field<boolean>
  in_line: Field<boolean>
  /** Place in the line. Pending when not in line or when the official data gives none. */
  line_position: Field<number>
}

export type ArenaSector = {
  /**
   * not_live: Arena's official status isn't LIVE. source_pending: the official data couldn't be read. not_entered: never
   * opted in. entered: registered or in the current round, no round played yet (no record). unranked: has played,
   * below the ranking minimum.
   */
  status: "not_live" | "source_pending" | "not_entered" | "entered" | "unranked" | "ranked"
  status_text: string
  /** Optional so older cached cards still type-check. */
  entry?: ArenaEntry
  record: ArenaRecord
  rank: { ranked: false; score: null; reason: string } | { ranked: true; score: number; reason: null }
  /** Official watch link (arena.normies.art/world/pixel?follow=<id>, per the official Arena guide), once a Normie is entered. */
  watch_url?: string
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
