// Arena canon from normiesART's Arena article (Ryan, 2026-11-11): tables and the fee yes, prizes/pools/payouts never.
import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  ARENA_FEE_LINE,
  ARENA_HEAD_STARTS,
  ARENA_PLANNED_LAUNCH,
  ARENA_TYPES,
  arenaFactsBlock,
  arenaHeadStartFor,
  arenaLineFor,
  arenaCardFacts,
  arenaTypeStats,
  headStartBandLabel,
} from "./arena-canon"
import { ARENA_CANVAS_RANKS } from "./normies-canon"

const NEVER = /prize|pool|payout|reward(?!s? for)|winnings|\bodds\b|\bETH\b|\$\d|earn(?:s|ed|ings)? (?:#PIXEL|PIXEL|ETH)/i

describe("tables match the article", () => {
  it("type stats", () => {
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
  it("head starts use exactly #161's rank bands and names (ARENA_CANVAS_RANKS)", () => {
    const fromCanon = [...ARENA_CANVAS_RANKS].map((r) => [r.fromLevel, r.name]).reverse()
    assert.deepEqual(ARENA_HEAD_STARTS.map((h) => [h.fromLevel, h.rank]), fromCanon)
    assert.deepEqual(ARENA_HEAD_STARTS.map((h) => [h.fromLevel, h.rank]), [
      [150, "Level 150+ (top Arena rank)"], [100, "Masterwork"], [50, "Gilded"], [25, "Painted"], [10, "Inked"], [2, "Sketched"], [1, "Blank"],
    ])
    assert.match(ARENA_HEAD_STARTS[0].headStart, /\+60% health.*the laser/)
    assert.equal(arenaHeadStartFor(149)!.rank, "Masterwork")
    assert.equal(arenaHeadStartFor(1000)!.fromLevel, 150)
    assert.equal(arenaHeadStartFor(0), null)
  })
  it("never uses the article's 'Legendary Canvas' name (confusable with the NormiesLegendaryCanvas award)", () => {
    assert.doesNotMatch(JSON.stringify(ARENA_HEAD_STARTS), /Legendary Canvas/)
  })
})

describe("facts only: never prizes, pools, payouts, ETH or dollars", () => {
  it("fee line", () => {
    assert.equal(ARENA_FEE_LINE, "The first 2 weeks in the Arena are free for every Normie; after that, 1 #PIXEL per week per agent keeps its Arena pass active")
    assert.doesNotMatch(ARENA_FEE_LINE, NEVER)
  })
  it("Level has no cap: Levels 150 and up share the top head start (GrokBot review of #162)", () => {
    const b = arenaFactsBlock()
    assert.match(b, /Levels 150 and up share the top head start/)
    assert.doesNotMatch(b, /up to 150/)
    assert.equal(headStartBandLabel(ARENA_HEAD_STARTS[0]), "Level 150+ (top Arena rank)")
    assert.equal(headStartBandLabel(ARENA_HEAD_STARTS.find((h) => h.fromLevel === 10)!), "Level 10+ (Inked)")
  })
  it("the Ask block states facts and forbids the rest", () => {
    const b = arenaFactsBlock()
    assert.match(b, /type stats and ranks: normiesART's Arena article, Oct 23, 2026/)
    assert.equal(ARENA_PLANNED_LAUNCH, "2026-11-16")
    assert.match(b, /Planned launch: Monday, November 16, 2026 \(a plan, per normiesART's Nov 11 post, https:\/\/x\.com\/normiesART\/status\/2120475856372142292\)/)
    for (const line of b.split("\n")) {
      if (/November 16|2026-11-16/.test(line)) assert.doesNotMatch(line, /Oct 23|Arena article/)
    }
    assert.match(b, /closed beta and may change/)
    assert.match(b, /a head start is not a guarantee/i)
    assert.match(b, /Never mention prizes, a prize pool, payouts/)
    // Outside the rules lines, no prize/pool/ETH words at all.
    const facts = b.split("Rules for these facts:")[0]
    assert.doesNotMatch(facts, NEVER)
  })
  it("a line for one Normie", () => {
    const line = arenaLineFor("Cat", 12)!
    assert.match(line, /^Cat: 115 health/)
    assert.match(line, /Level 12 \(Inked\) head start: \+28% health, sword III, plate I/)
    assert.match(line, /a head start, not a guarantee/)
    assert.doesNotMatch(line, NEVER)
    assert.equal(arenaLineFor(null, null), null)
    assert.equal(arenaTypeStats("zombie")!.health, 175)
  })
})

describe("record card lines (Ryan, 2026-11-11: show the tables)", () => {
  it("type and head start, short value plus detail", () => {
    const f = arenaCardFacts("Cat", 12)
    assert.deepEqual(f.type, { value: "Cat, 115 health", note: "Damage dealt ×0.94 · damage taken from monsters −14% · speed fastest (+14%). Nine lives: 1 in 5 hits on a Cat misses" })
    assert.deepEqual(f.headStart, { value: "+28% health", note: "Level 12: Level 10+ (Inked), also sword III, plate I" })
    assert.deepEqual(arenaCardFacts("Human", 1).headStart, { value: "no head start", note: "Level 1: Level 1+ (Blank)" })
    assert.equal(arenaCardFacts("Human", 151).headStart!.note.startsWith("Level 151: Level 150+ (top Arena rank)"), true)
    assert.deepEqual(arenaCardFacts(null, null), { type: null, headStart: null })
    // Unknown current type: no type line, the head start still shows (Level is enough).
    const unknownType = arenaCardFacts(null, 31)
    assert.equal(unknownType.type, null)
    assert.deepEqual(unknownType.headStart, { value: "+39% health", note: "Level 31: Level 25+ (Painted), also sword III, plate II, boots I, 1 tonic" })
    assert.doesNotMatch(JSON.stringify(arenaCardFacts("Zombie", 160)), NEVER)
  })
  it("the record page shows them in the Arena section with the source and 'may change', not on the share image", async () => {
    const fs = await import("node:fs")
    const page = fs.readFileSync("app/record/[tokenId]/page.tsx", "utf8")
    // Current type only (GrokBot review of #163): never fall back to the minted type.
    assert.match(page, /arenaCardFacts\(identity\.type\?\.value \?\? null, identity\.level\.value\)/)
    assert.doesNotMatch(page.slice(page.indexOf("arenaCardFacts(")), /^[^\n]*mint_type/)
    assert.match(page, /normiesART&apos;s Arena article<\/a>/)
    assert.match(page, /\{ARENA_MAY_CHANGE\}\. A head start, not a guarantee\./)
    for (const f of ["app/record/[tokenId]/opengraph-image.tsx", "lib/record-card/og-art.tsx", "lib/record-card/share-image.ts"]) {
      if (fs.existsSync(f)) assert.doesNotMatch(fs.readFileSync(f, "utf8"), /arena-canon|arenaCardFacts/, f)
    }
  })
})
