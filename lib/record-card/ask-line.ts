// One-line record card summary for Zulo's Ask prompt. Pure: no network, built from the Pulse breakdown already loaded.
// Zulo cites the card link when someone evaluates or wants to buy a Normie; the line never claims an Arena record exists.

import { ARENA_CANVAS_RANKS_SOURCE, rankForLevel } from "@/lib/normies-canon"

import { isArenaOpen } from "./arena"
import { pulseGate } from "./build"

/** Public link to a Normie's record card. */
export function recordCardUrl(tokenId: number, origin: string): string {
  return `${origin.replace(/\/$/, "")}/record/${tokenId}`
}

/**
 * e.g. "Record card: https://…/record/1217 — Passes the trust gate: registered on-chain, clean ownership · Arena record: pending (Arena not open yet)".
 * `arenaStatus` is injectable for tests; it defaults to lib/official-status.ts. With the Normie's Level (official API), the
 * line also names its Arena Canvas rank: the rank name only, never the next rank or what it takes to reach one.
 */
export function recordCardLine(
  tokenId: number,
  breakdown: string[] | null | undefined,
  origin: string,
  arenaStatus?: string,
  level?: number | null,
): string {
  const gate = pulseGate(breakdown)
  const arena = isArenaOpen(arenaStatus)
    ? "Arena record: official data only, see the card"
    : "Arena record: pending (Arena not open yet)"
  const rank = rankForLevel(level)
  const canvasRank = rank && typeof level === "number"
    ? ` · Arena Canvas rank: ${rank.name} (from Level ${Math.floor(level)}, official API; rank names per normiesART's Arena article, ${ARENA_CANVAS_RANKS_SOURCE.publishedText}, ${ARENA_CANVAS_RANKS_SOURCE.url}; Arena is Coming Soon and game data may change; a label, not a score)`
    : ""
  return `Record card: ${recordCardUrl(tokenId, origin)} — ${gate.text} · ${arena}${canvasRank}`
}
