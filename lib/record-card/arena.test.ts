// Arena sector of the record card, against real official API responses pinned in lib/record-card/fixtures/
// (read from api.normies.art on launch weekend, after opt-in opened and before Game 1).
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"

import {
  ARENA_RANK_MINIMUM,
  ARENA_RANK_OFF_REASON,
  ARENA_SOURCES,
  ArenaSourceError,
  loadArenaSector,
  officialArenaSource,
  parseAnyRoundStarted,
  parseArenaNormie,
} from "./arena"
import { buildRecordCard, type RecordCardInputs } from "./build"

const NOW = "2026-11-14T23:00:00.000Z"
const fixture = (name: string): unknown => JSON.parse(readFileSync(`lib/record-card/fixtures/${name}.json`, "utf8"))
const ZULO = fixture("arena-normie-7141") as Record<string, unknown>
const NOT_ENTERED = fixture("arena-normie-4242-not-entered") as Record<string, unknown>
const STATUS = fixture("arena-status") as Record<string, unknown>

type Reply = { status: number; body: unknown } | "throws"
/** A stub of the official API: answers per path and records what was asked. */
function api(replies: Record<string, Reply>) {
  const asked: string[] = []
  const get = async (path: string) => {
    asked.push(path)
    const r = replies[path]
    if (!r || r === "throws") throw new Error("connection refused")
    return r
  }
  return { source: officialArenaSource(get), asked }
}
const live = (tokenId: number, replies: Record<string, Reply>) => {
  const a = api(replies)
  return loadArenaSector(tokenId, NOW, { status: "LIVE", sources: [a.source] }).then((sector) => ({ sector, asked: a.asked }))
}
const ok = (body: unknown): Reply => ({ status: 200, body })

describe("the pinned responses are what the code expects (field names seen, not guessed)", () => {
  it("/arena/normie/7141: Zulo is in the line with a ticket and has played no rounds", () => {
    for (const key of ["tokenId", "ticket", "active", "inLine", "needsFunds", "roundsPlayed", "wins", "lastRound", "position", "blockNumber"]) {
      assert.ok(key in ZULO, key)
    }
    assert.equal(ZULO.tokenId, "7141")
    assert.equal(ZULO.inLine, true)
    assert.equal(ZULO.ticket, "353")
    assert.equal(ZULO.roundsPlayed, 0)
  })
  it("/arena/status: indexed, nobody admitted, no round started", () => {
    assert.equal(STATUS.indexed, true)
    assert.equal(STATUS.currentRound, 0)
    assert.equal((STATUS.totals as { roundsStarted: number }).roundsStarted, 0)
    assert.equal(parseAnyRoundStarted(STATUS), false)
  })
  it("a Normie that never opted in has no ticket and is not in line", () => {
    assert.equal(NOT_ENTERED.ticket, null)
    assert.equal(NOT_ENTERED.inLine, false)
  })
})

describe("live data: entered and in line is not a record", () => {
  it("Zulo: entered, place 353, no round started yet, and every record field is pending", async () => {
    const { sector, asked } = await live(7141, { "/arena/normie/7141": ok(ZULO), "/arena/status": ok(STATUS) })
    assert.equal(sector.status, "entered")
    assert.equal(sector.status_text, "Entered and in line, place 353. No Arena round has started yet, so there's no record")
    assert.deepEqual(asked, ["/arena/normie/7141", "/arena/status"])
    assert.equal(sector.entry?.entered.value, true)
    assert.equal(sector.entry?.entered.label, "verified")
    assert.equal(sector.entry?.in_line.value, true)
    assert.equal(sector.entry?.line_position.value, 353)
    assert.equal(sector.entry?.line_position.source.ref, "GET /arena/normie/7141 → position")
    assert.equal(sector.entry?.line_position.source_block, 26416684)
    for (const [name, f] of Object.entries(sector.record)) {
      assert.equal(f.value, null, name)
      assert.equal(f.label, "pending", name)
      assert.equal(f.pending_reason, "no rounds played yet", name)
    }
    assert.deepEqual(sector.rank, { ranked: false, score: null, reason: ARENA_RANK_OFF_REASON })
  })
  it("no invented numbers: the API's zeros (rounds, wins, #PIXEL) never appear as record values", async () => {
    const { sector } = await live(7141, { "/arena/normie/7141": ok(ZULO), "/arena/status": ok(STATUS) })
    const json = JSON.stringify(sector)
    assert.doesNotMatch(json, /"value":0\b/)
    assert.doesNotMatch(json, /pixelsWon|pixelsCharged|pixelsRefunded|balance|deposited|withdrawn/)
  })
  it("when the status read fails, the card still says entered and in line, without claiming whether rounds have started", async () => {
    const { sector } = await live(7141, { "/arena/normie/7141": ok(ZULO), "/arena/status": "throws" })
    assert.equal(sector.status, "entered")
    assert.equal(sector.status_text, "Entered and in line, place 353. It hasn't played a round yet, so there's no record")
  })
  it("an entry that needs funds says so, as the official data's statement", async () => {
    const { sector } = await live(7141, { "/arena/normie/7141": ok({ ...ZULO, needsFunds: true }), "/arena/status": ok(STATUS) })
    assert.match(sector.status_text, /The official data says this entry needs funds before it can be admitted$/)
  })
})

describe("live data: after rounds are played", () => {
  const played = { ...ZULO, inLine: false, ticket: null, position: null, roundsPlayed: 3, wins: 1, lastRound: 4, pixelsWon: "25", pixelsCharged: "1" }
  it("rounds played and wins are verified counts; everything the API doesn't give stays pending with a reason", async () => {
    const { sector, asked } = await live(7141, { "/arena/normie/7141": ok(played) })
    assert.equal(sector.status, "unranked")
    assert.equal(sector.status_text, "Building a record: 3 rounds played")
    assert.deepEqual(asked, ["/arena/normie/7141"], "no status read is needed once rounds are played")
    assert.deepEqual({ v: sector.record.matches.value, l: sector.record.matches.label, ref: sector.record.matches.source.ref }, { v: 3, l: "verified", ref: "GET /arena/normie/7141 → roundsPlayed" })
    assert.deepEqual({ v: sector.record.wins.value, l: sector.record.wins.label }, { v: 1, l: "verified" })
    assert.deepEqual({ v: sector.record.losses.value, r: sector.record.losses.pending_reason }, { v: null, r: "the official data doesn't publish losses" })
    assert.deepEqual({ v: sector.record.pixels_net.value, r: sector.record.pixels_net.pending_reason }, { v: null, r: "NCH doesn't show Arena #PIXEL amounts" })
    assert.equal(sector.record.last_match_at.value, null)
  })
  it("#PIXEL amounts from the API are never shown or netted, even when they are not zero", async () => {
    const { sector } = await live(7141, { "/arena/normie/7141": ok(played) })
    assert.doesNotMatch(JSON.stringify(sector), /25|pixelsWon/)
  })
  it("ranking is off until 10 rounds, 5 opponents and 14 days: even 50 rounds stays unranked without opponent data", async () => {
    assert.deepEqual(ARENA_RANK_MINIMUM, { rounds: 10, opponents: 5, days: 14 })
    const { sector } = await live(7141, { "/arena/normie/7141": ok({ ...played, roundsPlayed: 50, wins: 40 }) })
    assert.equal(sector.status, "unranked")
    assert.deepEqual(sector.rank, { ranked: false, score: null, reason: "Ranking is off until 10 rounds, 5 opponents and 14 days of official results" })
  })
})

describe("Normie not entered", () => {
  it("says not entered, with pending fields and no place in line", async () => {
    const { sector, asked } = await live(4242, { "/arena/normie/4242": ok(NOT_ENTERED), "/arena/status": ok(STATUS) })
    assert.equal(sector.status, "not_entered")
    assert.equal(sector.status_text, "Not entered in Arena")
    assert.equal(sector.entry?.entered.value, false)
    assert.equal(sector.entry?.entered.label, "verified")
    assert.equal(sector.entry?.line_position.value, null)
    assert.equal(sector.entry?.line_position.pending_reason, "not in line")
    for (const f of Object.values(sector.record)) assert.equal(f.pending_reason, "not entered in Arena")
    assert.equal(sector.rank.ranked, false)
    assert.deepEqual(asked.slice(0, 1), ["/arena/normie/4242"])
  })
})

describe("404: the official endpoint is not there (not configured)", () => {
  it("pending with a reason, never a record", async () => {
    const { sector } = await live(7141, { "/arena/normie/7141": { status: 404, body: null } })
    assert.equal(sector.status, "source_pending")
    assert.equal(sector.status_text, "Arena is live; the official Arena data isn't available here yet")
    for (const f of Object.values(sector.record)) {
      assert.equal(f.value, null)
      assert.equal(f.pending_reason, "official Arena data not available")
    }
    assert.equal(sector.entry?.entered.value, null)
  })
  it("the adapter reports it as not_configured", async () => {
    await assert.rejects(api({ "/arena/normie/7141": { status: 404, body: null } }).source.load(7141), (e: unknown) => e instanceof ArenaSourceError && e.kind === "not_configured")
  })
})

describe("fetch failure", () => {
  const cases: Array<[string, Reply]> = [
    ["the request throws (timeout, connection refused)", "throws"],
    ["the API answers 500", { status: 500, body: { error: "boom" } }],
    ["the API answers 400", { status: 400, body: fixture("arena-normie-invalid-id") }],
    ["the body isn't the expected shape", ok({ hello: "world" })],
    ["the body is for another Normie", ok({ ...ZULO, tokenId: "7142" })],
    ["a count is not a whole number", ok({ ...ZULO, roundsPlayed: "many" })],
    ["wins exceed rounds played", ok({ ...ZULO, roundsPlayed: 1, wins: 2 })],
    ["the body is null", ok(null)],
  ]
  for (const [what, reply] of cases) {
    it(`${what}: unavailable, never numbers`, async () => {
      const { sector } = await live(7141, { "/arena/normie/7141": reply, "/arena/status": ok(STATUS) })
      assert.equal(sector.status, "source_pending")
      assert.equal(sector.status_text, "Arena data is unavailable right now")
      for (const f of Object.values(sector.record)) {
        assert.equal(f.value, null)
        assert.equal(f.label, "pending")
        assert.equal(f.pending_reason, "Arena source unavailable")
      }
    })
  }
  it("a token id outside 0–9999 is never sent to the API", async () => {
    const a = api({})
    for (const bad of [-1, 10000, 1.5, Number.NaN]) await assert.rejects(a.source.load(bad), ArenaSourceError)
    assert.deepEqual(a.asked, [])
  })
})

describe("parsers", () => {
  it("parseArenaNormie reads the real response", () => {
    assert.deepEqual(parseArenaNormie(ZULO, 7141), { entered: true, in_line: true, position: 353, needs_funds: false, rounds_played: 0, wins: 0, last_round: null, block: 26416684 })
    assert.deepEqual(parseArenaNormie(NOT_ENTERED, 4242), { entered: false, in_line: false, position: null, needs_funds: false, rounds_played: 0, wins: 0, last_round: null, block: null })
  })
  it("parseAnyRoundStarted", () => {
    assert.equal(parseAnyRoundStarted({ currentRound: 1, totals: { roundsStarted: 1 } }), true)
    assert.equal(parseAnyRoundStarted({ currentRound: 0, totals: { roundsStarted: 0 } }), false)
    assert.equal(parseAnyRoundStarted({}), null)
    assert.equal(parseAnyRoundStarted(null), null)
  })
})

describe("the card and the wiring", () => {
  it("one official adapter is registered, reading the official API with a time limit", () => {
    assert.equal(ARENA_SOURCES.length, 1)
    assert.equal(ARENA_SOURCES[0].kind, "official_api")
    assert.equal(ARENA_SOURCES[0].ref(7141), "GET /arena/normie/7141")
    const src = readFileSync("lib/record-card/arena.ts", "utf8")
    assert.match(src, /fetchWithTimeout\(`\$\{NORMIES_API_BASE\}\$\{path\}`/)
    assert.doesNotMatch(src, /method: "(POST|PUT|PATCH|DELETE)"|writeContract|sendTransaction|signTypedData/)
  })
  it("while Arena is not LIVE nothing is called", async () => {
    const a = api({ "/arena/normie/7141": ok(ZULO) })
    const s = await loadArenaSector(7141, NOW, { status: "COMING_SOON", sources: [a.source] })
    assert.equal(s.status, "not_live")
    assert.deepEqual(a.asked, [])
  })
  it("the record card for Zulo says entered and in line, with no invented numbers", async () => {
    const { sector } = await live(7141, { "/arena/normie/7141": ok(ZULO), "/arena/status": ok(STATUS) })
    const inputs: RecordCardInputs = {
      tokenId: 7141,
      now: NOW,
      binding: { agentId: "32626", timestamp: "1778887079", blockNumber: "25103790" },
      identity: { name: "Zulo", type: "Human" },
      canvas: { actionPoints: 12, level: 2 },
      owner: { owner: "0xfafd8fb6b4e43ace0e365553f1b9242384591031" },
      zombie: { info: { isZombie: false } },
      pulse: null,
      chatRatings: null,
      arena: sector,
    }
    const card = buildRecordCard(inputs)
    assert.equal(card.card_status, "unranked")
    assert.equal(card.card_status_text, "Entered and in line, place 353. No Arena round has started yet, so there's no record")
    assert.equal(card.sectors.arena.status, "entered")
    assert.equal(card.sectors.arena.record.matches.value, null)
    assert.equal(card.sectors.arena.record.wins.value, null)
  })
})
