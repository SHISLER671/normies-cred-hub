// Ask Zulo reads the Arena for Normies named in a question (Claude, 2026-11-17). Read-only.
//
// The facts come from the record card's own cached reader (loadArenaSector in lib/record-card/arena.ts), so Ask makes
// exactly the Arena calls a record card makes and no others. Rules:
//   - At most ASK_ARENA_MAX_NORMIES named Normies get Arena facts per question. The rest get none; Zulo points to their
//     record cards.
//   - Reads run in parallel, each with a time limit (ASK_ARENA_READ_TIMEOUT_MS, the same limit as Ask's other context
//     reads, so the context build is never slower for it). A read that runs out of time, throws or comes back
//     unreadable is "couldn't read right now". It is never shown as missing data, zero or "not entered".
//   - Facts only, each with its source and as-of time: entry state, the card's status line (copied), rounds played,
//     wins (marked "round in progress" when that applies) and the round list. No per-round win.
//   - No amounts: the Arena sector carries none, and nothing here adds any.
//   - Every string in the block is written by NCH from numbers and fixed official states. No outside text (names,
//     traits) is in it, so OUTSIDE_TEXT_RULE has nothing to quote here.

import { ARENA_ROUNDS_SOURCE_LABEL } from "../record-card/arena-rounds"
import { recordCardUrl } from "../record-card/ask-line"
import type { ArenaSector } from "../record-card/types"

/** Most Normies named in one question that get Arena facts. */
export const ASK_ARENA_MAX_NORMIES = 2
/** Time limit for one Normie's Arena read inside Ask's context build. */
export const ASK_ARENA_READ_TIMEOUT_MS = 8_000
/** Most rounds listed per Normie in the prompt (newest first). The rest are on the record card. */
export const ASK_ARENA_MAX_ROUNDS = 10

export const ASK_ARENA_COULD_NOT_READ = "I couldn't read the Arena right now"

/** One named Normie's Arena read. `sector: null` = couldn't read right now (time ran out or the read threw). */
export type AskArenaRead = { tokenId: number; asOf: string; sector: ArenaSector | null }

/** The named Normies that get Arena facts: the first ASK_ARENA_MAX_NORMIES, in the order named, no repeats. */
export function askArenaTokenIds(mentioned: readonly number[]): number[] {
  return [...new Set(mentioned.filter((id) => Number.isInteger(id) && id >= 0 && id <= 9999))].slice(0, ASK_ARENA_MAX_NORMIES)
}

export type AskArenaDeps = {
  load: (tokenId: number, asOf: string) => Promise<ArenaSector>
  timeoutMs?: number
  now?: () => Date
}

/** Read the Arena sector for the first named Normies, in parallel. Never throws and never waits past the time limit. */
export async function loadAskArenaReads(mentioned: readonly number[], deps: AskArenaDeps): Promise<AskArenaRead[]> {
  const asOf = (deps.now ?? (() => new Date()))().toISOString()
  const limit = deps.timeoutMs ?? ASK_ARENA_READ_TIMEOUT_MS
  return Promise.all(
    askArenaTokenIds(mentioned).map(async (tokenId): Promise<AskArenaRead> => {
      let timer: ReturnType<typeof setTimeout> | undefined
      const timeout = new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), limit)
      })
      try {
        const sector = await Promise.race([deps.load(tokenId, asOf).catch(() => null), timeout])
        return { tokenId, asOf, sector }
      } finally {
        clearTimeout(timer)
      }
    }),
  )
}

/** The sector says its official read failed (lib/record-card/arena.ts: "Arena source unavailable"). */
function sectorCouldNotRead(sector: ArenaSector): boolean {
  return sector.status === "source_pending" && sector.rank.reason === "Arena source unavailable"
}

const couldNotReadLine = (tokenId: number, origin: string) =>
  `- #${tokenId}: COULD NOT READ the Arena right now. Say "${ASK_ARENA_COULD_NOT_READ}" for #${tokenId}. This is not "not entered", not zero and not missing data: state no Arena fact for it. Record card: ${recordCardUrl(tokenId, origin)}`

/** One Normie's Arena facts as prompt lines. */
export function askArenaLines(read: AskArenaRead, origin: string): string {
  const { tokenId, sector, asOf } = read
  if (!sector || sectorCouldNotRead(sector)) return couldNotReadLine(tokenId, origin)
  const card = recordCardUrl(tokenId, origin)
  const head = `- #${tokenId} (source: ${ARENA_ROUNDS_SOURCE_LABEL}, as of ${asOf}; record card ${card})`
  const lines = [head, `  status line (copy exactly): "${sector.status_text}"`]
  if (sector.status === "not_live" || sector.status === "source_pending") return lines.join("\n")

  const entry = sector.entry
  if (entry?.entered.value !== null && entry?.entered.value !== undefined) {
    lines.push(`  in Arena: ${entry.entered.value ? "Entered" : "Not entered"}${entry.state?.value ? ` · Arena state: ${entry.state.value}` : ""}`)
  }
  if (sector.status === "not_entered") return lines.join("\n")

  const { matches, wins } = sector.record
  if (matches.value !== null) {
    const winsText =
      wins.value === null ? "wins: not given" : `wins: ${wins.value}${wins.label === "round in progress" ? " (round in progress: this count can still change)" : ""}`
    lines.push(`  rounds played: ${matches.value} · ${winsText} (${matches.source.ref.split(" → ")[0]})`)
  } else {
    lines.push("  rounds played: none yet, so there is no record")
  }

  const h = sector.round_history
  if (h) {
    if (h.status === "unavailable") {
      lines.push(`  round list: COULD NOT READ right now (${h.source.ref}). Say you couldn't read its round list right now; do not say it has no rounds.`)
    } else if (h.status === "ok" && h.totals) {
      const t = h.totals
      const shown = h.rounds.slice(0, ASK_ARENA_MAX_ROUNDS)
      lines.push(`  round list, newest first (${h.source.ref}):`)
      for (const r of shown) lines.push(`    Round ${r.round}${r.date ? ` · ${r.date.slice(0, 10)}` : ""} · ${r.text}`)
      const more = h.rounds.length - shown.length
      if (more > 0) lines.push(`    (${more} more on the record card)`)
      if (h.complete === false) lines.push("    (the official data lists more rounds than NCH reads)")
      lines.push(
        `  raw counts: ${t.listed} listed · ${t.in_progress} in progress · ${t.played + t.did_not_play} finished (${t.played} played, ${t.did_not_play} did not play)` +
          `${t.cancelled ? ` · ${t.cancelled} cancelled` : ""}${t.not_started ? ` · ${t.not_started} not started` : ""}${t.unreadable ? ` · ${t.unreadable} couldn't be read` : ""}`,
      )
    } else {
      lines.push(`  round list: ${h.status_text} (${h.source.ref})`)
    }
  }
  return lines.join("\n")
}

export const ASK_ARENA_BLOCK_TITLE = "ARENA DATA FOR NAMED NORMIES (official Arena data, read this turn — facts only)"

/**
 * The prompt block for this turn, or "" when no named Normie was read. `mentioned` is every Normie named, so the block
 * can say which ones got no Arena read.
 */
export function askArenaBlock(reads: readonly AskArenaRead[], mentioned: readonly number[], origin: string): string {
  if (reads.length === 0) return ""
  const read = new Set(reads.map((r) => r.tokenId))
  const skipped = [...new Set(mentioned)].filter((id) => !read.has(id))
  const rules = [
    "Rules for this block:",
    "- State these facts as given, each with its source (Official Arena data, api.normies.art) and the as-of time. Copy the status line; do not reword it.",
    "- A round in progress has no result yet. Never call it a win or a loss, and never say how a round will end.",
    "- There is no per-round result here. Total wins is the only win figure; never work out which round was won.",
    "- Facts only: no forecast, no advice on how a Normie should play, no burn, keep or buy call, no ranking of one Normie over another, and no amounts of any kind.",
    `- Where a line says COULD NOT READ, say "${ASK_ARENA_COULD_NOT_READ}" and nothing else about that Normie's Arena.`,
    "- Never describe Arena results, wins or rankings that are not in this block or on the record card.",
  ]
  if (skipped.length > 0) {
    rules.push(
      `- No Arena read this turn for ${skipped.map((id) => `#${id}`).join(", ")} (Arena facts are read for the first ${ASK_ARENA_MAX_NORMIES} Normies named). State no Arena fact for them; point to their record cards: ${skipped.map((id) => recordCardUrl(id, origin)).join(" , ")}`,
    )
  }
  return [...reads.map((r) => askArenaLines(r, origin)), ...rules].join("\n")
}
