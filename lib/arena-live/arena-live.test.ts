// The live Arena feed, against three real responses from the Arena site pinned in lib/arena-live/fixtures/ (read
// 2026-11-18, one call each): standing-7141.json, normie-7141.json and arena-week.json. They hold no wallet address.
// Only `where: "resting"` and `phase: "live"` have been seen; cases with changed fields are synthetic and say so.
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"

import { ARENA_API_DEFAULT_PAUSE_MS, ARENA_API_MAX_BYTES, ARENA_API_REVALIDATE_SECONDS, arenaApiUserAgent } from "@/lib/arena-api"
import { loadArenaSector, officialArenaSource } from "@/lib/record-card/arena"

import { ARENA_LIVE_BASE, ARENA_LIVE_ROUTES, ARENA_LIVE_TIMEOUT_MS, createArenaLiveApi, resolveArenaLivePath, type ArenaLiveResult } from "./api"
import { ARENA_LIVE_UNAVAILABLE_TEXT, buildArenaLive, parseLiveCounts, parseLiveRound, parseLiveStanding } from "./core"
import { loadArenaLive } from "./load"

const NOW = "2026-11-18T01:00:00.000Z"
const json = (path: string): unknown => JSON.parse(readFileSync(path, "utf8"))
const STANDING = json("lib/arena-live/fixtures/standing-7141.json") as Record<string, unknown> & { normies: Record<string, Record<string, unknown>> }
const NORMIE = json("lib/arena-live/fixtures/normie-7141.json") as { ok: boolean; life: Record<string, unknown> & { stats: Record<string, unknown> } }
const WEEK = json("lib/arena-live/fixtures/arena-week.json") as Record<string, unknown>
const RAW = { standing: STANDING, normie: NORMIE, week: WEEK }

const standingRow = (over: Record<string, unknown>) => ({ ...STANDING, normies: { "7141": { ...STANDING.normies["7141"], ...over } } })
const stats = (over: Record<string, unknown>) => ({ ...NORMIE, life: { ...NORMIE.life, stats: { ...NORMIE.life.stats, ...over } } })
/** A copy with one key renamed. */
const renamed = <T extends Record<string, unknown>>(o: T, from: string, to: string) => {
  const { [from]: value, ...rest } = o
  return { ...rest, [to]: value }
}

describe("the pinned live responses are what the code expects (field names and types seen, not guessed)", () => {
  it("standing: ok, game, of, and the Normie's where, rank, px and back, all real numbers", () => {
    assert.equal(STANDING.ok, true)
    for (const key of ["game", "of"]) assert.equal(typeof STANDING[key], "number", key)
    const row = STANDING.normies["7141"]
    assert.equal(row.where, "resting")
    for (const key of ["rank", "px", "back"]) assert.equal(typeof row[key], "number", key)
  })
  it("normie: life.id and the counts under life.stats, all real numbers", () => {
    assert.equal(NORMIE.life.id, 7141)
    for (const key of ["kills", "deaths", "agentKills", "px", "rank", "of"]) assert.equal(typeof NORMIE.life.stats[key], "number", key)
  })
  it("arena-week: game, phase, end, roundPlayers", () => {
    assert.equal(WEEK.phase, "live")
    for (const key of ["game", "end", "start", "roundPlayers"]) assert.equal(typeof WEEK[key], "number", key)
  })
  it("the fixtures hold no wallet address", () => {
    assert.doesNotMatch(JSON.stringify(RAW), /0x[0-9a-fA-F]{40}/)
  })
})

describe("the real responses build the block", () => {
  const live = buildArenaLive(7141, RAW, NOW)
  it("#280 of 748, resting, with its score, counts and the round", () => {
    assert.ok(live.status === "ok")
    assert.equal(live.status_text, "The Arena currently reports #280 of 748")
    assert.deepEqual(live.live_rank, { rank: 280, of: 748, text: "#280 of 748" })
    assert.equal(live.live_score_px, 56452)
    assert.deepEqual([live.where, live.where_text], ["resting", "Resting"])
    assert.deepEqual([live.kills, live.deaths, live.duels_won], [93, 91, 73])
    assert.deepEqual(live.round, { game: 1, phase: "live", ends_at: "2026-11-21T19:00:00.000Z", players: 748 })
    assert.equal(live.back_at, "2026-11-18T00:16:23.391Z")
  })
  it("the round ends on Saturday 20:00 CET, as the official game window says (so `end` is in milliseconds)", () => {
    assert.ok(live.status === "ok")
    const end = new Date(live.round.ends_at)
    assert.equal(end.getUTCDay(), 6)
    assert.equal(end.getUTCHours(), 19)
  })
  it("carries its source, the three routes, the read time and the 'not an NCH rank' note", () => {
    assert.deepEqual(live.source, {
      label: "Arena site live data (arena.normies.art)",
      refs: ["GET /api/world/standing?ids=7141", "GET /api/world/normie/7141", "GET /api/world/arena-week"],
    })
    assert.equal(live.as_of, NOW)
    assert.ok(live.status === "ok")
    assert.equal(live.note, "The Arena's own live standing, as reported. Not an NCH rank. It can change until the round ends.")
  })
  it("has no amounts: nothing from the round's money fields, no ETH or USD, no outside text", () => {
    const text = JSON.stringify(live)
    assert.doesNotMatch(text, /pool|prize|payout|sponsor|entryFee|entryPrice|passPrice|worth|ethUsd|pixelEth|\busd\b|\beth\b|winnerCount|winners/i)
    assert.doesNotMatch(text, /5241|2\.878|1821|0\.01439/, "the response's worth figures never reach the block")
    assert.doesNotMatch(text, /Zulo|Elus|Whiskerwood|Liar|fallen/, "names, titles and story text are never read")
    assert.ok(!("level" in live), "the Canvas level is never part of the Arena block")
  })
})

describe("a renamed or missing field makes the whole block unavailable", () => {
  const unavailable = (raw: { standing: unknown; normie: unknown; week: unknown }, why: string) => {
    const live = buildArenaLive(7141, raw, NOW)
    assert.deepEqual(
      live,
      { status: "unavailable", status_text: "Live Arena data unavailable", source: { label: "Arena site live data (arena.normies.art)", refs: ["GET /api/world/standing?ids=7141", "GET /api/world/normie/7141", "GET /api/world/arena-week"] }, as_of: NOW },
      why,
    )
  }
  it("standing: rank → position, px → score, of → total, where → state, normies → rows, game missing", () => {
    const row = STANDING.normies["7141"]
    for (const [from, to] of [["rank", "position"], ["px", "score"], ["where", "state"]]) {
      unavailable({ ...RAW, standing: { ...STANDING, normies: { "7141": renamed(row, from, to) } } }, `${from} → ${to}`)
    }
    unavailable({ ...RAW, standing: renamed(STANDING, "of", "total") }, "of → total")
    unavailable({ ...RAW, standing: renamed(STANDING, "normies", "rows") }, "normies → rows")
    unavailable({ ...RAW, standing: renamed(STANDING, "game", "gameNo") }, "game → gameNo")
  })
  it("normie: agentKills → duelsWon, kills → slain, deaths missing, stats → totals, life → normie", () => {
    for (const [from, to] of [["agentKills", "duelsWon"], ["kills", "slain"], ["deaths", "falls"]]) {
      unavailable({ ...RAW, normie: { ...NORMIE, life: { ...NORMIE.life, stats: renamed(NORMIE.life.stats, from, to) } } }, `${from} → ${to}`)
    }
    unavailable({ ...RAW, normie: { ...NORMIE, life: renamed(NORMIE.life, "stats", "totals") } }, "stats → totals")
    unavailable({ ...RAW, normie: renamed(NORMIE as unknown as Record<string, unknown>, "life", "normie") }, "life → normie")
  })
  it("arena-week: end → endsAt, roundPlayers → players, phase → stage, game missing", () => {
    for (const [from, to] of [["end", "endsAt"], ["roundPlayers", "players"], ["phase", "stage"], ["game", "gameNo"]]) {
      unavailable({ ...RAW, week: renamed(WEEK, from, to) }, `${from} → ${to}`)
    }
  })
  it("one bad response is enough: the other two never make a part block", () => {
    unavailable({ ...RAW, standing: null }, "no standing")
    unavailable({ ...RAW, normie: [] }, "no normie")
    unavailable({ ...RAW, week: "down" }, "no week")
    unavailable({ standing: { ...STANDING, ok: false }, normie: NORMIE, week: WEEK }, "ok: false")
  })
})

describe("a string where a number was seen makes the whole block unavailable", () => {
  it("standing: rank, px, of, game or back as a string", () => {
    assert.equal(parseLiveStanding(standingRow({ rank: "280" }), 7141), null)
    assert.equal(parseLiveStanding(standingRow({ px: "56452" }), 7141), null)
    assert.equal(parseLiveStanding(standingRow({ back: "1794960983391" }), 7141), null)
    assert.equal(parseLiveStanding({ ...STANDING, of: "748" }, 7141), null)
    assert.equal(parseLiveStanding({ ...STANDING, game: "1" }, 7141), null)
    assert.equal(buildArenaLive(7141, { ...RAW, standing: standingRow({ rank: "280" }) }, NOW).status, "unavailable")
  })
  it("normie: kills, deaths, agentKills or life.id as a string", () => {
    for (const key of ["kills", "deaths", "agentKills"]) assert.equal(parseLiveCounts(stats({ [key]: "93" }), 7141), null, key)
    assert.equal(parseLiveCounts({ ...NORMIE, life: { ...NORMIE.life, id: "7141" } }, 7141), null)
    assert.equal(buildArenaLive(7141, { ...RAW, normie: stats({ agentKills: "73" }) }, NOW).status, "unavailable")
  })
  it("arena-week: game, end or roundPlayers as a string; phase as a number", () => {
    for (const over of [{ game: "1" }, { end: "1795287600000" }, { roundPlayers: "748" }, { phase: 1 }]) {
      assert.equal(parseLiveRound({ ...WEEK, ...over }), null, JSON.stringify(over))
    }
    assert.equal(buildArenaLive(7141, { ...RAW, week: { ...WEEK, end: "1795287600000" } }, NOW).status, "unavailable")
  })
  it("other bad values: decimals, negatives, null, a rank past the field, seconds instead of milliseconds", () => {
    for (const over of [{ rank: 1.5 }, { rank: -1 }, { rank: 0 }, { rank: 749 }, { rank: null }, { px: null }, { where: "arena" }, { where: null }, { back: 1794960983 }]) {
      assert.equal(parseLiveStanding(standingRow(over), 7141), null, JSON.stringify(over))
    }
    for (const over of [{ end: 1795287600 }, { end: null }, { phase: "" }, { phase: "live now!" }, { phase: "<b>live</b>" }, { roundPlayers: -1 }]) {
      assert.equal(parseLiveRound({ ...WEEK, ...over }), null, JSON.stringify(over))
    }
  })
  it("the answer must be for the Normie asked for, and standing and round must be the same game", () => {
    assert.equal(parseLiveStanding(STANDING, 7142), null)
    assert.equal(parseLiveCounts(NORMIE, 7142), null)
    assert.equal(buildArenaLive(7141, { ...RAW, week: { ...WEEK, game: 2 } }, NOW).status, "unavailable")
  })
  it("a real on-the-map response (#8831, 2026-11-18): where is 'playing', there is no `back`, and it reads 'On the map'", () => {
    const PLAYING = json("lib/arena-live/fixtures/standing-8831-playing.json") as Record<string, unknown> & { normies: Record<string, Record<string, unknown>> }
    assert.deepEqual(Object.keys(PLAYING.normies["8831"]).sort(), ["doing", "prize", "px", "rank", "where"])
    assert.deepEqual(parseLiveStanding(PLAYING, 8831), { game: 1, rank: 2, of: 748, px: 580893, where: "playing", backAt: null })
    // This is the shape that made the block unavailable on Vercel while #7141 was on the map.
    const { back: _back, ...noBack } = STANDING.normies["7141"]
    const live = buildArenaLive(7141, { ...RAW, standing: { ...STANDING, normies: { "7141": { ...noBack, where: "playing", doing: "looting" } } } }, NOW)
    assert.ok(live.status === "ok")
    assert.deepEqual([live.where, live.where_text, live.back_at], ["playing", "On the map", null])
    assert.doesNotMatch(JSON.stringify(live), /looting|prize/, "`doing` and the row's prize figure are never read")
    assert.equal(parseLiveStanding(standingRow({ back: null }), 7141)?.backAt, null)
  })
  it("the row's `prize` figure (shown for top rows while the game is live) never changes the answer", () => {
    assert.deepEqual(parseLiveStanding(standingRow({ prize: "3" }), 7141), parseLiveStanding(STANDING, 7141))
  })
  it("'map' was a guess and is not a real value: it is refused like any other unknown word", () => {
    assert.equal(parseLiveStanding(standingRow({ where: "map" }), 7141), null)
  })
  it("synthetic: an unseen phase word is shown as reported, never interpreted", () => {
    assert.equal(parseLiveRound({ ...WEEK, phase: "settling" })?.phase, "settling")
  })
})

describe("the polite reader: fixed routes, shared cache, backoff, identification, byte cap", () => {
  type Call = { url: string; init: RequestInit & { next?: { revalidate?: number } } }
  function stubFetch(replies: Array<() => Response> | (() => Response)) {
    const calls: Call[] = []
    const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), init: (init ?? {}) as Call["init"] })
      const next = Array.isArray(replies) ? replies.shift() : replies
      if (!next) throw new Error("no reply queued")
      return next()
    }) as unknown as typeof fetch
    return { impl, calls }
  }
  const reply = (body: unknown, status = 200, headers: Record<string, string> = {}) => () =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } })
  const boom = () => {
    throw new Error("connection refused")
  }

  it("exactly three routes: normie/{id}, standing?ids={one id}, arena-week", () => {
    assert.deepEqual(ARENA_LIVE_ROUTES.map((r) => r.name), ["normie", "standing", "arena-week"])
    for (const p of ["/api/world/normie/7141", "/api/world/normie/0", "/api/world/standing?ids=7141", "/api/world/arena-week"]) assert.ok(resolveArenaLivePath(p), p)
  })
  it("refuses everything else: the board, the stream, finance, enter, other ids, several ids, extra query", () => {
    const bad = [
      "/api/world/arena-week/board", "/api/world/live", "/api/world/finance", "/api/world/enter", "/api/world/status", "/api/world/leaderboard",
      "/api/world/skin/png?id=7141", "/api/world/normie/10000", "/api/world/normie/07141", "/api/world/normie/7141/extra", "/api/world/normie/abc",
      "/api/world/standing", "/api/world/standing?ids=7141,42", "/api/world/standing?ids=7141&ids=42", "/api/world/standing?ids=7141&x=1", "/api/world/standing?id=7141",
      "/api/world/arena-week?x=1", "/api/world/normie/7141?x=1", "/api/world/../admin", "/api/admin", "/arena/status", "https://evil.example/api/world/arena-week", "//evil.example/api/world/arena-week",
    ]
    for (const p of bad) assert.equal(resolveArenaLivePath(p), null, p)
  })
  it("a path that isn't on the list is never fetched", async () => {
    const f = stubFetch(reply({}))
    const api = createArenaLiveApi({ fetchImpl: f.impl })
    assert.deepEqual(await api.get("/api/world/arena-week/board"), { ok: false, status: 0, reason: "not_allowed" })
    assert.equal(f.calls.length, 0)
  })
  it("calls arena.normies.art with the same User-Agent and 60 s shared cache as the official Arena reader", async () => {
    const f = stubFetch(reply(WEEK))
    const res = await createArenaLiveApi({ fetchImpl: f.impl }).get("/api/world/arena-week")
    assert.ok(res.ok)
    assert.equal(f.calls[0].url, "https://arena.normies.art/api/world/arena-week")
    assert.equal(ARENA_LIVE_BASE, "https://arena.normies.art")
    const headers = f.calls[0].init.headers as Record<string, string>
    assert.equal(headers["User-Agent"], arenaApiUserAgent())
    assert.equal(f.calls[0].init.next?.revalidate, ARENA_API_REVALIDATE_SECONDS)
    assert.equal(ARENA_API_REVALIDATE_SECONDS, 60)
    assert.equal(ARENA_LIVE_TIMEOUT_MS, 5_000)
    assert.equal(f.calls[0].init.method ?? "GET", "GET")
  })
  it("429 or 503 pauses that route for its Retry-After: no call is made while paused", async () => {
    for (const status of [429, 503]) {
      let t = 1_000_000
      const f = stubFetch([reply({}, status, { "retry-after": "120" }), reply(WEEK), reply(WEEK)])
      const api = createArenaLiveApi({ fetchImpl: f.impl, now: () => t })
      assert.deepEqual(await api.get("/api/world/arena-week"), { ok: false, status, reason: "http" })
      t += 119_000
      assert.deepEqual(await api.get("/api/world/arena-week"), { ok: false, status: 0, reason: "paused" })
      assert.equal(f.calls.length, 1, "nothing was sent while paused")
      t += 2_000
      assert.ok((await api.get("/api/world/arena-week")).ok)
    }
  })
  it("a pause on one route doesn't stop the others", async () => {
    const f = stubFetch([reply({}, 429, { "retry-after": "60" }), reply(STANDING)])
    const api = createArenaLiveApi({ fetchImpl: f.impl, now: () => 5 })
    await api.get("/api/world/arena-week")
    assert.ok((await api.get("/api/world/standing?ids=7141")).ok)
  })
  it("three failures in a row pause the route for a minute; a success clears the count", async () => {
    let t = 0
    const f = stubFetch([boom, reply({}, 500), boom, reply(WEEK), boom, boom, reply(WEEK)])
    const api = createArenaLiveApi({ fetchImpl: f.impl, now: () => t })
    for (let i = 0; i < 3; i++) assert.equal((await api.get("/api/world/arena-week")).ok, false)
    assert.deepEqual(await api.get("/api/world/arena-week"), { ok: false, status: 0, reason: "paused" })
    assert.equal(f.calls.length, 3)
    t += ARENA_API_DEFAULT_PAUSE_MS + 1
    assert.ok((await api.get("/api/world/arena-week")).ok)
    await api.get("/api/world/arena-week")
    await api.get("/api/world/arena-week")
    assert.ok((await api.get("/api/world/arena-week")).ok, "two failures after a success don't pause")
  })
  it("404 is an answer, not a reason to back off", async () => {
    const f = stubFetch(reply({}, 404))
    const api = createArenaLiveApi({ fetchImpl: f.impl })
    for (let i = 0; i < 5; i++) assert.deepEqual(await api.get("/api/world/normie/7141"), { ok: false, status: 404, reason: "http" })
    assert.equal(f.calls.length, 5)
  })
  it("a body past the byte cap is refused", async () => {
    const big = () => new Response("x".repeat(ARENA_API_MAX_BYTES + 10), { status: 200, headers: { "content-type": "application/json" } })
    assert.deepEqual(await createArenaLiveApi({ fetchImpl: stubFetch(big).impl }).get("/api/world/normie/7141"), { ok: false, status: 0, reason: "error" })
  })
  it("the reader file calls no stream, board, POST, finance or admin route", () => {
    for (const file of ["lib/arena-live/api.ts", "lib/arena-live/load.ts", "lib/arena-live/core.ts"]) {
      const code = readFileSync(file, "utf8").split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n")
      assert.doesNotMatch(code, /world\/live|arena-week\/board|method:\s*"POST"|finance|admin|EventSource/i, file)
    }
  })
})

describe("loadArenaLive: three reads, and any failure is 'unavailable'", () => {
  const replies = (over: Record<string, ArenaLiveResult | "throws"> = {}) => {
    const asked: string[] = []
    const base: Record<string, ArenaLiveResult> = {
      "/api/world/standing?ids=7141": { ok: true, status: 200, data: STANDING },
      "/api/world/normie/7141": { ok: true, status: 200, data: NORMIE },
      "/api/world/arena-week": { ok: true, status: 200, data: WEEK },
    }
    const get = async (path: string): Promise<ArenaLiveResult> => {
      asked.push(path)
      const r = over[path] ?? base[path]
      if (!r || r === "throws") throw new Error("boom")
      return r
    }
    return { get, asked }
  }
  it("reads the three allowlisted routes once each", async () => {
    const r = replies()
    const live = await loadArenaLive(7141, NOW, r.get)
    assert.equal(live.status, "ok")
    assert.deepEqual(r.asked.sort(), ["/api/world/arena-week", "/api/world/normie/7141", "/api/world/standing?ids=7141"])
    for (const p of r.asked) assert.ok(resolveArenaLivePath(p), p)
  })
  it("a failed, paused, refused or throwing read on any route: unavailable, never a part block and never zeros", async () => {
    const failures: ArenaLiveResult[] = [{ ok: false, status: 500, reason: "http" }, { ok: false, status: 404, reason: "http" }, { ok: false, status: 0, reason: "paused" }, { ok: false, status: 0, reason: "error" }]
    for (const path of ["/api/world/standing?ids=7141", "/api/world/normie/7141", "/api/world/arena-week"]) {
      for (const failure of [...failures, "throws" as const]) {
        const live = await loadArenaLive(7141, NOW, replies({ [path]: failure }).get)
        assert.equal(live.status, "unavailable", `${path} ${JSON.stringify(failure)}`)
        assert.equal(live.status_text, ARENA_LIVE_UNAVAILABLE_TEXT)
        assert.deepEqual(Object.keys(live).sort(), ["as_of", "source", "status", "status_text"])
      }
    }
  })
  it("a bad token id never reaches the URL", async () => {
    const r = replies()
    assert.equal((await loadArenaLive(10000, NOW, r.get)).status, "unavailable")
    assert.equal((await loadArenaLive(1.5, NOW, r.get)).status, "unavailable")
    assert.deepEqual(r.asked, [])
  })
})

describe("on the record card's Arena sector", () => {
  const ZULO = json("lib/record-card/fixtures/arena-normie-7141.json")
  const STATUS_OPEN = json("lib/record-card/fixtures/arena-status-round1-open.json")
  const ROUNDS = json("lib/record-card/fixtures/arena-normie-7141-rounds.json")
  const official = (replies: Record<string, unknown>) => async (path: string) => {
    if (!(path in replies)) throw new Error("no")
    return { status: 200, body: replies[path] }
  }
  const entered = { "/arena/normie/7141": ZULO, "/arena/status": STATUS_OPEN, "/arena/normie/7141/rounds": ROUNDS }
  it("an entered Normie gets the live block beside its official record; the official counts are untouched", async () => {
    const liveCalls: number[] = []
    const source = officialArenaSource(official(entered), async (id, asOf) => (liveCalls.push(id), buildArenaLive(id, RAW, asOf)))
    const sector = await loadArenaSector(7141, NOW, { status: "LIVE", sources: [source] })
    assert.equal(sector.live?.status, "ok")
    assert.deepEqual(liveCalls, [7141])
    assert.equal(sector.record.matches.value, 1)
    assert.equal(sector.record.wins.value, 0)
    assert.equal(sector.rank.ranked, false, "a live standing never makes an NCH rank")
    assert.equal(sector.round_history?.status, "ok")
  })
  it("a live read that fails or throws never fails the sector", async () => {
    const down = officialArenaSource(official(entered), async (id, asOf) => loadArenaLive(id, asOf, async () => ({ ok: false, status: 0, reason: "error" })))
    const a = await loadArenaSector(7141, NOW, { status: "LIVE", sources: [down] })
    assert.equal(a.status, "unranked")
    assert.equal(a.live?.status, "unavailable")
    const throwing = officialArenaSource(official(entered), async () => {
      throw new Error("boom")
    })
    const b = await loadArenaSector(7141, NOW, { status: "LIVE", sources: [throwing] })
    assert.equal(b.status, "unranked")
    assert.equal(b.live, undefined)
  })
  it("no live read for a Normie that isn't entered, couldn't be read, or when Arena isn't LIVE", async () => {
    let calls = 0
    const live = async (id: number, asOf: string) => (calls++, buildArenaLive(id, RAW, asOf))
    const notEntered = { ...(ZULO as object), tokenId: "4242", state: "unregistered", registered: false, agentId: null, skins: 0, roundsPlayed: 0, lastRound: null, wins: 0, inCurrentRound: false }
    const a = await loadArenaSector(4242, NOW, { status: "LIVE", sources: [officialArenaSource(official({ "/arena/normie/4242": notEntered, "/arena/status": STATUS_OPEN }), live)] })
    const b = await loadArenaSector(7141, NOW, { status: "LIVE", sources: [officialArenaSource(official({}), live)] })
    const c = await loadArenaSector(7141, NOW, { status: "COMING_SOON", sources: [officialArenaSource(official(entered), live)] })
    assert.deepEqual([a.live, b.live, c.live, calls], [undefined, undefined, undefined, 0])
  })
  it("a source without a live loader (every older test) makes no live read", async () => {
    const sector = await loadArenaSector(7141, NOW, { status: "LIVE", sources: [officialArenaSource(official(entered))] })
    assert.equal(sector.live, undefined)
  })
})

describe("the record page", () => {
  const page = readFileSync("app/record/[tokenId]/page.tsx", "utf8")
  it("labels the standing as the Arena's own, shows the end time in the viewer's local time, and names the source", () => {
    assert.ok(page.includes(`label="Arena's live standing" value={arena.live.live_rank.text} note="As the Arena reports it. Not an NCH rank"`))
    assert.ok(page.includes("It can change until the round ends."))
    assert.ok(page.includes(`<Stat label="Round ends" value={<LocalTime iso={arena.live.round.ends_at} />} note="Shown in your local time" />`))
    assert.ok(page.includes("Source: {arena.live.source.label}, as of"))
    assert.ok(page.includes(`note="Arena PX, the game's own score. Not #PIXEL"`))
  })
  it("the live block has no pool, prize, projection or conversion wording", () => {
    const block = page.slice(page.indexOf("{arena.live && ("), page.indexOf("{arena.skin_image_url && <ArenaSkin"))
    assert.ok(block.length > 500)
    assert.doesNotMatch(block, /pool|prize|payout|winnings|\bETH\b|\bUSD\b|\$\d|if it ended|projected|estimated|share|worth|will finish|on track/i)
  })
})
