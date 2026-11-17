// Arena skill rank, step 1, against a real official response pinned in lib/arena-rank/fixtures/arena-records-rounds.json
// (GET /arena/records?sort=rounds, read 2026-11-17, trimmed to its first 5 rows, owner addresses replaced). Every real
// row has 1 round and an agent, so cases with more rounds, no agent, or a second page are synthetic and say so.
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"

import sitemap from "@/app/sitemap"
import { resolveArenaPath } from "@/lib/arena-api"
import { ARENA_RANK_MINIMUM, ARENA_RANK_OFF_REASON } from "@/lib/record-card/arena"

import {
  ARENA_RANK_LABEL,
  ARENA_RANK_MAX_HISTORY_READS,
  ARENA_RANK_MAX_PAGES,
  ARENA_RANK_MINIMUM_TEXT,
  ARENA_RANK_ORDER_TEXT,
  arenaAgents,
  arenaRankCacheControl,
  arenaRankCoverageText,
  arenaRankResponse,
  arenaRankStatus,
  arenaRankText,
  daysSince,
  parseArenaRecords,
  readArenaRecords,
} from "./core"
import { firstRoundFrom, loadArenaRank } from "./load"

const NOW = new Date("2026-11-17T05:00:00.000Z")
const json = (path: string): unknown => JSON.parse(readFileSync(path, "utf8"))
const RECORDS = json("lib/arena-rank/fixtures/arena-records-rounds.json") as { sort: string; normies: Record<string, unknown>[]; hasMore: boolean }
const ROUNDS_7141 = json("lib/record-card/fixtures/arena-normie-7141-rounds.json") as { rounds: Record<string, unknown>[] }
const ROW = RECORDS.normies[0]
const row = (over: Record<string, unknown>) => ({ ...ROW, ...over })
const page = (normies: unknown[], hasMore = false) => ({ sort: "rounds", normies, hasMore })
const P1 = "/arena/records?sort=rounds"

type Reply = { status: number; body: unknown } | "throws"
function stub(replies: Record<string, Reply>) {
  const asked: string[] = []
  const get = async (path: string) => {
    asked.push(path)
    const r = replies[path]
    if (!r || r === "throws") throw new Error("connection refused: upstream-secret-detail")
    return r
  }
  return { get, asked }
}
const ok = (body: unknown): Reply => ({ status: 200, body })
const load = (replies: Record<string, Reply>, now = NOW) => {
  const s = stub(replies)
  return loadArenaRank({ get: s.get, now: () => now }).then((result) => ({ result, asked: s.asked }))
}
/** Synthetic round history: `n` finished rounds the Normie played, the first one starting at `firstIso`. */
const history = (tokenId: number, n: number, firstIso: string, hasMore = false) => ({
  tokenId: String(tokenId),
  rounds: Array.from({ length: n }, (_, i) => ({ ...ROUNDS_7141.rounds[0], round: i + 1, status: "ended", played: true, timestamp: String(Math.floor(Date.parse(firstIso) / 1000) + i * 86_400) })),
  hasMore,
})

const AMOUNTS = /pixelsWon|balance|prize|pool|payout|refund|#?PIXEL|\bPX\b/i

describe("the pinned real response is what the code expects (field names seen, not guessed)", () => {
  it("/arena/records?sort=rounds: sort, normies, hasMore; each row has the counts and an agent", () => {
    assert.equal(RECORDS.sort, "rounds")
    assert.equal(RECORDS.normies.length, 5)
    for (const r of RECORDS.normies) for (const key of ["tokenId", "roundsPlayed", "wins", "lastRound", "agentId"]) assert.ok(key in r, key)
  })
  it("the fixture holds no real wallet address", () => {
    for (const hex of JSON.stringify(RECORDS).match(/0x[0-9a-fA-F]{40}/g) ?? []) assert.match(hex, /^0x(.)\1{39}$/, hex)
  })
  it("parses to five agents with 1 round and 0 wins each; owner and pixelsWon are not read", () => {
    const parsed = parseArenaRecords(RECORDS)
    assert.deepEqual(parsed?.rows, [
      { tokenId: 1, agentId: 32813, roundsPlayed: 1, wins: 0, lastRound: 1 },
      { tokenId: 2, agentId: 50840, roundsPlayed: 1, wins: 0, lastRound: 1 },
      { tokenId: 3, agentId: 54336, roundsPlayed: 1, wins: 0, lastRound: 1 },
      { tokenId: 31, agentId: 56459, roundsPlayed: 1, wins: 0, lastRound: 1 },
      { tokenId: 33, agentId: 56504, roundsPlayed: 1, wins: 0, lastRound: 1 },
    ])
    assert.equal(parsed?.hasMore, true)
  })
})

describe("one minimum, shared with the record card", () => {
  it("is 10 rounds and 14 days since the first round, with no opponents rule", () => {
    assert.deepEqual(ARENA_RANK_MINIMUM, { rounds: 10, days: 14 })
    assert.equal(ARENA_RANK_OFF_REASON, "Ranking is off until 10 rounds and 14 days since its first round, from official results")
    assert.match(ARENA_RANK_MINIMUM_TEXT, /^Minimum before any rank: 10 rounds played and 14 days since the Normie's first round, plus the trust gate/)
  })
  it("the rank code imports it and defines no minimum of its own", () => {
    for (const file of ["lib/arena-rank/core.ts", "lib/arena-rank/load.ts", "app/arena/rank/page.tsx", "app/api/arena-rank/route.ts"]) {
      const src = readFileSync(file, "utf8")
      assert.doesNotMatch(src, /MINIMUM[A-Z_]*\s*=\s*\{?\s*\d|\brounds:\s*\d|\bdays:\s*\d|>=\s*1[04]\b|<\s*1[04]\b/, file)
    }
    assert.match(readFileSync("lib/arena-rank/core.ts", "utf8"), /import \{ ARENA_RANK_MINIMUM \} from "@\/lib\/record-card\/arena"/)
    const record = readFileSync("app/record/[tokenId]/page.tsx", "utf8")
    assert.ok(record.includes("{ARENA_RANK_MINIMUM.rounds} verified rounds and {ARENA_RANK_MINIMUM.days} days since its first round"))
    assert.doesNotMatch(record, /opponents/)
  })
})

describe("parseArenaRecords is strict", () => {
  it("refuses a malformed body", () => {
    for (const bad of [null, [], "x", { ...RECORDS, sort: "wins" }, { ...RECORDS, sort: undefined }, { ...RECORDS, normies: {} }, { ...RECORDS, hasMore: "true" }, { sort: "rounds", normies: [] }, page([], true)]) {
      assert.equal(parseArenaRecords(bad), null, JSON.stringify(bad)?.slice(0, 60))
    }
    assert.deepEqual(parseArenaRecords(page([])), { rows: [], hasMore: false })
  })
  it("refuses a malformed row, and a Normie listed twice", () => {
    for (const over of [{ tokenId: "x" }, { tokenId: 10000 }, { tokenId: -1 }, { roundsPlayed: "1.0" }, { roundsPlayed: null }, { wins: 2 }, { wins: "many" }, { lastRound: null }, { lastRound: "one" }]) {
      assert.equal(parseArenaRecords(page([row(over)])), null, JSON.stringify(over))
    }
    assert.equal(parseArenaRecords(page([ROW, row({ tokenId: 1 })])), null)
    assert.equal(parseArenaRecords(page(["row"])), null)
  })
  it("numbers may be whole numbers or digit strings", () => {
    assert.deepEqual(parseArenaRecords(page([row({ tokenId: 7, roundsPlayed: "12", wins: "3", lastRound: "12", agentId: 99 })]))?.rows, [
      { tokenId: 7, agentId: 99, roundsPlayed: 12, wins: 3, lastRound: 12 },
    ])
  })
  it("synthetic: a row with no agent is kept as 'no agent' and left off the list (agents only)", () => {
    const rows = [row({ tokenId: 5, agentId: null }), row({ tokenId: 6, agentId: "0" }), row({ tokenId: 7, agentId: undefined }), row({ tokenId: 8, agentId: "abc" }), row({ tokenId: 9, agentId: 0 }), row({ tokenId: 10 })]
    const parsed = parseArenaRecords(page(rows))
    assert.deepEqual(parsed?.rows.map((r) => r.agentId), [null, null, null, null, null, 32813])
    assert.deepEqual(arenaAgents(parsed?.rows ?? []).map((r) => r.tokenId), [10])
  })
  it("amounts and wallets never change the answer", () => {
    assert.deepEqual(parseArenaRecords(page([row({ pixelsWon: "777123", owner: "0x9999999999999999999999999999999999999999" })])), parseArenaRecords(page([ROW])))
  })
})

describe("readArenaRecords: at most 2 pages by offset, sorted here", () => {
  it("the caps are named constants", () => {
    assert.equal(ARENA_RANK_MAX_PAGES, 2)
    assert.ok(ARENA_RANK_MAX_HISTORY_READS > 0 && ARENA_RANK_MAX_HISTORY_READS <= 10)
  })
  it("the real response says there is more: a second page is asked for by offset, then it stops", async () => {
    const second = page([row({ tokenId: 40 }), row({ tokenId: 41 })], true)
    const s = stub({ [P1]: ok(RECORDS), [`${P1}&offset=5`]: ok(second), [`${P1}&offset=7`]: ok(page([row({ tokenId: 50 })])) })
    const read = await readArenaRecords(s.get)
    assert.deepEqual(s.asked, [P1, `${P1}&offset=5`])
    assert.ok(read.kind === "ok")
    assert.equal(read.rows.length, 7)
    assert.equal(read.complete, false)
    assert.equal(read.pages, 2)
    for (const p of s.asked) assert.ok(resolveArenaPath(p), p)
  })
  it("synthetic: whatever order the list comes in, agents are sorted by rounds played, then Normie number", () => {
    const rows = parseArenaRecords(page([row({ tokenId: 9, roundsPlayed: 2, lastRound: 2 }), row({ tokenId: 4, roundsPlayed: 12, lastRound: 12, wins: 1 }), row({ tokenId: 3, roundsPlayed: 2, lastRound: 2, wins: 2 })]))?.rows ?? []
    assert.deepEqual(arenaAgents(rows).map((r) => r.tokenId), [4, 3, 9], "wins never decide the order below the minimum")
  })
  it("404 is 'not found'; an error, a 500, a bad body, or a failed or repeating second page is 'couldn't read'", async () => {
    assert.deepEqual(await readArenaRecords(stub({ [P1]: { status: 404, body: null } }).get), { kind: "not_found" })
    assert.deepEqual(await readArenaRecords(stub({}).get), { kind: "unavailable" })
    assert.deepEqual(await readArenaRecords(stub({ [P1]: { status: 500, body: null } }).get), { kind: "unavailable" })
    assert.deepEqual(await readArenaRecords(stub({ [P1]: ok({ normies: "nope" }) }).get), { kind: "unavailable" })
    assert.deepEqual(await readArenaRecords(stub({ [P1]: ok(RECORDS) }).get), { kind: "unavailable" })
    assert.deepEqual(await readArenaRecords(stub({ [P1]: ok(RECORDS), [`${P1}&offset=5`]: ok(page([ROW])) }).get), { kind: "unavailable" })
  })
})

describe("today's real data: nobody is ranked, everyone reads 'not enough rounds yet'", () => {
  const replies = { [P1]: ok({ ...RECORDS, hasMore: false }) }
  it("all five agents are listed with raw counts beside them, none ranked", async () => {
    const { result, asked } = await load(replies)
    assert.ok(result.kind === "ok")
    assert.deepEqual(result.normies.map((n) => [n.token_id, n.agent_id, n.rounds_played, n.wins, n.status_text, n.rank, n.record_path]), [
      [1, 32813, 1, 0, "Not enough rounds yet", null, "/record/1"],
      [2, 50840, 1, 0, "Not enough rounds yet", null, "/record/2"],
      [3, 54336, 1, 0, "Not enough rounds yet", null, "/record/3"],
      [31, 56459, 1, 0, "Not enough rounds yet", null, "/record/31"],
      [33, 56504, 1, 0, "Not enough rounds yet", null, "/record/33"],
    ])
    assert.deepEqual(result.counts, { listed: 5, ranked: 0, not_enough_rounds: 5, first_round_unchecked: 0, not_enough_days: 0, gate_unchecked: 0 })
    assert.equal(arenaRankText(result), "No agent is ranked yet: all 5 listed have not enough rounds yet")
    assert.deepEqual(asked, [P1], "one Arena read; no round history and no Pulse check when nobody has enough rounds")
  })
  it("the page view makes no Pulse check, chain read or database read: the code can't reach them", () => {
    for (const file of ["lib/arena-rank/core.ts", "lib/arena-rank/load.ts", "app/arena/rank/page.tsx", "app/api/arena-rank/route.ts"]) {
      const code = readFileSync(file, "utf8").split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n")
      assert.doesNotMatch(code, /agent-pulse|getAgentPulse|viem|publicClient|supabase|pulse_level|pulseLevel/i, file)
    }
  })
  it("coverage: 100 rows with more to come reads 'the top 100 by rounds played'", () => {
    assert.equal(arenaRankCoverageText({ rows_read: 100, complete: false }), "Covers the top 100 by rounds played; the official list has more")
    assert.equal(arenaRankCoverageText({ rows_read: 5, complete: true }), "Covers all 5 Normies in the official records list")
  })
})

describe("synthetic: a Normie with enough rounds is still never ranked in step 1", () => {
  const veteran = row({ tokenId: 77, roundsPlayed: 12, lastRound: 12, wins: 9 })
  const records = { [P1]: ok(page([ROW, veteran])) }
  const H = "/arena/normie/77/rounds"
  it("enough rounds and 14 days since its first round: 'Meets the minimum; trust gate not checked yet', rank null", async () => {
    const { result, asked } = await load({ ...records, [H]: ok(history(77, 12, "2026-11-01T00:00:00.000Z")) })
    assert.ok(result.kind === "ok")
    const n = result.normies[0]
    assert.deepEqual([n.token_id, n.status, n.status_text, n.rank, n.first_round_date], [77, "gate_unchecked", "Meets the minimum; trust gate not checked yet", null, "2026-11-01T00:00:00.000Z"])
    assert.equal(result.counts.ranked, 0)
    assert.deepEqual(arenaRankResponse(result).body.ranked, [])
    assert.deepEqual(asked, [P1, H], "its round history is read; the 1-round Normie's is not")
  })
  it("enough rounds but fewer than 14 days: 'not enough days'", async () => {
    const { result } = await load({ ...records, [H]: ok(history(77, 12, "2026-11-04T00:00:00.000Z")) }, new Date("2026-11-17T23:59:59.000Z"))
    assert.ok(result.kind === "ok")
    assert.equal(result.normies[0].status_text, "Enough rounds; not enough days since its first round yet")
  })
  it("the 14th day counts; the day before doesn't", () => {
    const r = { tokenId: 1, agentId: 1, roundsPlayed: 10, wins: 0, lastRound: 10 }
    const first = { kind: "known" as const, date: "2026-11-03T05:00:00.000Z" }
    assert.equal(arenaRankStatus(r, first, NOW), "gate_unchecked")
    assert.equal(arenaRankStatus(r, first, new Date(NOW.getTime() - 1000)), "not_enough_days")
    assert.equal(arenaRankStatus({ ...r, roundsPlayed: 9, lastRound: 9 }, first, NOW), "not_enough_rounds", "days never make up for rounds")
    assert.equal(daysSince("2026-12-01T00:00:00.000Z", NOW), null, "a date in the future is unknown")
    assert.equal(daysSince("soon", NOW), null)
  })
  it("round history that couldn't be read, or is longer than the pages read: 'first-round date not checked yet', never ranked", async () => {
    for (const reply of [undefined, { status: 500, body: null }, ok(history(77, 12, "2026-01-01T00:00:00.000Z", true))] as (Reply | undefined)[]) {
      const { result } = await load(reply ? { ...records, [H]: reply, [`${H}?offset=12`]: ok(history(77, 12, "2026-01-01T00:00:00.000Z", true)) } : records)
      assert.ok(result.kind === "ok")
      assert.equal(result.normies[0].status, "first_round_unchecked")
      assert.equal(result.normies[0].rank, null)
    }
  })
  it("the first round is the earliest round it played, whatever the list's order; unplayed rounds don't count", () => {
    const r = (round: number, date: string, played = true) => ({ round, state: "ended" as const, played, text: "", date })
    const read = { kind: "ok" as const, complete: true, rounds: [r(3, "2026-11-10T00:00:00.000Z"), r(1, "2026-10-01T00:00:00.000Z", false), r(2, "2026-11-05T00:00:00.000Z")] }
    assert.deepEqual(firstRoundFrom(read), { kind: "known", date: "2026-11-05T00:00:00.000Z" })
    assert.deepEqual(firstRoundFrom({ kind: "unavailable" }), { kind: "unknown" })
    assert.deepEqual(firstRoundFrom({ kind: "ok", complete: true, rounds: [] }), { kind: "unknown" })
  })
  it("round-history reads are capped per view; Normies past the cap are 'not checked yet'", async () => {
    const many = Array.from({ length: ARENA_RANK_MAX_HISTORY_READS + 3 }, (_, i) => row({ tokenId: 100 + i, roundsPlayed: 11, lastRound: 11 }))
    const replies: Record<string, Reply> = { [P1]: ok(page(many)) }
    for (const m of many) replies[`/arena/normie/${m.tokenId}/rounds`] = ok(history(m.tokenId as number, 11, "2026-10-01T00:00:00.000Z"))
    const { result, asked } = await load(replies)
    assert.ok(result.kind === "ok")
    assert.equal(asked.filter((p) => p.endsWith("/rounds")).length, ARENA_RANK_MAX_HISTORY_READS)
    assert.equal(result.counts.gate_unchecked, ARENA_RANK_MAX_HISTORY_READS)
    assert.equal(result.counts.first_round_unchecked, 3)
    assert.equal(result.counts.ranked, 0)
  })
})

describe("answers, cache and the API body", () => {
  it("ok, empty, not found and couldn't read are four different answers; only couldn't read is uncached", async () => {
    const results = [
      (await load({ [P1]: ok({ ...RECORDS, hasMore: false }) })).result,
      (await load({ [P1]: ok(page([])) })).result,
      (await load({ [P1]: { status: 404, body: null } })).result,
      (await load({})).result,
    ]
    assert.deepEqual(results.map((r) => r.kind), ["ok", "empty", "not_found", "unavailable"])
    assert.equal(new Set(results.map(arenaRankText)).size, 4)
    assert.deepEqual(results.map((r) => arenaRankResponse(r).status), [200, 200, 404, 503])
    assert.deepEqual(results.map((r) => arenaRankCacheControl(r) === "no-store"), [false, false, false, true])
    assert.match(arenaRankCacheControl(results[0]), /^public, s-maxage=60, /)
  })
  it("synthetic: a list with rows but no agents is 'empty', not an error", async () => {
    assert.equal((await load({ [P1]: ok(page([row({ agentId: null })])) })).result.kind, "empty")
  })
  it("the API body has exactly its fields, the label, the minimum and the rank order, and no amounts or wallets", async () => {
    const rich = { ...RECORDS, hasMore: false, normies: RECORDS.normies.map((n) => ({ ...n, pixelsWon: "777123" })) }
    const { body } = arenaRankResponse((await load({ [P1]: ok(rich) })).result)
    assert.deepEqual(Object.keys(body).sort(), ["as_of", "counts", "coverage", "label", "minimum", "normies", "rank_order", "ranked", "result", "source", "text"])
    assert.deepEqual(Object.keys((body.normies as object[])[0]).sort(), ["agent_id", "first_round_date", "rank", "record_path", "rounds_played", "status", "status_text", "token_id", "wins"])
    assert.equal(body.label, "A track record, never a tip. DYOR.")
    assert.deepEqual(body.minimum, { rounds: 10, days_since_first_round: 14, text: ARENA_RANK_MINIMUM_TEXT })
    assert.equal(body.rank_order, ARENA_RANK_ORDER_TEXT)
    assert.deepEqual(body.source, { kind: "official_api", label: "Official Arena data (api.normies.art)", ref: "GET /arena/records?sort=rounds" })
    const text = JSON.stringify(body)
    assert.doesNotMatch(text, AMOUNTS)
    assert.doesNotMatch(text, /777123|0x[0-9a-fA-F]{40}|\bowner\b|pulse_level|overall/i)
  })
  it("upstream error text never gets out", async () => {
    assert.doesNotMatch(JSON.stringify(arenaRankResponse((await load({})).result)), /connection refused|upstream-secret-detail/)
  })
  it("the rank order is win rate with ties to more rounds, never total wins first", () => {
    assert.match(ARENA_RANK_ORDER_TEXT, /win rate \(wins ÷ rounds played\).*ties go to more rounds played/)
  })
})

describe("the page, the links, the sitemap, llms.txt", () => {
  const page_ = readFileSync("app/arena/rank/page.tsx", "utf8")
  it("is labelled 'A track record, never a tip. DYOR.' and says what it covers and that the order is not a rank", () => {
    assert.equal(ARENA_RANK_LABEL, "A track record, never a tip. DYOR.")
    assert.ok(page_.includes('<p className="burn-tagline">{ARENA_RANK_LABEL}</p>'))
    assert.ok(page_.includes("{arenaRankCoverageText(result.coverage)}"))
    assert.ok(page_.includes("this order is not a rank"))
    assert.ok(page_.includes("{ARENA_STATUS_LINE}"), "the status line is copied from lib/official-status.ts")
    assert.ok(page_.includes("There is no overall rank"))
  })
  it("shows rounds played and wins beside every Normie, and no amounts, wallets, share card or contact feature", () => {
    assert.ok(page_.includes("<td>{n.rounds_played}</td>") && page_.includes("<td>{n.wins}</td>"))
    assert.doesNotMatch(page_, /pixelsWon|balance|prize|payout|owner|0x|share|mailto:|notify|subscribe|textarea|method="post"/i)
  })
  it("is rate-limited, and the API route uses enforceDualRateLimit first", () => {
    assert.ok(page_.includes("checkRateLimitById("))
    const route = readFileSync("app/api/arena-rank/route.ts", "utf8")
    assert.ok(route.indexOf("enforceDualRateLimit(") > 0 && route.indexOf("enforceDualRateLimit(") < route.indexOf("loadArenaRank("))
  })
  it("/arena and /arena/rank link to each other, and both are in the sitemap", () => {
    assert.ok(page_.includes('<a href="/arena">Arena wallet check</a>'))
    assert.ok(readFileSync("app/arena/page.tsx", "utf8").includes('<a href="/arena/rank">Arena rank</a>'))
    const urls = sitemap().map((e) => e.url)
    assert.ok(urls.some((u) => u.endsWith("/arena")) && urls.some((u) => u.endsWith("/arena/rank")))
  })
  it("llms.txt lists the route and the page, with the label and the minimum, and no amounts", () => {
    const txt = readFileSync("public/llms.txt", "utf8")
    const start = txt.indexOf("Arena rank (")
    assert.ok(start >= 0)
    const block = txt.slice(start, txt.indexOf("\n\n", start))
    for (const s of ["GET /api/arena-rank", "Human page: /arena/rank", "a track record, never a tip, DYOR", "10 rounds played and 14 days since its first round", "No agent is ranked yet"]) assert.ok(block.includes(s), s)
    assert.doesNotMatch(block, AMOUNTS)
  })
})
