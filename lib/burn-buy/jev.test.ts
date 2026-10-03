import { afterEach, describe, it } from "node:test"
import assert from "node:assert/strict"

import { realDeps } from "./data"
import {
  buildJevRequest, fetchJevOpinions, JEV_ENDPOINT, jevEndpoint, JEV_MAX_TOKENS, JEV_MODEL, JevError, parseJevResponse, REGRET_AGREES_BELOW,
  REGRET_DOUBLE_CHECK, verdictFor, type JevOpinion, type JevToken,
} from "./jev"
import { buildPageModel, jevView } from "./narrate"
import { buildBurnBuy, type Deps, type MarketSnapshot, type RarityToken, type RawListing } from "./service"

const tok = (id: number, over: Partial<JevToken> = {}): JevToken => ({
  tokenId: id, traits: { Type: "Human", Gender: "Female", Age: "Old", "Hair Style": "Messy Hair", Eyes: "Small Shades", Expression: "Confident", Accessory: "No Accessories" },
  originalPixels: 529, pixelSupply: 300, actionPoints: 0, level: 1, rank: 5397, awakenedAgent: false, customized: false, ...over,
})
const ok = (answers: Record<string, unknown>) => new Response(JSON.stringify({ model: "jev-1.13.0", answers, usage: { input_tokens: 1, output_tokens: 1 } }), { status: 200 })
const noul = (p: number) => ({ type: "noul", noul: p })

describe("verdicts (starting thresholds, cautious on purpose)", () => {
  it("thresholds", () => {
    assert.equal(verdictFor(REGRET_DOUBLE_CHECK), "double-check")
    assert.equal(verdictFor(0.99), "double-check")
    assert.equal(verdictFor(0.49), "unsure")
    assert.equal(verdictFor(REGRET_AGREES_BELOW), "unsure")
    assert.equal(verdictFor(0.19), "agrees")
    assert.equal(verdictFor(0), "agrees")
  })
})

describe("the request", () => {
  it("matches the documented contract: model, one noul question per Normie with true/false criteria", () => {
    const r = buildJevRequest([tok(1161), tok(79)])
    assert.equal(r.model, JEV_MODEL)
    assert.deepEqual(Object.keys(r.questions), ["n1161", "n79"])
    const q = r.questions.n1161 as { type: string; instructions: string; criteria: Record<string, string> }
    assert.equal(q.type, "noul")
    assert.match(q.instructions, /regret burning it/)
    assert.deepEqual(Object.keys(q.criteria), ["true", "false"])
  })

  it("sends public facts only: NO wallet address, ENS name or owner anywhere", () => {
    const body = JSON.stringify(buildJevRequest([tok(1161, { customized: true })]))
    assert.doesNotMatch(body, /0x[0-9a-fA-F]{6}/, "no hex address")
    assert.doesNotMatch(body, /\.eth\b/i, "no ENS name")
    const collect = (v: unknown): string[] => (v && typeof v === "object" ? Object.entries(v as object).flatMap(([k, x]) => [k, ...collect(x)]) : [])
    const names = collect(buildJevRequest([tok(1161)]).state)
    assert.ok(names.every((k) => !/wallet|address|^ens$|ownerAddress|holder/i.test(k)), "no identifier fields: " + names.join(","))
    assert.match(body, /"customizedByItsOwner":true/)
    assert.match(body, /"hairStyle":"Messy Hair"/)
    assert.match(body, /"originalPixelCount":529/)
  })
})

describe("reading the answer", () => {
  it("reads noul answers into opinions", () => {
    const o = parseJevResponse({ answers: { n1: noul(0.62), n2: noul(0.05), n3: noul(0.3) } }, [1, 2, 3])
    assert.deepEqual(o[1], { pRegret: 0.62, verdict: "double-check" })
    assert.equal(o[2].verdict, "agrees")
    assert.equal(o[3].verdict, "unsure")
  })

  it("skips anything missing, malformed or out of range instead of guessing", () => {
    const o = parseJevResponse({ answers: { n1: noul(1.5), n2: { type: "choice", choice: "x" }, n3: { type: "noul", noul: "high" } } }, [1, 2, 3, 4])
    assert.deepEqual(o, {})
  })

  it("no answers at all is an error", () => {
    assert.throws(() => parseJevResponse({}, [1]), (e: unknown) => e instanceof JevError && e.kind === "bad-response")
  })
})

describe("calling Jev (mocked: no network)", () => {
  it("POSTs to the documented endpoint with a Bearer key and the built body", async () => {
    let seen: { url: string; init: RequestInit } | null = null
    const fetcher = (async (url: string, init: RequestInit) => { seen = { url, init }; return ok({ n1161: noul(0.7) }) }) as never
    const r = await fetchJevOpinions([tok(1161)], { apiKey: "K", fetcher, cache: new Map() })
    assert.equal(seen!.url, JEV_ENDPOINT)
    assert.equal(seen!.init.method, "POST")
    assert.equal((seen!.init.headers as Record<string, string>).Authorization, "Bearer K")
    assert.equal(JSON.parse(String(seen!.init.body)).model, "jev-latest")
    assert.equal(r.opinions[1161].verdict, "double-check")
  })

  it("caches: a second call for the same Normie makes no request", async () => {
    let calls = 0
    const fetcher = (async () => { calls++; return ok({ n1: noul(0.1) }) }) as never
    const cache = new Map()
    await fetchJevOpinions([tok(1)], { apiKey: "K", fetcher, cache })
    await fetchJevOpinions([tok(1)], { apiKey: "K", fetcher, cache })
    assert.equal(calls, 1)
  })

  it("asks only for the Normies it has not already cached, and re-asks after the cache expires", async () => {
    const bodies: string[] = []
    const fetcher = (async (_u: string, init: RequestInit) => { bodies.push(String(init.body)); return ok({ n1: noul(0.1), n2: noul(0.2) }) }) as never
    const cache = new Map()
    let t = 0
    const now = () => t
    await fetchJevOpinions([tok(1)], { apiKey: "K", fetcher, cache, now })
    await fetchJevOpinions([tok(1), tok(2)], { apiKey: "K", fetcher, cache, now })
    assert.deepEqual(Object.keys(JSON.parse(bodies[1]).questions), ["n2"])
    t = 7 * 60 * 60 * 1000
    await fetchJevOpinions([tok(1)], { apiKey: "K", fetcher, cache, now })
    assert.equal(bodies.length, 3)
  })

  it(`never sends more than ${JEV_MAX_TOKENS} Normies in one request`, async () => {
    let n = 0
    const fetcher = (async (_u: string, init: RequestInit) => { n = Object.keys(JSON.parse(String(init.body)).questions).length; return ok({}) }) as never
    await fetchJevOpinions(Array.from({ length: 20 }, (_, i) => tok(i + 1)), { apiKey: "K", fetcher, cache: new Map() })
    assert.equal(n, JEV_MAX_TOKENS)
  })

  for (const [status, kind] of [[401, "auth"], [422, "invalid"], [429, "rate"], [529, "overloaded"], [500, "bad-response"]] as const) {
    it(`HTTP ${status} becomes a ${kind} error`, async () => {
      const fetcher = (async () => new Response("{}", { status })) as never
      await assert.rejects(fetchJevOpinions([tok(1)], { apiKey: "K", fetcher, cache: new Map() }), (e: unknown) => e instanceof JevError && e.kind === kind)
    })
  }

  it("a network failure and a non-JSON reply are errors, not guesses", async () => {
    await assert.rejects(fetchJevOpinions([tok(1)], { apiKey: "K", fetcher: (async () => { throw new Error("boom") }) as never, cache: new Map() }), (e: unknown) => e instanceof JevError && e.kind === "network")
    await assert.rejects(fetchJevOpinions([tok(1)], { apiKey: "K", fetcher: (async () => new Response("<html>", { status: 200 })) as never, cache: new Map() }), (e: unknown) => e instanceof JevError && e.kind === "bad-response")
  })
})

const snap = (): MarketSnapshot => ({
  livingSupply: 7226, wallets: 1723, censusTotal: 25873, oldestIndexedAt: "2026-10-04T20:00:00Z", walletScores: new Map(),
  originalPixels: new Map([[1, 600], [2, 700], [3, 300], [4, 500]]), pixelSupply: new Map([[600, 400], [700, 400], [300, 400], [500, 400]]),
})
const rt = (id: number, over: Partial<RarityToken> = {}): RarityToken => ({ id, rank: 4000, type: "Human", actionPoints: 0, awakenedAgent: false, fairValueEth: 0.29, traits: { Type: "Human", Eyes: "Big Shades" }, customized: false, ...over })
const lst = (id: number, priceEth: number): RawListing => ({ ...rt(id), priceEth })
const baseDeps = (over: Partial<Deps> = {}): Deps => ({
  resolveHolder: async () => ({ address: "0xabc", ens: null, tokenIds: [1, 3, 4] }),
  fetchTokens: async (ids) => ids.map((i) => rt(i, i === 4 ? { type: "Cat" } : {})),
  fetchListings: async () => ({ items: [lst(2, 0.3)], floorEth: 0.286, total: 1 }),
  loadSnapshot: async () => snap(),
  now: () => new Date("2026-10-05T00:00:00Z"),
  ...over,
})

describe("inside the service: tripwire only, and only when it should run", () => {
  it("market pending: Jev is never called, even if a key exists", async () => {
    let called = 0
    const r = await buildBurnBuy({ wallet: "0xabc" }, baseDeps({ jevOpinions: async () => { called++; return { opinions: {} } } }))
    assert.equal(called, 0)
    assert.equal(r.wallet!.jev, undefined)
    assert.equal(r.sources.jev.note, "off")
  })

  it("market live, no key (adapter returns null): nothing changes and the note says off", async () => {
    const r = await buildBurnBuy({ wallet: "0xabc" }, baseDeps({ marketState: () => "live", jevOpinions: async () => null }))
    assert.equal(r.wallet!.jev, undefined)
    assert.deepEqual(r.sources.jev, { ok: true, note: "off" })
  })

  it("market live: only BURN CANDIDATES are sent (the Cat is a keeper and is not), and no verdict changes", async () => {
    let sent: JevToken[] = []
    const withoutJev = await buildBurnBuy({ wallet: "0xabc" }, baseDeps({ marketState: () => "live" }))
    const withJev = await buildBurnBuy({ wallet: "0xabc" }, baseDeps({
      marketState: () => "live",
      jevOpinions: async (t) => { sent = t; return { opinions: Object.fromEntries(t.map((x) => [x.tokenId, { pRegret: 0.9, verdict: "double-check" } satisfies JevOpinion])) } },
    }))
    assert.deepEqual(sent.map((t) => t.tokenId).sort(), [1, 3])
    assert.ok(sent.every((t) => !("address" in t) && !("wallet" in t)))
    assert.deepEqual(withJev.wallet!.advice.tokens.map((t) => [t.tokenId, t.verdict]), withoutJev.wallet!.advice.tokens.map((t) => [t.tokenId, t.verdict]))
    assert.deepEqual(Object.keys(withJev.wallet!.jev!).sort(), ["1", "3"])
    assert.match(withJev.sources.jev.note!, /second opinion for 2 of 2/)
  })

  it("Jev failing never breaks the answer: same verdicts, an honest source error, no opinions", async () => {
    const base = await buildBurnBuy({ wallet: "0xabc" }, baseDeps({ marketState: () => "live" }))
    const r = await buildBurnBuy({ wallet: "0xabc" }, baseDeps({ marketState: () => "live", jevOpinions: async () => { throw new JevError("overloaded", "Jev is overloaded") } }))
    assert.deepEqual(r.wallet!.advice.tokens.map((t) => t.verdict), base.wallet!.advice.tokens.map((t) => t.verdict))
    assert.equal(r.wallet!.jev, undefined)
    assert.equal(r.sources.jev.ok, false)
    assert.match(r.sources.jev.error!, /unavailable.*overloaded/)
  })
})

describe("the page words", () => {
  it("Jev can only add caution: text never says burn, and the verdict is untouched", async () => {
    const r = await buildBurnBuy({ wallet: "0xabc" }, baseDeps({
      marketState: () => "live",
      jevOpinions: async (t) => ({ opinions: Object.fromEntries(t.map((x) => [x.tokenId, { pRegret: 0.9, verdict: "double-check" } satisfies JevOpinion])) }),
    }))
    const m = buildPageModel(r, "share")
    const row = m.rows.find((x) => x.tokenId === 1)!
    assert.equal(row.verdict, "burn")
    assert.match(row.jev!.text, /Jev leans keep: about 90% that you would regret this burn\. Double-check before burning\./)
    for (const v of ["double-check", "agrees", "unsure"] as const) assert.doesNotMatch(jevView({ verdict: v, pRegret: 0.3 }).text, /you should burn/i)
  })

  it("no opinions: rows carry no jev field", async () => {
    const m = buildPageModel(await buildBurnBuy({ wallet: "0xabc" }, baseDeps()), "share")
    assert.ok(m.rows.every((x) => x.jev === undefined))
  })
})

describe("the real adapter is dark until it has a key", () => {
  const saved = { k: process.env.TYPESAFE_API_KEY, d: process.env.JEV_DISABLE }
  afterEach(() => {
    if (saved.k === undefined) delete process.env.TYPESAFE_API_KEY; else process.env.TYPESAFE_API_KEY = saved.k
    if (saved.d === undefined) delete process.env.JEV_DISABLE; else process.env.JEV_DISABLE = saved.d
  })

  it("no key: returns null without any network call", async () => {
    delete process.env.TYPESAFE_API_KEY
    assert.equal(await realDeps.jevOpinions!([tok(1)]), null)
  })

  it("a key but JEV_DISABLE=1 (kill switch): still null", async () => {
    process.env.TYPESAFE_API_KEY = "K"
    process.env.JEV_DISABLE = "1"
    assert.equal(await realDeps.jevOpinions!([tok(1)]), null)
  })
})

describe("the API address (TYPESAFE_BASE_URL, the name TypeSafe's own SDK uses)", () => {
  const saved = process.env.TYPESAFE_BASE_URL
  afterEach(() => { if (saved === undefined) delete process.env.TYPESAFE_BASE_URL; else process.env.TYPESAFE_BASE_URL = saved })

  it("unset: the official endpoint", () => {
    delete process.env.TYPESAFE_BASE_URL
    assert.equal(jevEndpoint(), "https://api.typesafe.ai/v1/systemone")
    assert.equal(jevEndpoint(), JEV_ENDPOINT)
  })
  it("set: that root plus /v1/systemone, trailing slashes tolerated", () => {
    process.env.TYPESAFE_BASE_URL = "https://gateway.example/typesafe///"
    assert.equal(jevEndpoint(), "https://gateway.example/typesafe/v1/systemone")
  })
  it("blank or whitespace: the official endpoint", () => {
    process.env.TYPESAFE_BASE_URL = "   "
    assert.equal(jevEndpoint(), JEV_ENDPOINT)
  })
})
