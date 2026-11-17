// Arena round history, against the real official response pinned in lib/record-card/fixtures/arena-normie-7141-rounds.json
// (GET /arena/normie/7141/rounds, read 2026-11-17: one round, still open; tx hash zeroed). Only that shape has been seen.
// Cases built from it with changed fields ("ended", "cancelled", played: false, a second page) are synthetic and say so.
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"

import { loadArenaSector, officialArenaSource } from "./arena"
import {
  ARENA_ROUND_STATUSES,
  ARENA_ROUNDS_MAX_PAGES,
  ARENA_ROUNDS_SOURCE_LABEL,
  arenaRoundTotals,
  buildArenaRoundHistory,
  parseArenaNormieRounds,
  readArenaRounds,
  wholeNumber,
} from "./arena-rounds"

const NOW = "2026-11-17T00:00:00.000Z"
const fixture = (name: string): unknown => JSON.parse(readFileSync(`lib/record-card/fixtures/${name}.json`, "utf8"))
const ROUNDS = fixture("arena-normie-7141-rounds") as { tokenId: string; rounds: Record<string, unknown>[]; hasMore: boolean }
const ZULO = fixture("arena-normie-7141") as Record<string, unknown>
const STATUS_OPEN = fixture("arena-status-round1-open")
const ROW = ROUNDS.rounds[0]
/** Synthetic: the real row with changed fields. */
const row = (over: Record<string, unknown>) => ({ ...ROW, ...over })
const page = (rounds: unknown[], hasMore = false) => ({ tokenId: "7141", rounds, hasMore })

type Reply = { status: number; body: unknown } | "throws"
function stub(replies: Record<string, Reply>) {
  const asked: string[] = []
  const get = async (path: string) => {
    asked.push(path)
    const r = replies[path]
    if (!r || r === "throws") throw new Error("connection refused")
    return r
  }
  return { get, asked }
}
const ok = (body: unknown): Reply => ({ status: 200, body })
const P1 = "/arena/normie/7141/rounds"

describe("the pinned live response is what the code expects (field names seen, not guessed)", () => {
  it("/arena/normie/7141/rounds (2026-11-17): one open round that Zulo played", () => {
    for (const key of ["tokenId", "rounds", "hasMore"]) assert.ok(key in ROUNDS, key)
    for (const key of ["round", "status", "played", "timestamp"]) assert.ok(key in ROW, key)
    assert.equal(ROW.status, "open")
    assert.equal(ROUNDS.hasMore, false)
  })
  it("the fixture holds no real wallet address or tx hash", () => {
    const text = JSON.stringify(ROUNDS)
    for (const hex of text.match(/0x[0-9a-fA-F]{40,64}/g) ?? []) assert.match(hex, /^0x(.)\1+$/, hex)
  })
  it("parses to one round in progress, with its date and no result", () => {
    const parsed = parseArenaNormieRounds(ROUNDS, 7141)
    assert.deepEqual(parsed, {
      rounds: [{ round: 1, state: "in_progress", played: true, text: "Round in progress", date: "2026-11-16T19:00:23.000Z" }],
      hasMore: false,
    })
  })
})

describe("whole numbers: a whole number, or a string of digits only", () => {
  it("accepts 0, 7 and \"7141\"", () => {
    assert.equal(wholeNumber(0), 0)
    assert.equal(wholeNumber(7), 7)
    assert.equal(wholeNumber("7141"), 7141)
  })
  it("refuses everything else", () => {
    for (const v of [-1, 1.5, Number.NaN, Infinity, "", " 7", "7 ", "+7", "-7", "1.0", "1e3", "0x10", "7a", null, undefined, true, [7], { n: 7 }]) {
      assert.equal(wholeNumber(v), null, String(v))
    }
  })
})

describe("parseArenaNormieRounds is strict", () => {
  it("refuses a body for another Normie, a non-object, a missing list or a missing hasMore", () => {
    assert.equal(parseArenaNormieRounds(ROUNDS, 7142), null)
    assert.equal(parseArenaNormieRounds(null, 7141), null)
    assert.equal(parseArenaNormieRounds([], 7141), null)
    assert.equal(parseArenaNormieRounds({ tokenId: "7141", hasMore: false }, 7141), null)
    assert.equal(parseArenaNormieRounds({ tokenId: "7141", rounds: {}, hasMore: false }, 7141), null)
    assert.equal(parseArenaNormieRounds({ tokenId: "7141", rounds: [] }, 7141), null)
    assert.equal(parseArenaNormieRounds({ tokenId: "7141", rounds: [], hasMore: "false" }, 7141), null)
  })
  it("refuses the page when a row has no whole-number round, or a round appears twice", () => {
    for (const bad of [row({ round: "one" }), row({ round: 1.5 }), row({ round: -1 }), row({ round: null }), "row", null]) {
      assert.equal(parseArenaNormieRounds(page([bad]), 7141), null)
    }
    assert.equal(parseArenaNormieRounds(page([ROW, row({ round: "1" })]), 7141), null)
  })
  it("refuses 'more to come' after an empty page", () => {
    assert.equal(parseArenaNormieRounds(page([], true), 7141), null)
    assert.deepEqual(parseArenaNormieRounds(page([]), 7141), { rounds: [], hasMore: false })
  })
  it("reads the round number as a number or as digits", () => {
    assert.equal(parseArenaNormieRounds(page([row({ round: "12" })]), 7141)?.rounds[0].round, 12)
  })
  it("synthetic: a finished round is 'Played' or 'Did not play', never a win", () => {
    const parsed = parseArenaNormieRounds(page([row({ round: 3, status: "ended" }), row({ round: 2, status: "ended", played: false })]), 7141)
    assert.deepEqual(parsed?.rounds.map((r) => [r.round, r.state, r.text]), [
      [3, "ended", "Played"],
      [2, "ended", "Did not play"],
    ])
  })
  it("synthetic: payoutOrder, prize and refund never change the answer", () => {
    const plain = parseArenaNormieRounds(page([row({ status: "ended" })]), 7141)
    const paid = parseArenaNormieRounds(page([row({ status: "ended", payoutOrder: 1, prize: "150", refund: "5", winners: 3 })]), 7141)
    assert.deepEqual(paid, plain)
    assert.doesNotMatch(JSON.stringify(paid), /win|won|prize|refund|payout|pool|150/i)
  })
  it("synthetic: cancelled and upcoming rounds are shown as the API states them", () => {
    const parsed = parseArenaNormieRounds(page([row({ round: 5, status: "upcoming", played: false }), row({ round: 4, status: "cancelled" })]), 7141)
    assert.deepEqual(parsed?.rounds.map((r) => r.text), ["Not started yet", "Round cancelled"])
  })
  it("only the four known statuses are read", () => {
    assert.deepEqual([...ARENA_ROUND_STATUSES], ["open", "upcoming", "ended", "cancelled"])
  })
  it("any other status, or a played that isn't a boolean, is 'couldn't read this round'", () => {
    for (const bad of [{ status: "finished" }, { status: "settled" }, { status: "OPEN" }, { status: null }, { status: 1 }, { played: "true" }, { played: 1 }, { played: null }]) {
      const parsed = parseArenaNormieRounds(page([row(bad)]), 7141)
      assert.deepEqual(parsed?.rounds, [{ round: 1, state: "unreadable", played: null, text: "Couldn't read this round", date: "2026-11-16T19:00:23.000Z" }], JSON.stringify(bad))
    }
  })
  it("a malformed or missing timestamp gives no date; the round still stands", () => {
    for (const timestamp of [null, undefined, "soon", "1794855623.5", -5, 0, "999999999999999"]) {
      const parsed = parseArenaNormieRounds(page([row({ timestamp })]), 7141)
      assert.equal(parsed?.rounds[0].date, null, String(timestamp))
      assert.equal(parsed?.rounds[0].state, "in_progress")
    }
    assert.equal(parseArenaNormieRounds(page([row({ timestamp: 1794855623 })]), 7141)?.rounds[0].date, "2026-11-16T19:00:23.000Z")
  })
})

describe("readArenaRounds: paging by offset, at most ARENA_ROUNDS_MAX_PAGES pages, sorted here", () => {
  it("the cap is a named constant: 2 pages", () => {
    assert.equal(ARENA_ROUNDS_MAX_PAGES, 2)
  })
  it("the real response: one call, complete", async () => {
    const s = stub({ [P1]: ok(ROUNDS) })
    const read = await readArenaRounds(7141, s.get)
    assert.equal(read.kind, "ok")
    assert.deepEqual(s.asked, [P1])
    assert.equal(read.kind === "ok" && read.complete, true)
  })
  it("synthetic: reads a second page by offset (never ?page=) and sorts newest first whatever the list's order", async () => {
    const s = stub({
      [P1]: ok(page([row({ round: 2, status: "ended" }), row({ round: 4 }), row({ round: 3, status: "ended" })], true)),
      [`${P1}?offset=3`]: ok(page([row({ round: 1, status: "ended", played: false })])),
    })
    const read = await readArenaRounds(7141, s.get)
    assert.deepEqual(s.asked, [P1, `${P1}?offset=3`])
    assert.ok(read.kind === "ok")
    assert.deepEqual(read.rounds.map((r) => r.round), [4, 3, 2, 1])
    assert.equal(read.complete, true)
  })
  it("synthetic: stops after 2 pages and says the list isn't complete", async () => {
    const s = stub({
      [P1]: ok(page([row({ round: 9 }), row({ round: 8, status: "ended" })], true)),
      [`${P1}?offset=2`]: ok(page([row({ round: 7, status: "ended" })], true)),
      [`${P1}?offset=3`]: ok(page([row({ round: 6, status: "ended" })])),
    })
    const read = await readArenaRounds(7141, s.get)
    assert.equal(s.asked.length, ARENA_ROUNDS_MAX_PAGES)
    assert.ok(read.kind === "ok")
    assert.equal(read.complete, false)
    assert.equal(read.rounds.length, 3)
  })
  it("the paths it builds are on the Arena reader's allowlist", async () => {
    const { resolveArenaPath } = await import("@/lib/arena-api")
    assert.ok(resolveArenaPath(P1))
    assert.ok(resolveArenaPath(`${P1}?offset=50`))
  })
  it("404 is 'not found'; an error, a 500, a bad body or a bad token id is 'couldn't read'", async () => {
    assert.deepEqual(await readArenaRounds(7141, stub({ [P1]: { status: 404, body: null } }).get), { kind: "not_found" })
    assert.deepEqual(await readArenaRounds(7141, stub({ [P1]: "throws" }).get), { kind: "unavailable" })
    assert.deepEqual(await readArenaRounds(7141, stub({ [P1]: { status: 500, body: null } }).get), { kind: "unavailable" })
    assert.deepEqual(await readArenaRounds(7141, stub({ [P1]: ok({ rounds: "nope" }) }).get), { kind: "unavailable" })
    const s = stub({})
    assert.deepEqual(await readArenaRounds(10000, s.get), { kind: "unavailable" })
    assert.deepEqual(await readArenaRounds(1.5, s.get), { kind: "unavailable" })
    assert.deepEqual(s.asked, [], "a bad token id never reaches the URL")
  })
  it("synthetic: a second page that can't be read, or repeats a round, makes the whole answer 'couldn't read'", async () => {
    const first = ok(page([row({ round: 2 })], true))
    assert.deepEqual(await readArenaRounds(7141, stub({ [P1]: first }).get), { kind: "unavailable" })
    assert.deepEqual(await readArenaRounds(7141, stub({ [P1]: first, [`${P1}?offset=1`]: { status: 404, body: null } }).get), { kind: "unavailable" })
    assert.deepEqual(await readArenaRounds(7141, stub({ [P1]: first, [`${P1}?offset=1`]: ok(page([row({ round: 2 })])) }).get), { kind: "unavailable" })
  })
  it("an empty list is 'ok' with no rounds, not 'couldn't read'", async () => {
    assert.deepEqual(await readArenaRounds(7141, stub({ [P1]: ok(page([])) }).get), { kind: "ok", rounds: [], complete: true })
  })
})

describe("totals and the card block", () => {
  it("the real response: 1 listed, 1 in progress, nothing counted as played or finished", () => {
    const parsed = parseArenaNormieRounds(ROUNDS, 7141)
    assert.deepEqual(arenaRoundTotals(parsed?.rounds ?? []), { listed: 1, played: 0, did_not_play: 0, in_progress: 1, cancelled: 0, not_started: 0, unreadable: 0 })
  })
  it("synthetic: the counts add up to the rounds listed", () => {
    const rows = [row({ round: 6 }), row({ round: 5, status: "ended" }), row({ round: 4, status: "ended", played: false }), row({ round: 3, status: "cancelled" }), row({ round: 2, status: "upcoming" }), row({ round: 1, status: "??" })]
    const t = arenaRoundTotals(parseArenaNormieRounds(page(rows), 7141)?.rounds ?? [])
    assert.deepEqual(t, { listed: 6, played: 1, did_not_play: 1, in_progress: 1, cancelled: 1, not_started: 1, unreadable: 1 })
    assert.equal(t.played + t.did_not_play + t.in_progress + t.cancelled + t.not_started + t.unreadable, t.listed)
  })
  it("ok, empty, not found and couldn't read are four different answers", () => {
    const parsed = parseArenaNormieRounds(ROUNDS, 7141)
    const okBlock = buildArenaRoundHistory(7141, { kind: "ok", rounds: parsed?.rounds ?? [], complete: true }, NOW)
    assert.equal(okBlock.status, "ok")
    assert.equal(okBlock.status_text, "1 round listed")
    assert.deepEqual(okBlock.source, { kind: "official_api", ref: "GET /arena/normie/7141/rounds", label: "Official Arena data (api.normies.art)" })
    assert.equal(ARENA_ROUNDS_SOURCE_LABEL, "Official Arena data (api.normies.art)")
    assert.equal(okBlock.as_of, NOW)
    const empty = buildArenaRoundHistory(7141, { kind: "ok", rounds: [], complete: true }, NOW)
    assert.equal(empty.status, "empty")
    assert.equal(empty.totals?.listed, 0)
    const missing = buildArenaRoundHistory(7141, { kind: "not_found" }, NOW)
    assert.equal(missing.status, "not_found")
    const failed = buildArenaRoundHistory(7141, { kind: "unavailable" }, NOW)
    assert.equal(failed.status, "unavailable")
    assert.equal(failed.status_text, "Couldn't read the round list right now")
    assert.equal(failed.totals, null, "no counts, not zeros, when the list couldn't be read")
    assert.equal(failed.complete, null)
    assert.deepEqual(failed.rounds, [])
  })
})

describe("on the record card's Arena sector", () => {
  const sector = (replies: Record<string, Reply>, tokenId = 7141) => {
    const s = stub(replies)
    return loadArenaSector(tokenId, NOW, { status: "LIVE", sources: [officialArenaSource(s.get)] }).then((arena) => ({ arena, asked: s.asked }))
  }
  it("Zulo, from the three real responses: Round 1 in progress, wins still only from /arena/normie", async () => {
    const { arena, asked } = await sector({ "/arena/normie/7141": ok(ZULO), "/arena/status": ok(STATUS_OPEN), [P1]: ok(ROUNDS) })
    assert.deepEqual(asked, ["/arena/normie/7141", "/arena/status", P1])
    assert.equal(arena.round_history?.status, "ok")
    assert.deepEqual(arena.round_history?.rounds, [{ round: 1, state: "in_progress", played: true, text: "Round in progress", date: "2026-11-16T19:00:23.000Z" }])
    assert.equal(arena.round_history?.totals?.in_progress, 1)
    assert.equal(arena.record.wins.value, 0)
    assert.match(arena.record.wins.source.ref, /GET \/arena\/normie\/7141 → wins/)
    assert.equal(arena.record.wins.label, "round in progress")
  })
  it("the block carries no prize, pool, payout, refund or #PIXEL wording, and no per-round win", async () => {
    const { arena } = await sector({ "/arena/normie/7141": ok(ZULO), "/arena/status": ok(STATUS_OPEN), [P1]: ok(ROUNDS) })
    const text = JSON.stringify(arena.round_history)
    assert.doesNotMatch(text, /prize|pool|payout|refund|pixel|charged|win|won/i)
  })
  it("a failed round-list read doesn't fail the sector and isn't shown as empty", async () => {
    const { arena } = await sector({ "/arena/normie/7141": ok(ZULO), "/arena/status": ok(STATUS_OPEN) })
    assert.equal(arena.status, "unranked")
    assert.equal(arena.record.matches.value, 1)
    assert.equal(arena.round_history?.status, "unavailable")
    assert.equal(arena.round_history?.totals, null)
  })
  it("synthetic: a Normie that isn't entered gets no round-list call and no block", async () => {
    const notEntered = { ...ZULO, tokenId: "4242", state: "unregistered", registered: false, agentId: null, skins: 0, roundsPlayed: 0, lastRound: null, wins: 0, inCurrentRound: false }
    const { arena, asked } = await sector({ "/arena/normie/4242": ok(notEntered), "/arena/status": ok(STATUS_OPEN) }, 4242)
    assert.equal(arena.status, "not_entered")
    assert.equal(arena.round_history, undefined)
    assert.ok(!asked.some((p) => p.endsWith("/rounds")))
  })
  it("when the Normie itself can't be read, the round list isn't asked for", async () => {
    const { arena, asked } = await sector({})
    assert.equal(arena.status, "source_pending")
    assert.equal(arena.round_history, undefined)
    assert.deepEqual(asked, ["/arena/normie/7141"])
  })
  it("Arena not LIVE: nothing is called", async () => {
    const s = stub({})
    const arena = await loadArenaSector(7141, NOW, { status: "COMING_SOON", sources: [officialArenaSource(s.get)] })
    assert.equal(arena.round_history, undefined)
    assert.deepEqual(s.asked, [])
  })
})
