// Arena canon. Seats, rest, who plays, the Hive's Normies, decisions, death, the ranking rule, type health and power,
// and the Canvas level formula and gear levels come from the official Arena guide (https://arena.normies.art/world/guide,
// checked 2026-11-17). The fee, the schedule, opt-in timing and the full Canvas head-start table come from the official
// Arena entry page (https://arena.normies.art/world/enter). Type damage, speed figures and skills still come from
// normiesART's Arena article (X Article, posted Oct 22, 2026 17:34 UTC / Oct 23 ChST). Pure, no I/O.
//
// The canon tables below hold no prizes, pools, payouts, winnings, rewards or earnings. Money follows AGENTS.md
// "Numbers yes, advice never": see ARENA_MONEY_RULE.
// Arena's status (LIVE) lives in lib/official-status.ts, never here. Every table is
// labelled "may change". The official page's top Canvas band is shown with NCH's neutral label so it is
// never confused with the NormiesLegendaryCanvas award.

import { ARENA_CANVAS_RANKS, rankForLevel } from "./normies-canon"
import { ARENA_ENTER_SOURCE, ARENA_SITE } from "./official-status"

export { ARENA_ENTER_SOURCE }

/** The official Arena game guide. Checked 2026-11-17. */
export const ARENA_GUIDE_SOURCE = "https://arena.normies.art/world/guide"
export const ARENA_GUIDE_CHECKED = "2026-11-17"

export const ARENA_ARTICLE = {
  url: "https://x.com/normiesART/status/2113323053304238383",
  published: "2026-10-23",
  publishedText: "Oct 23, 2026",
  checkedAt: "2026-11-11",
} as const

/** Game 1's start day, as planned in normiesART's Nov 11 post (ARENA_LAUNCH_SOURCE). The status is ARENA_STATUS_LINE. */
export const ARENA_PLANNED_LAUNCH = "2026-11-16"

const TYPE_SRC = `normiesART's Arena article, ${ARENA_ARTICLE.publishedText}`
const ENTER_SRC = "the official Arena entry page"
const GUIDE_SRC = "the official Arena guide"

export const ARENA_MAY_CHANGE = "Figures are per the official entry page and may change"

/**
 * Each game runs Monday 20:00 CET to Saturday 20:00 CET. Game 1 start, with the Guam clock beside it.
 * This is the clock time from the official entry page; the status itself is in official-status.
 */
export const ARENA_GAME_WINDOW = "Monday 20:00 CET to Saturday 20:00 CET"
export const ARENA_GAME_START_CHST = "Mon Nov 16, 20:00 CET (Tue Nov 17, 5 AM ChST)"
export const ARENA_GAME_WINDOW_LINE = `Each game runs ${ARENA_GAME_WINDOW}. Game 1 started ${ARENA_GAME_START_CHST}`

/**
 * Who plays and how a week works: the official Arena guide for seats, rest, who plays, the Hive's Normies and steering;
 * the official entry page for opt-in timing and paid weeks. Indexes 3 and 4 are read by lib/burn-buy/narrate.ts.
 */
export const ARENA_ENTRY = [
  "To enter, a Normie must be registered as an on-chain agent (ERC-8004), i.e. awakened",
  "Entry is at the official Arena site (arena.normies.art); CredHub has no opt-in and cannot enter anyone",
  "Every registered Normie plays a free round; in a paid round, every Normie whose Arena balance covers the entry plays; up to 8 per wallet",
  "200 Normies are on the map at once; the game opens with a random draw of 200",
  "When one falls, a Normie that hasn't walked in yet takes its seat first",
  "A fallen Normie rests 15 minutes at the Hive and keeps its PX, then goes back into the draw and walks in again at random when a seat frees up and nobody new is waiting; the NFT never leaves your wallet",
  "The Hive's own Normies fill empty space on the map; a round player always gets a seat before them",
  "If a paid week never walks in, it comes back",
  "Opt in any time before Monday 20:00 CET; during a game, it's for next week",
  "Nobody steers a Normie; each one decides for itself",
] as const

/**
 * The entry fee, as published on the official entry page. Deliberately no ETH or dollar figure
 * and nothing about where the fees go: NCH never talks about prizes, pools or payouts.
 */
export const ARENA_FEE_LINE =
  "The first 2 weeks in the Arena are free for every Normie; after that, a week of play costs 1 #PIXEL per Normie, however often it falls"

export const ARENA_GEAR_LINE = "Gear unlocks at milestones (Sword, Armour, Boots, Tonics)"

/**
 * Short facts from the official Arena guide (ARENA_GUIDE_SOURCE), each "may change". Canvas level sets a starting head
 * start; it is never an Arena record. No prizes, pools or payouts are copied from the guide.
 */
export const ARENA_GUIDE = [
  "Canvas level = #PIXEL attached ÷ 10 + 1; it sets a Normie's starting health and gear, and it is not an Arena record",
  "Gear by Canvas level: swords at 3, 10, 35 and 100; armour at 5, 25 and 75; boots at 15 and 50; tonics at 20, 60 and 120; only the level-150 top band starts with the laser",
  "Types are a hard power ladder: Zombie > Agent > Alien > Cat > Human (health 175 / 150 / 130 / 115 / 100)",
  "Death: the next life starts back at the Hive with its Canvas head start and an empty purse, keeping its story, reputation, friends and grudges, lessons and lifetime PX",
  "The round's ranking counts the PX a Normie earned this round; spending, losing a duel or dying never lowers it",
  "Decisions: a Normie asks the Levanto Sage what to do next; its own agent playbook reads its persona and on-chain history; the game's own formula is only the last resort",
  "Watch a Normie live: arena.normies.art/world/pixel?follow=<id>",
] as const

/** The official API docs (Arena section), read 2026-11-17. */
export const ARENA_API_DOCS_SOURCE = "https://api.normies.art/llms.txt"

/** Facts from the official API docs' Arena section. No pools, prizes or amounts are copied. */
export const ARENA_API_FACTS = [
  "A Normie's Arena state is one of: not registered; active (plays every free round, and paid rounds while topped up); short (sat out a paid round; plays free rounds until topped up); cleared (burned and out of the game)",
  "A Normie registered while a round is open plays from the next round; a round's players are fixed when it starts",
  "A round is upcoming, open, ended or cancelled",
  "Scores inside a round (PX and standing) are kept by the Arena app, not the official API, so NCH can't show them; the watch link shows the Normie live",
] as const

/** Watch link for one Normie (official Arena guide format). */
export function arenaWatchUrl(tokenId: number): string {
  return `${ARENA_SITE}/world/pixel?follow=${tokenId}`
}

/** A Normie's life page on the official Arena site (story, standing, friends and grudges). */
export function arenaProfileUrl(tokenId: number): string {
  return `${ARENA_SITE}/world/normie/${tokenId}`
}

/**
 * A Normie's Arena skin image, as the official Arena site's own profile page loads it (an Arena app route, not in the
 * official API docs). Shown only for a Normie the official API says has a skin; the viewer's browser loads it.
 */
export function arenaSkinImageUrl(tokenId: number): string {
  return `${ARENA_SITE}/api/world/skin/png?id=${tokenId}`
}

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

/** Format a #PIXEL attached count the way the official table does (1,190 / 1,490). */
export function pixelsAttachedText(n: number): string {
  return n.toLocaleString("en-US")
}

export type ArenaHeadStartRow = {
  /** Published milestone Level on the official table. */
  fromLevel: number
  /** Canvas rank name at that Level; Level 150 uses NCH's neutral top-band label. */
  rank: string
  pixelsAttached: number
  /** Official health column: "base" or a published bonus such as "+28%". */
  health: string
  /** Extra published at this row, if any (only the Laser at the top band). */
  extra?: "Laser"
  /** One-line head start, e.g. "+28% health" or "+60% health plus Laser". */
  headStart: string
}

function headStartText(health: string, extra?: "Laser"): string {
  if (health === "base") return "base"
  return extra ? `${health} health plus ${extra}` : `${health} health`
}

const RANK_AT = (level: number): string => {
  if (level >= 150) return "Level 150+ (top Arena rank)"
  return rankForLevel(level)?.name ?? "Blank"
}

/**
 * Official Canvas head-start table (entry page). Health bonus and #PIXEL attached at published
 * milestones. Health rises with every level; for a Level not listed, use the highest published
 * row at or below it. Never invent an in-between bonus.
 */
export const ARENA_HEAD_START_ROWS: ReadonlyArray<ArenaHeadStartRow> = (
  [
    [1, 0, "base"],
    [2, 10, "+8%"],
    [3, 20, "+13%"],
    [5, 40, "+19%"],
    [10, 90, "+28%"],
    [15, 140, "+32%"],
    [20, 190, "+36%"],
    [25, 240, "+39%"],
    [35, 340, "+43%"],
    [50, 490, "+47%"],
    [60, 590, "+49%"],
    [75, 740, "+52%"],
    [100, 990, "+55%"],
    [120, 1_190, "+57%"],
    [150, 1_490, "+60%", "Laser"],
  ] as const
).map((row) => {
  const fromLevel = row[0]
  const pixelsAttached = row[1]
  const health = row[2]
  const extra = row[3]
  return {
    fromLevel,
    rank: RANK_AT(fromLevel),
    pixelsAttached,
    health,
    ...(extra ? { extra } : {}),
    headStart: headStartText(health, extra),
  }
})

/**
 * Band-start rows only (Blank / Sketched / Inked / … / top band), for labels that talk about a
 * rank band rather than every published milestone.
 */
export const ARENA_HEAD_STARTS: ReadonlyArray<ArenaHeadStartRow> = ARENA_CANVAS_RANKS.map(
  (r) => ARENA_HEAD_START_ROWS.find((row) => row.fromLevel === r.fromLevel)!,
)

/** "Level 10+ (Inked)" / "Level 150+ (top Arena rank)": the band with its rank name, never doubled. */
export function headStartBandLabel(h: { fromLevel: number; rank: string }): string {
  return h.rank.startsWith("Level ") ? h.rank : `Level ${h.fromLevel}+ (${h.rank})`
}

/** "Level 15 (Inked)" for a published milestone; the top band keeps its neutral label. */
export function headStartRowLabel(h: { fromLevel: number; rank: string }): string {
  return h.rank.startsWith("Level ") ? h.rank : `Level ${h.fromLevel} (${h.rank})`
}

export function arenaTypeStats(type: string | null | undefined) {
  const t = (type ?? "").trim().toLowerCase()
  return ARENA_TYPES.find((r) => r.type.toLowerCase() === t) ?? null
}

/** Highest published official row at or below this Level, or null if the Level is unknown. */
export function arenaHeadStartFor(level: number | null | undefined): ArenaHeadStartRow | null {
  if (typeof level !== "number" || !Number.isFinite(level) || level < 1) return null
  const l = Math.floor(level)
  let found: ArenaHeadStartRow | null = null
  for (const row of ARENA_HEAD_START_ROWS) if (l >= row.fromLevel) found = row
  return found
}

function sourceSuffix(hasType: boolean, hasHead: boolean): string {
  const parts: string[] = []
  if (hasType) parts.push(`type stats per ${TYPE_SRC}`)
  if (hasHead) parts.push(`head start per ${ENTER_SRC}`)
  return `${parts.join("; ")}; a head start, not a guarantee; ${ARENA_MAY_CHANGE}`
}

/** One line for a named Normie (Ask, record card), e.g. "Cat: 115 health …". Null if unknown. */
export function arenaLineFor(type: string | null | undefined, level: number | null | undefined): string | null {
  const s = arenaTypeStats(type)
  const h = arenaHeadStartFor(level)
  const band = typeof level === "number" ? rankForLevel(level) : null
  if (!s && !h) return null
  const parts: string[] = []
  if (s) parts.push(`${s.type}: ${s.health} health, damage dealt ${s.damageDealt}, damage taken from monsters ${s.damageTakenFromMonsters}, speed ${s.speed}; skill: ${s.skill}`)
  if (h && typeof level === "number") {
    const bandName = band?.name ?? h.rank
    const published = h.fromLevel === Math.floor(level)
      ? `${h.headStart} (${pixelsAttachedText(h.pixelsAttached)} #PIXEL attached)`
      : `${h.headStart} (official table at Level ${h.fromLevel}, ${pixelsAttachedText(h.pixelsAttached)} #PIXEL attached)`
    parts.push(`Level ${Math.floor(level)} (${bandName}) head start: ${published}`)
  }
  return `${parts.join(". ")} (per ${sourceSuffix(Boolean(s), Boolean(h))})`
}

/**
 * What the record card shows under "Arena record": a short value and a detail note for the
 * type and for the head start. Null parts when the input is unknown. No prizes, odds or earnings;
 * the card adds the source link and "may change".
 */
export function arenaCardFacts(
  type: string | null | undefined,
  level: number | null | undefined,
): { type: { value: string; note: string } | null; headStart: { value: string; note: string } | null } {
  const s = arenaTypeStats(type)
  const h = arenaHeadStartFor(level)
  const band = typeof level === "number" ? rankForLevel(level) : null
  return {
    type: s
      ? {
          value: `${s.type}, ${s.health} health`,
          note: `Damage dealt ${s.damageDealt} · damage taken from monsters ${s.damageTakenFromMonsters} · speed ${s.speed}. ${s.skill}`,
        }
      : null,
    headStart:
      h && typeof level === "number"
        ? {
            value: h.headStart,
            note: `Level ${Math.floor(level)}: ${band && !band.name.startsWith("Level ") ? `Level ${band.fromLevel}+ (${band.name})` : (band?.name ?? h.rank)}; official table at Level ${h.fromLevel} is ${pixelsAttachedText(h.pixelsAttached)} #PIXEL attached, ${h.headStart}`,
          }
        : null,
  }
}

/** Plain-text official table, one published row per line, for /burn notes and tests. */
export function arenaHeadStartTableText(): string {
  const rows = ARENA_HEAD_START_ROWS.map(
    (r) => `- ${headStartRowLabel(r)}: ${pixelsAttachedText(r.pixelsAttached)} #PIXEL attached, ${r.headStart}`,
  ).join("\n")
  return `Canvas head start (per ${ENTER_SRC}, ${ARENA_ENTER_SOURCE}; a head start, not a guarantee; ${ARENA_MAY_CHANGE}):\n${rows}\n${ARENA_GEAR_LINE}.`
}

/**
 * Ask Zulo's money rule for the Arena (AGENTS.md "Numbers yes, advice never", Ryan 2026-11-18). One sentence, used by
 * the ARENA FACTS block and composePrompt, so the two can't drift.
 */
export const ARENA_MONEY_RULE =
  'Arena money: state an official figure only when it is in your context (today that is the "Current round pool" line), exactly as given, with its source, as-of time and official link. Never predict an outcome, never give or estimate what any one Normie might get or its part of a pool, never do returns math or set a fee against a pool, never convert #PIXEL to ETH or dollars, never state a wallet\'s balance or winnings, and never suggest that anyone pay, enter or add funds.'

/** The ARENA FACTS block for Ask's system prompt. Facts and tables only; no prizes, pools, payouts or odds. */
export function arenaFactsBlock(): string {
  const types = ARENA_TYPES.map(
    (t) => `- ${t.type}: ${t.health} health · damage dealt ${t.damageDealt} · damage taken from monsters ${t.damageTakenFromMonsters} · speed ${t.speed} · ${t.skill}`,
  ).join("\n")
  return `=== ARENA FACTS (seats, rest, who plays and the guide lines: ${GUIDE_SRC}, ${ARENA_GUIDE_SOURCE}; fee, schedule and Canvas table: ${ENTER_SRC}, ${ARENA_ENTER_SOURCE}; type stats: ${TYPE_SRC}, ${ARENA_ARTICLE.url}; ${ARENA_MAY_CHANGE}) ===
- Status: Arena is live (status line above). Opt in any time before Monday 20:00 CET; during a game, it's for next week. Being registered is not a record: a Normie has a record only after it plays a round.
- Where to enter: the official Arena site (${ARENA_SITE}). NCH does not handle opt-in and cannot enter anyone.
- ${ARENA_GAME_WINDOW_LINE}.
${ARENA_ENTRY.map((e) => `- ${e}.`).join("\n")}
- Fee: ${ARENA_FEE_LINE}.
From ${GUIDE_SRC} (${ARENA_GUIDE_SOURCE}, checked ${ARENA_GUIDE_CHECKED}; may change):
${ARENA_GUIDE.map((g) => `- ${g}.`).join("\n")}
From the official API docs (${ARENA_API_DOCS_SOURCE}, read 2026-11-17; may change):
${ARENA_API_FACTS.map((g) => `- ${g}.`).join("\n")}
Type stats (speed compared with a Human; per ${TYPE_SRC}, closed-beta data, may change):
${types}
Head start by Canvas level (Level = floor(#PIXEL attached ÷ 10) + 1; Levels 150 and up share the top head start). ${ARENA_GEAR_LINE}. Official published rows:
${arenaHeadStartTableText()}
Rules for these facts:
- Arena is not the Pixel Market: the Pixel Market trades #PIXEL; Arena is a game agents play. Don't mix the two.
- NCH does not handle opt-in and cannot enter, register or steer anyone. For anything about entering, point to the official Arena site.
- Quote them with the source and "may change". A head start is not a guarantee.
- ${ARENA_MONEY_RULE} For anything else about rewards, odds or what a Normie could earn, say NCH doesn't cover it and link the official entry page.
- Never tell anyone to buy #PIXEL, level up or attach pixels to get ahead. Facts only; it is the holder's call.`
}
