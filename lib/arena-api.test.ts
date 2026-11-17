// The polite Arena reader (lib/arena-api.ts): allowlist, identification, shared cache hint, and backoff (Claude, 2026-11-17).
import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  ARENA_API_DEFAULT_PAUSE_MS,
  ARENA_API_MAX_PAUSE_MS,
  ARENA_API_REVALIDATE_SECONDS,
  ARENA_API_ROUTES,
  createArenaApi,
  resolveArenaPath,
  retryAfterMs,
} from "./arena-api"

type Call = { url: string; init: RequestInit & { next?: { revalidate?: number } } }

/** A fetch stub that answers from a queue (or one fixed reply) and records every call. */
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
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) => () =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } })
const boom = () => {
  throw new Error("connection refused")
}

describe("allowlist: every documented Arena GET, nothing else", () => {
  it("accepts the documented paths and query keys (llms.txt, read 2026-11-17)", () => {
    for (const p of [
      "/arena/status",
      "/arena/rounds?status=open&sort=desc&limit=10&offset=0",
      "/arena/rounds/1",
      "/arena/rounds/1/players?limit=500&offset=500",
      "/arena/registered?state=short&limit=100",
      "/arena/normie/7141",
      "/arena/normie/0",
      "/arena/normie/9999/rounds?limit=20",
      "/arena/normie/7141/activity?limit=20&offset=20",
      "/arena/holder/0x235403069C8516369Eb36d29bb1a498a469Ab9f0",
      "/arena/activity?kind=registered&source=v3&round=1&tokenId=7141&limit=50",
      "/arena/skins?limit=10",
      "/arena/skins/normie/7141",
      "/arena/records?sort=rounds&limit=25",
    ]) {
      assert.ok(resolveArenaPath(p), p)
    }
    assert.equal(ARENA_API_ROUTES.length, 13)
  })
  it("refuses the money-only endpoints, bad ids, unknown keys, repeats, odd values and anything off-host", () => {
    for (const p of [
      "/arena/rounds/1/winners",
      "/arena/rounds/1/refunds",
      "/arena/normie/10000",
      "/arena/normie/0007",
      "/arena/normie/-1",
      "/arena/normie/7141?limit=5",
      "/arena/rounds?status=open&status=ended",
      "/arena/rounds?status=open%26x",
      "/arena/rounds?cursor=abc",
      "/arena/holder/0x1234",
      "/arena/../normie/7141/metadata",
      "//evil.example/arena/status",
      "https://evil.example/arena/status",
      "/normie/7141/metadata",
      "/arena/status#frag",
    ]) {
      assert.equal(resolveArenaPath(p), null, p)
    }
  })
})

describe("Retry-After", () => {
  it("reads seconds or an HTTP date, and clamps to 1 s .. 10 min", () => {
    const now = Date.parse("2026-11-17T01:00:00Z")
    assert.equal(retryAfterMs("120", now), 120_000)
    assert.equal(retryAfterMs("0", now), 1000)
    assert.equal(retryAfterMs("999999", now), ARENA_API_MAX_PAUSE_MS)
    assert.equal(retryAfterMs("Tue, 17 Nov 2026 01:00:30 GMT", now), 30_000)
    assert.equal(retryAfterMs("soon", now), ARENA_API_DEFAULT_PAUSE_MS)
    assert.equal(retryAfterMs(undefined, now), ARENA_API_DEFAULT_PAUSE_MS)
  })
})

describe("polite reader", () => {
  it("one call per request, with a shared-cache hint of 60 s and an honest User-Agent", async () => {
    const { impl, calls } = stubFetch([json({ currentRound: 1 })])
    const api = createArenaApi({ fetchImpl: impl })
    const r = await api.get("/arena/status")
    assert.deepEqual(r, { ok: true, status: 200, data: { currentRound: 1 } })
    assert.equal(calls.length, 1)
    assert.equal(calls[0].url, "https://api.normies.art/arena/status")
    assert.equal(calls[0].init.next?.revalidate, ARENA_API_REVALIDATE_SECONDS)
    assert.equal(ARENA_API_REVALIDATE_SECONDS, 60)
    const headers = calls[0].init.headers as Record<string, string>
    assert.match(headers["User-Agent"], /^NormiesCredHub \(read-only Normie record cards; \+https:\/\//)
    assert.equal(headers.Accept, "application/json")
  })
  it("a path off the allowlist never reaches the network", async () => {
    const { impl, calls } = stubFetch([])
    const api = createArenaApi({ fetchImpl: impl })
    assert.deepEqual(await api.get("/arena/rounds/1/winners"), { ok: false, status: 0, reason: "not_allowed" })
    assert.equal(calls.length, 0)
  })
  it("429 with Retry-After pauses that endpoint family until then; other families keep working", async () => {
    let t = 1_000_000
    const { impl, calls } = stubFetch([json({}, 429, { "retry-after": "30" }), json({ tokenId: "7141" }), json({ currentRound: 1 })])
    const api = createArenaApi({ fetchImpl: impl, now: () => t })
    assert.deepEqual(await api.get("/arena/status"), { ok: false, status: 429, reason: "http" })
    assert.deepEqual(await api.get("/arena/status"), { ok: false, status: 0, reason: "paused" })
    assert.equal(calls.length, 1, "no call while paused")
    assert.equal((await api.get("/arena/normie/7141")).ok, true, "the normie family isn't paused")
    t += 30_001
    assert.equal((await api.get("/arena/status")).ok, true, "back after Retry-After")
    assert.equal(calls.length, 3)
  })
  it("503 without Retry-After pauses for a minute", async () => {
    let t = 0
    const { impl, calls } = stubFetch([json({}, 503)])
    const api = createArenaApi({ fetchImpl: impl, now: () => t })
    await api.get("/arena/status")
    t += ARENA_API_DEFAULT_PAUSE_MS - 1
    assert.equal((await api.get("/arena/status")).ok, false)
    assert.equal(calls.length, 1)
  })
  it("three failures in a row pause the family; one success clears the count", async () => {
    let t = 0
    const { impl, calls } = stubFetch([boom, json({}, 502), json({ ok: 1 }), boom, boom, json({}, 500)])
    const api = createArenaApi({ fetchImpl: impl, now: () => t })
    await api.get("/arena/status")
    await api.get("/arena/status")
    assert.equal((await api.get("/arena/status")).ok, true, "a success after two failures")
    await api.get("/arena/status")
    await api.get("/arena/status")
    await api.get("/arena/status")
    assert.deepEqual(await api.get("/arena/status"), { ok: false, status: 0, reason: "paused" })
    assert.equal(calls.length, 6)
    t += ARENA_API_DEFAULT_PAUSE_MS + 1
    assert.deepEqual(await api.get("/arena/status"), { ok: false, status: 0, reason: "error" }, "tries again after the pause (no reply queued)")
  })
  it("404 is an answer, not a reason to back off", async () => {
    const { impl, calls } = stubFetch([json({ error: "not configured" }, 404), json({ error: "not configured" }, 404)])
    const api = createArenaApi({ fetchImpl: impl })
    assert.deepEqual(await api.get("/arena/normie/7141"), { ok: false, status: 404, reason: "http" })
    assert.deepEqual(await api.get("/arena/normie/7141"), { ok: false, status: 404, reason: "http" })
    assert.equal(calls.length, 2)
  })
})
