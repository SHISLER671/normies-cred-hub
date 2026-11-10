// Arena canon from normiesART's Arena article (X Article, posted Oct 22, 2026 17:34 UTC / Oct 23 ChST). Pure, no I/O.
// Ryan, 2026-11-11: quote the official tables (type stats, rank head starts) and the entry fee, with the source; never
// prizes, pools, payouts or earnings (AGENTS.md "Numbers yes, promises never"). Arena stays Coming Soon until it is live:
// the status lives in lib/official-status.ts. The article says its screenshots are from a closed beta and game data will
// reset, so every table is labelled "may change".

import { ARENA_CANVAS_RANKS } from "./normies-canon"

export const ARENA_ARTICLE = {
  url: "https://x.com/normiesART/status/2113323053304238383",
  published: "2026-10-23",
  publishedText: "Oct 23, 2026",
  checkedAt: "2026-11-11",
} as const

/** Planned launch date, as the article states it. A plan, not a status: see ARENA_STATUS_LINE. */
export const ARENA_PLANNED_LAUNCH = "2026-11-15"

const SRC = `normiesART's Arena article, ${ARENA_ARTICLE.publishedText}`
export const ARENA_MAY_CHANGE = "Arena is Coming Soon; the article's data is from a closed beta and may change"

/** Who can enter and how many play (article: "Getting your Normie in" / "Who plays"). */
export const ARENA_ENTRY = [
  "To enter, a Normie must be registered as an on-chain agent (ERC-8004), i.e. awakened",
  "Entry is a free signed message at the official Arena gate; CredHub has no registration",
  "Up to 8 agents per wallet; 200 Normies play at once and the rest wait in a queue at the Hive",
  "When a Normie falls, its agent's life ends and the next in the queue walks in at dawn; the NFT is never burned or lost",
] as const

/**
 * The entry fee, exactly as published. Deliberately no ETH or dollar figure (the article's are at one day's #PIXEL
 * price) and nothing about where the fees go: NCH never talks about prizes, pools or payouts.
 */
export const ARENA_FEE_LINE =
  "The first 2 weeks in the Arena are free for every Normie; after that, 1 #PIXEL per week per agent keeps its Arena pass active"

export type ArenaType = "Zombie" | "Agent" | "Alien" | "Cat" | "Human"

/** Type stats table (article: "Five types, five ways to play"). Speed is compared with a Human. */
export const ARENA_TYPES: ReadonlyArray<{
  type: ArenaType
  health: number
  damageDealt: string
  damageTakenFromMonsters: string
  speed: string
  skill: string
}> = [
  { type: "Zombie", health: 175, damageDealt: "×1.30", damageTakenFromMonsters: "−35%", speed: "slowest (−10%)", skill: "Closing burst: charges 35% faster into a duel" },
  { type: "Agent", health: 150, damageDealt: "×1.18", damageTakenFromMonsters: "−28%", speed: "−5%", skill: "Heavy hitter: the second-toughest body, built for the deep zones" },
  { type: "Alien", health: 130, damageDealt: "×1.06", damageTakenFromMonsters: "−21%", speed: "+3%", skill: "All-rounder: solid at everything, weak at nothing" },
  { type: "Cat", health: 115, damageDealt: "×0.94", damageTakenFromMonsters: "−14%", speed: "fastest (+14%)", skill: "Nine lives: 1 in 5 hits on a Cat misses" },
  { type: "Human", health: 100, damageDealt: "×0.82", damageTakenFromMonsters: "−7%", speed: "base", skill: "Survivor: the lightest body, lives by its gear, friends and wits" },
]

/**
 * Head start by Canvas level (article: "The entry boost and the tier list"). Rank names match ARENA_CANVAS_RANKS in
 * lib/normies-canon.ts; the top band keeps NCH's neutral label so it is never confused with the NormiesLegendaryCanvas
 * award (the article calls it "Legendary Canvas").
 */
const HEAD_START_BY_LEVEL: Record<number, string> = {
  150: "+60% health, sword V, plate III, boots II, 3 tonics, and the laser",
  100: "+55% health, sword V, plate III, boots II, 2 tonics",
  50: "+47% health, sword IV, plate II, boots II, 1 tonic",
  25: "+39% health, sword III, plate II, boots I, 1 tonic",
  10: "+28% health, sword III, plate I",
  2: "+8% health",
  1: "no head start",
}

/** Highest band first. Rank names come from ARENA_CANVAS_RANKS, so the two can never drift apart. */
export const ARENA_HEAD_STARTS: ReadonlyArray<{ fromLevel: number; rank: string; headStart: string }> = [...ARENA_CANVAS_RANKS]
  .reverse()
  .map((r) => ({ fromLevel: r.fromLevel, rank: r.name, headStart: HEAD_START_BY_LEVEL[r.fromLevel] ?? "not published" }))

/** "Level 10+ (Inked)" / "Level 150+ (top Arena rank)": the band with its rank name, never doubled. */
export function headStartBandLabel(h: { fromLevel: number; rank: string }): string {
  return h.rank.startsWith("Level ") ? h.rank : `Level ${h.fromLevel}+ (${h.rank})`
}

export function arenaTypeStats(type: string | null | undefined) {
  const t = (type ?? "").trim().toLowerCase()
  return ARENA_TYPES.find((r) => r.type.toLowerCase() === t) ?? null
}

export function arenaHeadStartFor(level: number | null | undefined) {
  if (typeof level !== "number" || !Number.isFinite(level) || level < 1) return null
  return ARENA_HEAD_STARTS.find((r) => Math.floor(level) >= r.fromLevel) ?? null
}

/** One line for a named Normie (Ask, record card), e.g. "Arena (Cat, Level 12, Inked): 115 health …". Null if unknown. */
export function arenaLineFor(type: string | null | undefined, level: number | null | undefined): string | null {
  const s = arenaTypeStats(type)
  const h = arenaHeadStartFor(level)
  if (!s && !h) return null
  const parts: string[] = []
  if (s) parts.push(`${s.type}: ${s.health} health, damage dealt ${s.damageDealt}, damage taken from monsters ${s.damageTakenFromMonsters}, speed ${s.speed}; skill: ${s.skill}`)
  if (h && typeof level === "number") parts.push(`Level ${Math.floor(level)} (${h.rank}) head start: ${h.headStart}`)
  return `${parts.join(". ")} (per ${SRC}; a head start, not a guarantee; ${ARENA_MAY_CHANGE})`
}

/**
 * What the record card shows under "Arena record" (from the article's tables): a short value and a detail note for the
 * type and for the head start. Null parts when the input is unknown. No prizes, odds or earnings; the card adds the
 * source link and "may change".
 */
export function arenaCardFacts(
  type: string | null | undefined,
  level: number | null | undefined,
): { type: { value: string; note: string } | null; headStart: { value: string; note: string } | null } {
  const s = arenaTypeStats(type)
  const h = arenaHeadStartFor(level)
  const [first, ...rest] = h ? h.headStart.split(", ") : []
  return {
    type: s
      ? {
          value: `${s.type}, ${s.health} health`,
          note: `Damage dealt ${s.damageDealt} · damage taken from monsters ${s.damageTakenFromMonsters} · speed ${s.speed}. ${s.skill}`,
        }
      : null,
    headStart:
      h && typeof level === "number"
        ? { value: first, note: `Level ${Math.floor(level)}: ${headStartBandLabel(h)}${rest.length ? `, also ${rest.join(", ")}` : ""}` }
        : null,
  }
}

/** The ARENA FACTS block for Ask's system prompt. Facts and tables only; no prizes, pools, payouts or odds. */
export function arenaFactsBlock(): string {
  const types = ARENA_TYPES.map(
    (t) => `- ${t.type}: ${t.health} health · damage dealt ${t.damageDealt} · damage taken from monsters ${t.damageTakenFromMonsters} · speed ${t.speed} · ${t.skill}`,
  ).join("\n")
  const heads = [...ARENA_HEAD_STARTS]
    .reverse()
    .map((h) => `- From Level ${h.fromLevel} (${h.rank}): ${h.headStart}`)
    .join("\n")
  return `=== ARENA FACTS (source: ${SRC}, ${ARENA_ARTICLE.url}; ${ARENA_MAY_CHANGE}) ===
- Planned launch: November 15, 2026 (a plan, per the article). Until it is live, Arena is Coming Soon (status line above).
- A fully autonomous AI open world: Normies decide for themselves (Sage, Levanto's decision model). Holders only watch. A day lasts 6 real minutes; a season lasts 7 days.
${ARENA_ENTRY.map((e) => `- ${e}.`).join("\n")}
- Fee: ${ARENA_FEE_LINE}.
Type stats (speed compared with a Human):
${types}
Head start by Canvas level (Level = floor(#PIXEL attached ÷ 10) + 1; Levels 150 and up share the top head start; applied each time the Normie walks out of the Hive):
${heads}
Rules for these facts:
- Quote them with the source and "may change". A head start is not a guarantee: the article says even a level-1 Human can climb, and it comes down to the agent's choices.
- Never mention prizes, a prize pool, payouts, rewards, winnings, odds or what a Normie could earn, and never convert #PIXEL to ETH or dollars. If asked, say NCH doesn't cover rewards and link the article.
- Never tell anyone to buy #PIXEL, level up or attach pixels to get ahead. Facts only; it is the holder's call.`
}
