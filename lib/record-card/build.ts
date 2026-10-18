// Normie record card — pure assembler (no network). Takes what the loader read and returns the card.
// Every rule that decides a label lives here so it can be tested without the API.

import type { ChatRatingsSummary } from "@/lib/chat-ratings/load"
import { pendingCanvasSector } from "./canvas"
import type { ArenaSector, CanvasSector, CardStatus, Field, RecordCard, SourceKind } from "./types"

/** The two Pulse checks that make up the trust gate (Ryan, 2026-10-18). Strings match lib/api/agent-pulse.ts. */
export const GATE_REGISTERED = "ERC-8004 registered"
export const GATE_CLEAN_OWNERSHIP = "Clean ownership & delegation"

const ZERO = "0x0000000000000000000000000000000000000000"

export type RecordCardInputs = {
  tokenId: number
  now: string
  binding: { agentId?: string | number | null; timestamp?: string | number | null; blockNumber?: string | number | null } | null
  identity: { name?: string | null; type?: string | null } | null
  canvas: {
    level?: number | null
    actionPoints?: number | null
    lockedPixels?: number | null
    freePixels?: number | null
    delegate?: string | null
    gridSize?: number | null
    customized?: boolean | null
    baseCleared?: boolean | null
  } | null
  owner: { owner?: string | null } | null
  zombie: { info?: { isZombie?: boolean | null } | null } | null
  pulse: { pulse_level: number; max_level: number; status: string; breakdown: string[]; next_signal?: string | null } | null
  chatRatings: ChatRatingsSummary | null | undefined
  arena: ArenaSector
  /** Agents Canvas sector. Defaults to pending (no official source yet). */
  canvasSector?: CanvasSector
}

const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : Number.NaN
  return Number.isFinite(n) ? n : null
}

function field<T>(value: T | null | undefined, kind: SourceKind, ref: string, asOf: string, block?: number | null): Field<T> {
  const ok = value !== null && value !== undefined
  return {
    value: ok ? (value as T) : null,
    label: ok ? "verified" : "unavailable",
    source: { kind, ref },
    as_of: asOf,
    ...(block != null && Number.isFinite(block) ? { source_block: block } : {}),
  }
}

export function pulseGate(breakdown: string[] | null | undefined) {
  const b = breakdown ?? []
  const registered = b.includes(GATE_REGISTERED)
  const clean_ownership = b.includes(GATE_CLEAN_OWNERSHIP)
  const passed = registered && clean_ownership
  const missing = [!registered && "registered on-chain", !clean_ownership && "clean ownership"].filter(Boolean)
  return {
    passed,
    registered,
    clean_ownership,
    text: passed ? "Passes the trust gate: registered on-chain, clean ownership" : `Not yet past the trust gate: needs ${missing.join(" and ")}`,
  }
}

export function buildRecordCard(i: RecordCardInputs): RecordCard {
  const t = i.tokenId
  const at = i.now
  const agentId = num(i.binding?.agentId)
  const awakened = agentId !== null && agentId > 0
  const tsSec = num(i.binding?.timestamp)
  const block = num(i.binding?.blockNumber)
  const delegate = i.canvas?.delegate && i.canvas.delegate.toLowerCase() !== ZERO ? i.canvas.delegate : null

  const gate = pulseGate(i.pulse?.breakdown)

  let card_status: CardStatus
  let card_status_text: string
  if (!awakened) {
    card_status = "not_awakened"
    card_status_text = "Not an awakened agent, so no record card yet"
  } else if (i.arena.status === "not_live") {
    card_status = "arena_not_live"
    card_status_text = "Arena isn't live yet, so there's no record. Identity and trust are live below."
  } else if (i.arena.status === "source_pending") {
    card_status = "arena_source_pending"
    card_status_text = i.arena.status_text
  } else {
    card_status = i.arena.rank.ranked ? "ranked" : "unranked"
    card_status_text = i.arena.status_text
  }

  const cr = i.chatRatings
  return {
    spec_version: "0.1",
    token_id: t,
    card_status,
    card_status_text,
    generated_at: at,
    identity: {
      agent_id: field(awakened ? agentId : null, "official_api", `GET /agents/binding/${t}`, at, block),
      awakened_at: field(tsSec !== null && awakened ? new Date(tsSec * 1000).toISOString() : null, "official_api", `GET /agents/binding/${t}`, at, block),
      agent_name: field(i.identity?.name || null, "official_api", `GET /agents/identity/${t}`, at),
      mint_type: field(i.identity?.type || null, "official_api", `GET /agents/identity/${t}`, at),
      is_zombie: field(typeof i.zombie?.info?.isZombie === "boolean" ? i.zombie.info.isZombie : null, "official_api", `GET /normie/${t}/zombie`, at),
      level: field(num(i.canvas?.level), "official_api", `GET /normie/${t}/canvas/info`, at),
      pixels_attached: field(num(i.canvas?.actionPoints), "official_api", `GET /normie/${t}/canvas/info`, at),
      pixels_locked: field(num(i.canvas?.lockedPixels), "official_api", `GET /normie/${t}/canvas/info`, at),
      pixels_free: field(num(i.canvas?.freePixels), "official_api", `GET /normie/${t}/canvas/info`, at),
      image_url: `https://api.normies.art/normie/${t}/image.svg`,
    },
    context: {
      owner: field(i.owner?.owner || null, "official_api", `GET /normie/${t}/owner`, at),
      canvas_delegate: i.canvas
        ? { value: delegate, label: "verified", source: { kind: "official_api", ref: `GET /normie/${t}/canvas/info` }, as_of: at }
        : field<string>(null, "official_api", `GET /normie/${t}/canvas/info`, at),
      grid_size: field(num(i.canvas?.gridSize), "official_api", `GET /normie/${t}/canvas/info`, at),
      customized: field(typeof i.canvas?.customized === "boolean" ? i.canvas.customized : null, "official_api", `GET /normie/${t}/canvas/info`, at),
      base_cleared: field(typeof i.canvas?.baseCleared === "boolean" ? i.canvas.baseCleared : null, "official_api", `GET /normie/${t}/canvas/info`, at),
    },
    pulse: {
      level: i.pulse ? i.pulse.pulse_level : null,
      max_level: i.pulse?.max_level ?? 5,
      status: i.pulse?.status ?? null,
      breakdown: i.pulse?.breakdown ?? [],
      next_signal: i.pulse?.next_signal ?? null,
      gate,
      available: !!i.pulse,
    },
    sectors: { arena: i.arena, canvas: i.canvasSector ?? pendingCanvasSector(at) },
    chat_rating: cr
      ? {
          label: "Chat rating",
          counts_toward_rank: false,
          counts_toward_pulse: false,
          available: cr.available,
          ranked: cr.ranked,
          score: cr.score,
          stars: cr.stars,
          raw: cr.raw,
          min_unique_raters: cr.min_unique_raters,
        }
      : null,
    self_reported: [],
    disclaimer: "Track record, not a tip. Read-only. DYOR.",
  }
}
