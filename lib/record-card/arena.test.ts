// Arena sector of the record card, against real official API responses pinned in lib/record-card/fixtures/:
// arena-normie-7141.json is the live shape read on 2026-11-17 (after the launch-weekend contract migration (block 26421529); owner redacted);
// arena-normie-7141-v1.json and arena-normie-4242-not-entered.json are the launch-weekend shape, now refused.
// Cases built by spreading ZULO with changed fields are synthetic and say so.
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"

import {
  ARENA_RANK_MINIMUM,
  ARENA_RANK_OFF_REASON,
  ARENA_SOURCES,
  ArenaSourceError,
  loadArenaSector,
  NOT_IN_OFFICIAL_DATA,
  officialArenaSource,
  parseAnyRoundStarted,
  parseArenaLiveRound,
  parseArenaNormie,
} from "./arena"
import { buildRecordCard, type RecordCardInputs } from "./build"

const NOW = "2026-11-17T00:00:00.000Z"
const fixture = (name: string): unknown => JSON.parse(readFileSync(`lib/record-card/fixtures/${name}.json`, "utf8"))
const ZULO = fixture("arena-normie-7141") as Record<string, unknown>
const ZULO_V1 = fixture("arena-normie-7141-v1") as Record<string, unknown>
const NOT_ENTERED_V1 = fixture("arena-normie-4242-not-entered") as Record<string, unknown>
const STATUS = fixture("arena-status") as Record<string, unknown>
/** Live GET /arena/status, 2026-11-17 08:07 ChST, trimmed by Ryan to the round fields (its prize and pool fields left out). */
const STATUS_OPEN = fixture("arena-status-round1-open") as Record<string, unknown>
const withRound = (round: Record<string, unknown>) => ({ ...STATUS_OPEN, round: { ...(STATUS_OPEN.round as object), ...round } })
/** Synthetic: a Normie that never registered, in the live shape. */
const NOT_ENTERED = { ...ZULO, tokenId: "4242", state: "unregistered", registered: false, agentId: null, skins: 0, roundsPlayed: 0, lastRound: null, wins: 0, inCurrentRound: false }
/** Synthetic: in the current round but no round counted yet. */
const ENTERED_NOT_PLAYED = { ...ZULO, roundsPlayed: 0, lastRound: null, wins: 0 }
/** Synthetic: registered, waiting for a seat, never played. */
const REGISTERED_WAITING = { ...ZULO, roundsPlayed: 0, lastRound: null, wins: 0, inCurrentRound: false }

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

describe("the pinned live response is what the code expects (field names seen, not guessed)", () => {
  it("/arena/normie/7141 (2026-11-17): registered, in the current round, one round played, no line fields", () => {
    for (const key of ["tokenId", "registered", "inCurrentRound", "roundsPlayed", "wins", "lastRound", "blockNumber"]) {
      assert.ok(key in ZULO, key)
    }
    for (const gone of ["inLine", "ticket", "position", "needsFunds"]) assert.equal(gone in ZULO, false, gone)
    assert.equal(ZULO.tokenId, "7141")
    assert.equal(ZULO.registered, true)
    assert.equal(ZULO.inCurrentRound, true)
    assert.equal(ZULO.roundsPlayed, 1)
    assert.equal(ZULO.agentId, "32626")
  })
})

describe("live data: Zulo after the migration", () => {
  it("one round played and wins are verified counts; line fields are pending, not in official data", async () => {
    const { sector, asked } = await live(7141, { "/arena/normie/7141": ok(ZULO) })
    assert.equal(sector.status, "unranked")
    assert.equal(sector.status_text, "Building a record: 1 round played")
    assert.equal(sector.watch_url, "https://arena.normies.art/world/pixel?follow=7141", "official watch link (Arena guide)")
    assert.deepEqual({ v: sector.entry?.state?.value, ref: sector.entry?.state?.source.ref }, { v: "Active: plays every free round, and paid rounds while topped up", ref: "GET /arena/normie/7141 → state" })
    assert.deepEqual({ v: sector.entry?.agent_id?.value, l: sector.entry?.agent_id?.label }, { v: 32626, l: "verified" })
    assert.deepEqual({ v: sector.entry?.skins?.value, l: sector.entry?.skins?.label }, { v: 1, l: "verified" })
    assert.deepEqual(asked, ["/arena/normie/7141", "/arena/status"], "one status read per card; here it fails and the card still builds")
    assert.deepEqual({ v: sector.entry?.entered.value, l: sector.entry?.entered.label }, { v: true, l: "verified" })
    assert.equal(sector.entry?.entered.source.ref, "GET /arena/normie/7141 → registered, roundsPlayed, inCurrentRound")
    assert.equal(sector.entry?.entered.source_block, 26421529)
    for (const f of [sector.entry?.in_line, sector.entry?.line_position]) {
      assert.equal(f?.value, null)
      assert.equal(f?.label, "pending")
      assert.equal(f?.pending_reason, NOT_IN_OFFICIAL_DATA)
    }
    assert.deepEqual({ v: sector.record.matches.value, l: sector.record.matches.label, ref: sector.record.matches.source.ref }, { v: 1, l: "verified", ref: "GET /arena/normie/7141 → roundsPlayed" })
    assert.deepEqual({ v: sector.record.wins.value, l: sector.record.wins.label }, { v: 0, l: "verified" })
    assert.deepEqual({ v: sector.record.losses.value, r: sector.record.losses.pending_reason }, { v: null, r: "the official data doesn't publish losses" })
    assert.deepEqual({ v: sector.record.pixels_net.value, r: sector.record.pixels_net.pending_reason }, { v: null, r: "NCH doesn't show Arena #PIXEL amounts" })
    assert.equal(sector.record.last_match_at.value, null)
    assert.deepEqual(sector.rank, { ranked: false, score: null, reason: ARENA_RANK_OFF_REASON })
  })
  it("Arena level, balance and #PIXEL amounts are never shown, even when they are not zero (synthetic values)", async () => {
    const rich = { ...ZULO, level: "987654", balance: "876543", pixelsWon: "765432", pixelsCharged: "654321", pixelsRefunded: "543210", deposited: "432109", withdrawn: "321098" }
    const { sector } = await live(7141, { "/arena/normie/7141": ok(rich) })
    const json = JSON.stringify(sector)
    for (const n of ["987654", "876543", "765432", "654321", "543210", "432109", "321098"]) assert.equal(json.includes(n), false, n)
    assert.doesNotMatch(json, /pixelsWon|pixelsCharged|pixelsRefunded|balance|deposited|withdrawn|"level"/)
  })
  it("ranking is off until 10 rounds, 5 opponents and 14 days: even 50 rounds stays unranked without opponent data", async () => {
    assert.deepEqual(ARENA_RANK_MINIMUM, { rounds: 10, opponents: 5, days: 14 })
    const { sector } = await live(7141, { "/arena/normie/7141": ok({ ...ZULO, roundsPlayed: 50, wins: 40, lastRound: 50 }) })
    assert.equal(sector.status, "unranked")
    assert.deepEqual(sector.rank, { ranked: false, score: null, reason: "Ranking is off until 10 rounds, 5 opponents and 14 days of official results" })
  })
  it("a burned Normie (synthetic burned=true) is read the same way: the parser doesn't use the flag and invents nothing from it", async () => {
    const { sector } = await live(7141, { "/arena/normie/7141": ok({ ...ZULO, burned: true }) })
    assert.equal(sector.status, "unranked")
    assert.equal(sector.record.matches.value, 1)
    assert.doesNotMatch(JSON.stringify(sector), /burn/i)
  })
})

describe("the round in progress (GET /arena/status, read once per card)", () => {
  it("open round that Zulo last played: 'Playing Round 1 now', wins shown but labelled round in progress", async () => {
    const { sector, asked } = await live(7141, { "/arena/normie/7141": ok(ZULO), "/arena/status": ok(STATUS_OPEN) })
    assert.equal(sector.status, "unranked")
    assert.equal(sector.status_text, "Playing Round 1 now: 1 round counted so far")
    assert.deepEqual({ v: sector.record.wins.value, l: sector.record.wins.label }, { v: 0, l: "round in progress" })
    assert.deepEqual({ v: sector.record.matches.value, l: sector.record.matches.label }, { v: 1, l: "verified" })
    assert.deepEqual(asked, ["/arena/normie/7141", "/arena/status"], "exactly one status read")
    assert.deepEqual(sector.rank, { ranked: false, score: null, reason: ARENA_RANK_OFF_REASON })
  })
  it("ended round: back to 'Building a record', wins verified", async () => {
    const { sector } = await live(7141, { "/arena/normie/7141": ok(ZULO), "/arena/status": ok(withRound({ ended: true, status: "ended" })) })
    assert.equal(sector.status_text, "Building a record: 1 round played")
    assert.equal(sector.record.wins.label, "verified")
  })
  it("an open round that isn't the one this Normie last played: 'Building a record'", async () => {
    const { sector } = await live(7141, { "/arena/normie/7141": ok(ZULO), "/arena/status": ok({ ...withRound({ round: 2 }), currentRound: 2 }) })
    assert.equal(sector.status_text, "Building a record: 1 round played")
  })
  it("status unavailable (throws or 500): 'Building a record', and the card still builds", async () => {
    for (const reply of ["throws", { status: 500, body: { error: "boom" } }] as Reply[]) {
      const { sector } = await live(7141, { "/arena/normie/7141": ok(ZULO), "/arena/status": reply })
      assert.equal(sector.status, "unranked")
      assert.equal(sector.status_text, "Building a record: 1 round played")
      assert.equal(sector.record.wins.label, "verified")
    }
  })
  it("malformed status is unknown, never a guess", async () => {
    const bad: unknown[] = [
      null,
      [],
      { ...STATUS_OPEN, currentRound: "one" },
      { ...STATUS_OPEN, currentRound: 1.5 },
      { ...STATUS_OPEN, round: null },
      withRound({ round: "1x" }),
      withRound({ started: "true" }),
      withRound({ ended: 0 }),
      withRound({ status: 1 }),
      withRound({ ended: undefined }),
    ]
    for (const body of bad) {
      assert.equal(parseArenaLiveRound(body), null, JSON.stringify(body))
      const { sector } = await live(7141, { "/arena/normie/7141": ok(ZULO), "/arena/status": ok(body) })
      assert.equal(sector.status_text, "Building a record: 1 round played", JSON.stringify(body))
    }
  })
  it("parseArenaLiveRound reads the live response", () => {
    assert.deepEqual(parseArenaLiveRound(STATUS_OPEN), { current: 1, open: true })
    assert.deepEqual(parseArenaLiveRound(withRound({ ended: true })), { current: 1, open: false })
    assert.deepEqual(parseArenaLiveRound(withRound({ started: false })), { current: 1, open: false })
  })
  it("the status response's prize and pool fields are never read (they throw if touched)", async () => {
    const body: Record<string, unknown> = JSON.parse(JSON.stringify(STATUS_OPEN))
    const round = body.round as Record<string, unknown>
    for (const [obj, key] of [[body, "prizes"], [body, "pool"], [body, "prizePool"], [round, "prizes"], [round, "pool"], [round, "sponsorship"], [round, "fees"]] as const) {
      Object.defineProperty(obj, key, { enumerable: false, get() { throw new Error(`read ${key}`) } })
    }
    const { sector } = await live(7141, { "/arena/normie/7141": ok(ZULO), "/arena/status": ok(body) })
    assert.equal(sector.status_text, "Playing Round 1 now: 1 round counted so far")
    assert.doesNotMatch(JSON.stringify(sector), /prize|pool|payout|sponsor/i)
  })
})

describe("registered or entered but no round counted yet (synthetic)", () => {
  it("registered and waiting for a seat (not in the current round, zero rounds): Registered, not 'Not entered'", async () => {
    const { sector } = await live(7141, { "/arena/normie/7141": ok(REGISTERED_WAITING), "/arena/status": "throws" })
    assert.equal(sector.status, "entered")
    assert.equal(sector.status_text, "Registered. It plays from Round 1. It hasn't played a round yet, so there's no record")
    assert.equal(sector.watch_url, "https://arena.normies.art/world/pixel?follow=7141")
    assert.deepEqual({ v: sector.entry?.entered.value, l: sector.entry?.entered.label }, { v: true, l: "verified" })
    for (const f of Object.values(sector.record)) assert.equal(f.pending_reason, "no rounds played yet")
  })
  it("in the current round with zero rounds played and not registered: Entered", async () => {
    const { sector } = await live(7141, { "/arena/normie/7141": ok({ ...ENTERED_NOT_PLAYED, registered: false }), "/arena/status": "throws" })
    assert.equal(sector.status_text, "Entered. It hasn't played a round yet, so there's no record")
  })
  it("registered while round 1 was open (registeredRound 1): plays from Round 2, per llms.txt", async () => {
    const { sector } = await live(7141, { "/arena/normie/7141": ok({ ...REGISTERED_WAITING, registeredRound: 1 }), "/arena/status": ok(STATUS_OPEN) })
    assert.equal(sector.status_text, "Registered. It plays from Round 2. It hasn't played a round yet, so there's no record")
  })
  it("in the current round with zero rounds played: no record, no line position", async () => {
    const { sector } = await live(7141, { "/arena/normie/7141": ok(ENTERED_NOT_PLAYED), "/arena/status": "throws" })
    assert.equal(sector.status, "entered")
    assert.equal(sector.status_text, "Registered. It plays from Round 1. It hasn't played a round yet, so there's no record")
    assert.equal(sector.entry?.line_position.pending_reason, NOT_IN_OFFICIAL_DATA)
    for (const [name, f] of Object.entries(sector.record)) assert.equal(f.pending_reason, "no rounds played yet", name)
    assert.doesNotMatch(JSON.stringify(sector), /line position|in line|place \d/i)
  })
})

describe("Normie not entered (synthetic, live shape)", () => {
  it("says not entered, with pending fields", async () => {
    const { sector, asked } = await live(4242, { "/arena/normie/4242": ok(NOT_ENTERED), "/arena/status": ok(STATUS) })
    assert.equal(sector.status, "not_entered")
    assert.equal(sector.status_text, "Not entered in Arena")
    assert.equal(sector.watch_url, undefined, "no watch link for a Normie that isn't in the Arena")
    assert.equal(sector.entry?.entered.value, false)
    assert.equal(sector.entry?.entered.label, "verified")
    assert.equal(sector.entry?.line_position.pending_reason, NOT_IN_OFFICIAL_DATA)
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
    ["registered is not a boolean", ok({ ...ZULO, registered: "true" })],
    ["inCurrentRound is missing", ok({ ...ZULO, inCurrentRound: undefined })],
    ["lastRound is missing after rounds were played", ok({ ...ZULO, lastRound: null })],
    ["the old launch-weekend shape (inLine, ticket, position)", ok(ZULO_V1)],
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
  it("parseArenaNormie reads the live response; line, position and needs-funds are null, never inferred", () => {
    assert.deepEqual(parseArenaNormie(ZULO, 7141), { entered: true, registered: true, in_line: null, position: null, needs_funds: null, rounds_played: 1, wins: 0, last_round: 1, block: 26421529, state: "active", registered_round: 0, agent_id: 32626, skins: 1 })
    assert.deepEqual(parseArenaNormie(NOT_ENTERED, 4242), { entered: false, registered: false, in_line: null, position: null, needs_funds: null, rounds_played: 0, wins: 0, last_round: null, block: 26421529, state: "unregistered", registered_round: 0, agent_id: null, skins: 0 })
    assert.equal(parseArenaNormie(REGISTERED_WAITING, 7141)?.entered, true)
  })
  it("whole numbers may be strings or numbers", () => {
    assert.equal(parseArenaNormie({ ...ZULO, roundsPlayed: "3", wins: 2, lastRound: "4" }, 7141)?.rounds_played, 3)
    assert.equal(parseArenaNormie({ ...ZULO, roundsPlayed: 1.5 }, 7141), null)
    assert.equal(parseArenaNormie({ ...ZULO, wins: -1 }, 7141), null)
  })
  it("the old launch-weekend shape is refused, not half-read", () => {
    assert.equal(parseArenaNormie(ZULO_V1, 7141), null)
    assert.equal(parseArenaNormie(NOT_ENTERED_V1, 4242), null)
  })
  it("wins greater than rounds played is refused", () => {
    assert.equal(parseArenaNormie({ ...ZULO, roundsPlayed: 1, wins: 2 }, 7141), null)
  })
  it("state, registeredRound, agentId and skins: read when well-typed, unknown (null) otherwise, never failing the parse", () => {
    const odd = parseArenaNormie({ ...ZULO, state: "sleeping", registeredRound: "soon", agentId: { id: 1 }, skins: -2 }, 7141)
    assert.ok(odd)
    assert.deepEqual([odd.state, odd.registered_round, odd.agent_id, odd.skins], [null, null, null, null])
    for (const state of ["unregistered", "active", "short", "cleared"]) assert.equal(parseArenaNormie({ ...ZULO, state }, 7141)?.state, state)
  })
  it("burned=true parses like any other answer (the flag isn't used)", () => {
    assert.deepEqual(parseArenaNormie({ ...ZULO, burned: true }, 7141), parseArenaNormie(ZULO, 7141))
  })
  it("parseAnyRoundStarted", () => {
    assert.equal(parseAnyRoundStarted({ currentRound: 1, totals: { roundsStarted: 1 } }), true)
    assert.equal(parseAnyRoundStarted({ currentRound: 0, totals: { roundsStarted: 0 } }), false)
    assert.equal(parseAnyRoundStarted({}), null)
    assert.equal(parseAnyRoundStarted(null), null)
  })
})

describe("the card and the wiring", () => {
  it("one official adapter is registered, reading through the polite Arena client (lib/arena-api.ts)", () => {
    assert.equal(ARENA_SOURCES.length, 1)
    assert.equal(ARENA_SOURCES[0].kind, "official_api")
    assert.equal(ARENA_SOURCES[0].ref(7141), "GET /arena/normie/7141")
    const src = readFileSync("lib/record-card/arena.ts", "utf8")
    assert.match(src, /const r = await arenaGet\(path\)/)
    assert.doesNotMatch(src, /fetchWithTimeout|fetch\(/, "no direct fetch: every read goes through the polite client")
    assert.doesNotMatch(src, /method: "(POST|PUT|PATCH|DELETE)"|writeContract|sendTransaction|signTypedData/)
  })
  it("while Arena is not LIVE nothing is called", async () => {
    const a = api({ "/arena/normie/7141": ok(ZULO) })
    const s = await loadArenaSector(7141, NOW, { status: "COMING_SOON", sources: [a.source] })
    assert.equal(s.status, "not_live")
    assert.deepEqual(a.asked, [])
  })
  it("the record card for Zulo shows the live record with no line position and no invented numbers", async () => {
    const { sector } = await live(7141, { "/arena/normie/7141": ok(ZULO) })
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
    assert.equal(card.sectors.arena.status, "unranked")
    assert.equal(card.sectors.arena.status_text, "Building a record: 1 round played")
    assert.equal(card.sectors.arena.record.matches.value, 1)
    assert.equal(card.sectors.arena.record.wins.value, 0)
    assert.doesNotMatch(JSON.stringify(card.sectors.arena), /line position|353/)
  })
})
