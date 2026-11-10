// Arena canon from normiesART's Arena article (Ryan, 2026-11-11): tables and the fee yes, prizes/pools/payouts never.
import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  ARENA_FEE_LINE,
  ARENA_HEAD_STARTS,
  ARENA_TYPES,
  arenaFactsBlock,
  arenaHeadStartFor,
  arenaLineFor,
  arenaTypeStats,
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
  it("the Ask block states facts and forbids the rest", () => {
    const b = arenaFactsBlock()
    assert.match(b, /source: normiesART's Arena article, Oct 23, 2026/)
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
