// Arena canon from the official entry page (mechanics, fee, schedule, Canvas table) and the Oct 23 article (type stats).
// Tables and the fee yes; prizes, pools, payouts never.
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import fs from "node:fs"

import {
  ARENA_ENTER_SOURCE,
  ARENA_ENTRY,
  ARENA_FEE_LINE,
  ARENA_GAME_START_CHST,
  ARENA_GAME_WINDOW,
  ARENA_GAME_WINDOW_LINE,
  ARENA_GEAR_LINE,
  ARENA_HEAD_START_ROWS,
  ARENA_HEAD_STARTS,
  ARENA_MAY_CHANGE,
  ARENA_PLANNED_LAUNCH,
  ARENA_TYPES,
  arenaFactsBlock,
  arenaHeadStartFor,
  arenaHeadStartTableText,
  arenaLineFor,
  arenaCardFacts,
  arenaTypeStats,
  headStartBandLabel,
  headStartRowLabel,
  pixelsAttachedText,
  ARENA_GUIDE,
  ARENA_GUIDE_CHECKED,
  ARENA_GUIDE_SOURCE,
  arenaWatchUrl,
} from "./arena-canon"
import { ARENA_CANVAS_RANKS } from "./normies-canon"

const NEVER = /prize|pool|payout|reward(?!s? for)|winnings|\bodds\b|\bETH\b|\$\d|earn(?:s|ed|ings)? (?:#PIXEL|PIXEL|ETH)|\bprofit\b|\btrading\b/i

describe("tables match the official sources", () => {
  it("type stats stay the article's published numbers", () => {
    assert.deepEqual(
      ARENA_TYPES.map((t) => [t.type, t.health, t.damageDealt, t.damageTakenFromMonsters]),
      [
        ["Zombie", 175, "×1.30", "−35%"],
        ["Agent", 150, "×1.18", "−28%"],
        ["Alien", 130, "×1.06", "−21%"],
        ["Cat", 115, "×0.94", "−14%"],
        ["Human", 100, "×0.82", "−7%"],
      ],
    )
  })
  it("band-start head starts still use #161's rank bands and names (ARENA_CANVAS_RANKS)", () => {
    const fromCanon = ARENA_CANVAS_RANKS.map((r) => [r.fromLevel, r.name])
    assert.deepEqual(ARENA_HEAD_STARTS.map((h) => [h.fromLevel, h.rank]), fromCanon)
    assert.deepEqual(ARENA_HEAD_STARTS.map((h) => [h.fromLevel, h.rank]), [
      [1, "Blank"], [2, "Sketched"], [10, "Inked"], [25, "Painted"], [50, "Gilded"], [100, "Masterwork"], [150, "Level 150+ (top Arena rank)"],
    ])
  })
  it("the official Canvas table has every published milestone, #PIXEL attached and health bonus", () => {
    assert.deepEqual(
      ARENA_HEAD_START_ROWS.map((r) => [r.fromLevel, r.rank, r.pixelsAttached, r.health, r.extra ?? "", r.headStart]),
      [
        [1, "Blank", 0, "base", "", "base"],
        [2, "Sketched", 10, "+8%", "", "+8% health"],
        [3, "Sketched", 20, "+13%", "", "+13% health"],
        [5, "Sketched", 40, "+19%", "", "+19% health"],
        [10, "Inked", 90, "+28%", "", "+28% health"],
        [15, "Inked", 140, "+32%", "", "+32% health"],
        [20, "Inked", 190, "+36%", "", "+36% health"],
        [25, "Painted", 240, "+39%", "", "+39% health"],
        [35, "Painted", 340, "+43%", "", "+43% health"],
        [50, "Gilded", 490, "+47%", "", "+47% health"],
        [60, "Gilded", 590, "+49%", "", "+49% health"],
        [75, "Gilded", 740, "+52%", "", "+52% health"],
        [100, "Masterwork", 990, "+55%", "", "+55% health"],
        [120, "Masterwork", 1_190, "+57%", "", "+57% health"],
        [150, "Level 150+ (top Arena rank)", 1_490, "+60%", "Laser", "+60% health plus Laser"],
      ],
    )
    assert.equal(pixelsAttachedText(1_490), "1,490")
    assert.equal(pixelsAttachedText(1_190), "1,190")
    assert.equal(arenaHeadStartFor(12)!.fromLevel, 10)
    assert.equal(arenaHeadStartFor(12)!.headStart, "+28% health")
    assert.equal(arenaHeadStartFor(149)!.fromLevel, 120)
    assert.equal(arenaHeadStartFor(149)!.rank, "Masterwork")
    assert.equal(arenaHeadStartFor(1000)!.fromLevel, 150)
    assert.equal(arenaHeadStartFor(0), null)
    assert.match(ARENA_GEAR_LINE, /Sword, Armour, Boots, Tonics/)
  })
  it("never uses the official page's top-band name that is confusable with the award contract", () => {
    const corpus = [
      JSON.stringify(ARENA_HEAD_START_ROWS),
      JSON.stringify(ARENA_HEAD_STARTS),
      arenaHeadStartTableText(),
      arenaFactsBlock(),
      arenaLineFor("Human", 151) ?? "",
      JSON.stringify(arenaCardFacts("Human", 151)),
    ].join("\n")
    assert.doesNotMatch(corpus, /Legendary/)
    assert.match(corpus, /Level 150\+ \(top Arena rank\)/)
  })
})

describe("mechanics match the official Arena guide and entry page (checked 2026-11-17)", () => {
  it("guide: 200 on the map from a random draw, refills to Normies that haven't walked in, 15-minute rest back into the draw, who plays, the Hive's Normies, no steering; entry page: paid week comes back, opt-in timing", () => {
    const entry = ARENA_ENTRY.join("\n")
    assert.match(entry, /200 Normies are on the map at once; the game opens with a random draw of 200/)
    assert.match(entry, /When one falls, a Normie that hasn't walked in yet takes its seat first/)
    assert.match(entry, /A fallen Normie rests 15 minutes at the Hive and keeps its PX, then goes back into the draw and walks in again at random when a seat frees up and nobody new is waiting/)
    assert.match(entry, /Every registered Normie plays a free round; in a paid round, every Normie whose Arena balance covers the entry plays; up to 8 per wallet/)
    assert.match(entry, /The Hive's own Normies fill empty space on the map; a round player always gets a seat before them/)
    assert.match(entry, /If a paid week never walks in, it comes back/)
    assert.doesNotMatch(entry, /another is drawn at random|so every Normie opted in plays|go back in line|rest wait in line/i)
    assert.match(entry, /Opt in any time before Monday 20:00 CET; during a game, it's for next week/)
    assert.match(entry, /the NFT never leaves your wallet/)
    assert.match(entry, /Nobody steers a Normie; each one decides for itself/)
    assert.match(entry, /ERC-8004/)
    assert.doesNotMatch(entry, /first come|first-come|FIFO|next in line|8 hours|8-hour|walks in at dawn|prize|pool\b|payout/i)
    // narrate.ts reads indexes 3 and 4.
    assert.match(ARENA_ENTRY[3], /^200 Normies are on the map/)
    assert.match(ARENA_ENTRY[4], /^When one falls/)
  })
  it("guide lines: level formula (not a record), gear levels, power ladder, death, ranking rule, decisions, watch link; no prizes", () => {
    const g = ARENA_GUIDE.join("\n")
    assert.equal(ARENA_GUIDE_SOURCE, "https://arena.normies.art/world/guide")
    assert.equal(ARENA_GUIDE_CHECKED, "2026-11-17")
    assert.match(g, /Canvas level = #PIXEL attached ÷ 10 \+ 1; it sets a Normie's starting health and gear, and it is not an Arena record/)
    assert.match(g, /swords at 3, 10, 35 and 100; armour at 5, 25 and 75; boots at 15 and 50; tonics at 20, 60 and 120; only the level-150 top band starts with the laser/)
    assert.match(g, /Zombie > Agent > Alien > Cat > Human \(health 175 \/ 150 \/ 130 \/ 115 \/ 100\)/)
    assert.match(g, /empty purse, keeping its story, reputation, friends and grudges/)
    assert.match(g, /spending, losing a duel or dying never lowers it/)
    assert.match(g, /Levanto Sage/)
    assert.match(g, /arena\.normies\.art\/world\/pixel\?follow=<id>/)
    assert.doesNotMatch(g, /prize|pool\b|payout|winnings|reward|earn #PIXEL|Legendary/i)
    assert.equal(arenaWatchUrl(7141), "https://arena.normies.art/world/pixel?follow=7141")
  })
  it("the guide's numbers still match NCH's tables: type health and power order, and its head-start rows", () => {
    assert.deepEqual(ARENA_TYPES.map((t) => [t.type, t.health]), [["Zombie", 175], ["Agent", 150], ["Alien", 130], ["Cat", 115], ["Human", 100]])
    const guideHealth: Array<[number, string]> = [[2, "+8%"], [10, "+28%"], [35, "+43%"], [60, "+49%"], [100, "+55%"], [150, "+60%"]]
    for (const [level, health] of guideHealth) assert.equal(ARENA_HEAD_START_ROWS.find((r) => r.fromLevel === level)?.health, health, `level ${level}`)
    assert.equal(ARENA_HEAD_START_ROWS.find((r) => r.extra === "Laser")?.fromLevel, 150)
  })
  it("the game window includes the official CET hours and the Guam clock", () => {
    assert.equal(ARENA_GAME_WINDOW, "Monday 20:00 CET to Saturday 20:00 CET")
    assert.equal(ARENA_GAME_START_CHST, "Mon Nov 16, 20:00 CET (Tue Nov 17, 5 AM ChST)")
    assert.equal(ARENA_GAME_WINDOW_LINE, `Each game runs ${ARENA_GAME_WINDOW}. Game 1 started ${ARENA_GAME_START_CHST}`)
  })
})

describe("facts only: never prizes, pools, payouts, ETH or dollars", () => {
  it("fee line", () => {
    assert.equal(
      ARENA_FEE_LINE,
      "The first 2 weeks in the Arena are free for every Normie; after that, a week of play costs 1 #PIXEL per Normie, however often it falls",
    )
    assert.doesNotMatch(ARENA_FEE_LINE, NEVER)
  })
  it("Level has no cap: Levels 150 and up share the top head start (GrokBot review of #162)", () => {
    const b = arenaFactsBlock()
    assert.match(b, /Levels 150 and up share the top head start/)
    assert.doesNotMatch(b, /up to 150/)
    assert.equal(headStartBandLabel(ARENA_HEAD_STARTS[ARENA_HEAD_STARTS.length - 1]), "Level 150+ (top Arena rank)")
    assert.equal(headStartBandLabel(ARENA_HEAD_STARTS.find((h) => h.fromLevel === 10)!), "Level 10+ (Inked)")
    assert.equal(headStartRowLabel(ARENA_HEAD_START_ROWS.find((h) => h.fromLevel === 15)!), "Level 15 (Inked)")
  })
  it("the Ask block states official-page facts and forbids the rest", () => {
    const b = arenaFactsBlock()
    assert.match(b, /seats, rest, who plays and the guide lines: the official Arena guide, https:\/\/arena\.normies\.art\/world\/guide; fee, schedule and Canvas table: the official Arena entry page, https:\/\/arena\.normies\.art\/world\/enter/)
    assert.match(b, /From the official Arena guide \(https:\/\/arena\.normies\.art\/world\/guide, checked 2026-11-17; may change\):/)
    assert.match(b, /- Canvas level = #PIXEL attached ÷ 10 \+ 1; it sets a Normie's starting health and gear, and it is not an Arena record\./)
    assert.match(b, /type stats: normiesART's Arena article, Oct 23, 2026/)
    assert.equal(ARENA_PLANNED_LAUNCH, "2026-11-16")
    assert.match(b, /- Status: Arena is live \(status line above\)\. Opt in any time before Monday 20:00 CET; during a game, it's for next week\. Being registered is not a record: a Normie has a record only after it plays a round/)
    assert.match(b, /- Where to enter: the official Arena site \(https:\/\/arena\.normies\.art\)\. NCH does not handle opt-in and cannot enter anyone\./)
    assert.doesNotMatch(b, /Coming Soon|Planned launch/)
    const rules = b.split("Rules for these facts:")[1]
    assert.match(rules, /Arena is not the Pixel Market/)
    assert.match(rules, /NCH does not handle opt-in and cannot enter, register or steer anyone/)
    assert.match(b, /Each game runs Monday 20:00 CET to Saturday 20:00 CET\. Game 1 started Mon Nov 16, 20:00 CET \(Tue Nov 17, 5 AM ChST\)/)
    assert.match(b, /200 Normies are on the map at once; the game opens with a random draw of 200/)
    assert.match(b, /When one falls, a Normie that hasn't walked in yet takes its seat first/)
    assert.match(b, /A fallen Normie rests 15 minutes at the Hive and keeps its PX/)
    assert.match(b, /If a paid week never walks in, it comes back/)
    assert.doesNotMatch(b, /another is drawn at random|so every Normie opted in plays/i)
    assert.match(b, /a head start, not a guarantee/)
    assert.match(b, /A head start is not a guarantee/)
    assert.ok(b.includes(ARENA_ENTER_SOURCE))
    assert.ok(b.includes(ARENA_MAY_CHANGE))
    assert.match(b, /Never mention prizes, a prize pool, payouts/)
    const facts = b.split("Rules for these facts:")[0]
    assert.doesNotMatch(facts, NEVER)
    assert.doesNotMatch(facts, /OpenSea|Pixel Market/)
    assert.doesNotMatch(b, /first come|first-come|FIFO|next in line|8 hours|8-hour|walks in at dawn/i)
  })
  it("a line for one Normie", () => {
    const line = arenaLineFor("Cat", 12)!
    assert.match(line, /^Cat: 115 health/)
    assert.match(line, /Level 12 \(Inked\) head start: \+28% health \(official table at Level 10, 90 #PIXEL attached\)/)
    assert.match(line, /a head start, not a guarantee/)
    assert.match(line, /head start per the official Arena entry page/)
    assert.match(line, /type stats per normiesART's Arena article/)
    assert.doesNotMatch(line, NEVER)
    assert.equal(arenaLineFor(null, null), null)
    assert.equal(arenaTypeStats("zombie")!.health, 175)
  })
})

describe("record card lines", () => {
  it("type and head start, short value plus the official-table row", () => {
    const f = arenaCardFacts("Cat", 12)
    assert.deepEqual(f.type, { value: "Cat, 115 health", note: "Damage dealt ×0.94 · damage taken from monsters −14% · speed fastest (+14%). Nine lives: 1 in 5 hits on a Cat misses" })
    assert.deepEqual(f.headStart, { value: "+28% health", note: "Level 12: Level 10+ (Inked); official table at Level 10 is 90 #PIXEL attached, +28% health" })
    assert.deepEqual(arenaCardFacts("Human", 1).headStart, { value: "base", note: "Level 1: Level 1+ (Blank); official table at Level 1 is 0 #PIXEL attached, base" })
    assert.equal(arenaCardFacts("Human", 151).headStart!.note.startsWith("Level 151: Level 150+ (top Arena rank)"), true)
    assert.match(arenaCardFacts("Human", 151).headStart!.note, /1,490 #PIXEL attached, \+60% health plus Laser/)
    assert.deepEqual(arenaCardFacts(null, null), { type: null, headStart: null })
    const unknownType = arenaCardFacts(null, 31)
    assert.equal(unknownType.type, null)
    assert.deepEqual(unknownType.headStart, { value: "+39% health", note: "Level 31: Level 25+ (Painted); official table at Level 25 is 240 #PIXEL attached, +39% health" })
    assert.doesNotMatch(JSON.stringify(arenaCardFacts("Zombie", 160)), NEVER)
  })
  it("the record page shows them in the Arena section with the official entry page and 'may change', not on the share image", async () => {
    const page = fs.readFileSync("app/record/[tokenId]/page.tsx", "utf8")
    assert.match(page, /arenaCardFacts\(identity\.type\?\.value \?\? null, identity\.level\.value\)/)
    assert.doesNotMatch(page.slice(page.indexOf("arenaCardFacts(")), /^[^\n]*mint_type/)
    assert.match(page, /ARENA_ENTER_SOURCE/)
    assert.match(page, /the official Arena entry page/)
    assert.match(page, /\{ARENA_MAY_CHANGE\}\. A head start, not a guarantee\./)
    for (const f of ["app/record/[tokenId]/opengraph-image.tsx", "lib/record-card/og-art.tsx", "lib/record-card/share-image.ts"]) {
      if (fs.existsSync(f)) assert.doesNotMatch(fs.readFileSync(f, "utf8"), /arena-canon|arenaCardFacts/, f)
    }
  })
})

describe("copy lock on arena canon", () => {
  it("user-facing arena strings never use banned wording", () => {
    const corpus = [
      ARENA_ENTRY.join("\n"),
      ARENA_FEE_LINE,
      ARENA_MAY_CHANGE,
      ARENA_GAME_WINDOW_LINE,
      arenaHeadStartTableText(),
      arenaFactsBlock().split("Rules for these facts:")[0],
      arenaLineFor("Cat", 12) ?? "",
      JSON.stringify(arenaCardFacts("Zombie", 160)),
    ].join("\n")
    assert.doesNotMatch(corpus, /OpenSea/)
    assert.doesNotMatch(corpus, /Pixel Market/)
    assert.doesNotMatch(corpus, /Legendary/)
    assert.doesNotMatch(corpus, /walks in at dawn|8 hours|8-hour|first come|first-come|FIFO|next in line/i)
    // Build the earlier planned-date needles without writing those words as a literal in this test.
    const month = "Nov"
    const earlier = [`${month}ember 15`, `${month} 15`]
    for (const s of earlier) assert.equal(corpus.includes(s), false, s)
  })
})
