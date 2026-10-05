import { describe, it } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

import { notFoundJson } from "./api/not-found"
import { burnJsonLd, jsonLdScript } from "./burn-buy/jsonld"
import { buildBurnBuy, type Deps, type MarketSnapshot, type RarityToken, type RawListing } from "./burn-buy/service"
import robots from "../app/robots"
import sitemap from "../app/sitemap"

const root = path.resolve(__dirname, "..")
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8")

describe("machine-readable 404s", () => {
  it("answers JSON with a code, the path and a hint, never HTML", async () => {
    const res = notFoundJson(new Request("https://x.test/api/does-not-exist?a=1"))
    assert.equal(res.status, 404)
    assert.match(res.headers.get("content-type")!, /application\/json/)
    assert.equal(res.headers.get("cache-control"), "no-store")
    const body = await res.json()
    assert.deepEqual(Object.keys(body).sort(), ["code", "error", "hint", "path", "retryable"])
    assert.equal(body.code, "not_found")
    assert.equal(body.path, "/api/does-not-exist")
    assert.equal(body.retryable, false)
    assert.match(body.hint, /llms\.txt/)
  })

  it("the /api and /.well-known catch-alls export the handlers and return that 404", async () => {
    const api = await import("../app/api/[...slug]/route")
    for (const m of ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"] as const) {
      const res = await api[m](new Request("https://x.test/api/nope", { method: m }))
      assert.equal(res.status, 404, m)
    }
    const wk = await import("../app/.well-known/[...slug]/route")
    for (const m of ["GET", "HEAD"] as const) assert.equal((await wk[m](new Request("https://x.test/.well-known/agent.json", { method: m }))).status, 404)
  })
})

describe("llms.txt", () => {
  const txt = read("public/llms.txt")
  it("describes the burn page and API, with the safety statements", () => {
    for (const s of ["/burn?wallet=", "GET /api/burn-buy?wallet=", "/openapi/burn-buy.json", "Look-only", "never asks for keys, seeds or signatures", "Not financial advice", "A burn is permanent", "not made or endorsed by the Normies team", "12 requests per minute", "yieldMode", "marketState", "promo.window", "16:00 UTC"]) {
      assert.ok(txt.includes(s), s)
    }
  })
  it("keeps what was already there", () => {
    for (const s of ["Pulse → Paths → Act", "/.well-known/ai-tool/index.json", "Do not ask for keys, seeds, signatures."]) assert.ok(txt.includes(s), s)
  })
  it("every file or route it names for the burn feature really exists", () => {
    assert.ok(fs.existsSync(path.join(root, "public/openapi/burn-buy.json")))
    assert.ok(fs.existsSync(path.join(root, "app/api/burn-buy/route.ts")))
    assert.ok(fs.existsSync(path.join(root, "app/burn/page.tsx")))
  })
})

describe("robots and sitemap", () => {
  it("/burn is listed; the API stays out of crawlers", () => {
    const r = robots()
    const rule = Array.isArray(r.rules) ? r.rules[0] : r.rules
    assert.ok((rule.allow as string[]).includes("/burn"))
    assert.deepEqual(rule.disallow, ["/api/"])
    assert.ok(sitemap().some((s) => s.url.endsWith("/burn")))
  })
})

describe("JSON-LD for /burn", () => {
  const ld = burnJsonLd("https://normiescredhub.vercel.app")
  it("is a WebApplication with the page url and a wallet entry point", () => {
    assert.equal(ld["@type"], "WebApplication")
    assert.equal(ld.url, "https://normiescredhub.vercel.app/burn")
    assert.equal(ld.isAccessibleForFree, true)
    assert.match(ld.potentialAction.target.urlTemplate, /\/burn\?wallet=\{wallet\}&goal=\{goal\}$/)
  })
  it("makes no claim of endorsement or rating", () => {
    const s = JSON.stringify(ld)
    assert.doesNotMatch(s, /aggregateRating|review|endorsed by|official/i)
  })
  it("can never close its own script tag", () => {
    const out = jsonLdScript({ x: "</script><script>alert(1)</script>" })
    assert.ok(!out.includes("<"))
    assert.deepEqual(JSON.parse(out), { x: "</script><script>alert(1)</script>" })
  })
})

// ---- the OpenAPI spec must describe what the API really returns -------------------------------------------------
const spec = JSON.parse(read("public/openapi/burn-buy.json"))
const ok200 = spec.paths["/api/burn-buy"].get.responses["200"].content["application/json"].schema

const snap = (): MarketSnapshot => ({
  livingSupply: 7226, wallets: 1723, censusTotal: 25873, oldestIndexedAt: "2026-10-04T20:00:00Z", walletScores: new Map(),
  originalPixels: new Map([[1, 600], [2, 700], [3, 300], [4, 650]]), pixelSupply: new Map([[600, 400], [700, 400], [300, 400], [650, 400]]),
})
const rt = (id: number): RarityToken => ({ id, rank: 4000, type: "Human", actionPoints: 5, awakenedAgent: false, fairValueEth: 0.29 })
const lst = (id: number, priceEth: number, actionPoints = 0): RawListing => ({ ...rt(id), actionPoints, priceEth })
const deps = (over: Partial<Deps> = {}): Deps => ({
  resolveHolder: async () => ({ address: "0xabc", ens: null, tokenIds: [1, 3] }),
  fetchTokens: async (ids) => ids.map(rt),
  fetchListings: async () => ({ items: [lst(2, 0.3), lst(4, 0.32, 5)], floorEth: 0.286, total: 2 }),
  loadSnapshot: async () => snap(),
  now: () => new Date("2026-10-05T00:00:00Z"),
  ...over,
})

/** Every key a real object has must be documented; every key the spec REQUIRES must be present. */
function same(label: string, obj: Record<string, unknown>, schema: { properties: Record<string, unknown>; required?: string[] }, optional: string[] = []) {
  const documented = Object.keys(schema.properties)
  for (const k of Object.keys(obj)) assert.ok(documented.includes(k), `${label}: real field "${k}" is not in the spec`)
  for (const k of schema.required ?? []) assert.ok(k in obj, `${label}: spec requires "${k}" but the API did not return it`)
  void optional
}

describe("the OpenAPI spec matches the real answers (both yield modes, with and without a wallet)", () => {
  it("is a valid-looking OpenAPI 3.1 document for the right path and parameter", () => {
    assert.equal(spec.openapi, "3.1.0")
    const get = spec.paths["/api/burn-buy"].get
    assert.equal(get.parameters[0].name, "wallet")
    assert.equal(get.parameters[0].required, false)
    for (const code of ["200", "400", "429", "500", "502"]) assert.ok(get.responses[code], code)
    assert.match(spec.info.description, /never asks for keys/)
    assert.match(spec.info.description, /12 requests per minute/)
  })

  for (const mode of ["promo", "normal"] as const) {
    it(`${mode} mode, with a wallet: every field is documented and every required field is present`, async () => {
      const r = (await buildBurnBuy({ wallet: "0xabc" }, deps({ yieldMode: () => mode }))) as unknown as Record<string, any>
      same("root", r, ok200)
      same("promo", r.promo, ok200.properties.promo)
      same("wallet", r.wallet, ok200.properties.wallet)
      same("advice", r.wallet.advice, ok200.properties.wallet.properties.advice)
      same("token", r.wallet.advice.tokens[0], ok200.properties.wallet.properties.advice.properties.tokens.items)
      same("yield", r.wallet.advice.tokens[0].yield, ok200.properties.wallet.properties.advice.properties.tokens.items.properties.yield)
      same("move", r.wallet.advice.moves[0], ok200.properties.wallet.properties.advice.properties.moves.items)
      same("holding", r.wallet.advice.holdings[0], ok200.properties.wallet.properties.advice.properties.holdings.items)
      same("illustration", r.wallet.historicalIllustration, ok200.properties.wallet.properties.historicalIllustration)
      same("market", r.market, ok200.properties.market)
      assert.ok(r.market.bestPixelFodder.length > 0 && r.market.bestApCarriers.length > 0, "fixture has one of each kind")
      same("fodder", r.market.bestPixelFodder[0], ok200.properties.market.properties.bestPixelFodder.items)
      same("AP carrier", r.market.bestApCarriers[0], ok200.properties.market.properties.bestApCarriers.items)
      if (mode === "normal") assert.ok(r.market.bestPixelFodder[0].yieldMin !== undefined)
      same("census", r.census, ok200.properties.census)
      same("sources", r.sources, ok200.properties.sources)
      same("source status", r.sources.jev, ok200.properties.sources.properties.jev)
      assert.equal(r.wallet.advice.tokens[0].yield.range !== undefined, mode === "normal")
    })
  }

  it("market LIVE with an order book: pixelMarket, pixelMarketView, cliffCost, sell rows and the fodder comparison are all documented", async () => {
    const book = {
      asOf: "2026-10-05T20:40:00Z", bestAskEth: 0.0169, lastPriceEth: 0.017, volume24hEth: 0.0719, pixels24h: 4, activeListings: 17, pixelsListed: 499,
      feeBps: 1000, revenueShareBps: 5000, paused: false,
      depth: [{ priceEth: 0.0169, remaining: 5, partialRemaining: 5 }, { priceEth: 0.017, remaining: 2, partialRemaining: 2 }, { priceEth: 0.0175, remaining: 143, partialRemaining: 143 }],
    }
    const r = (await buildBurnBuy({ wallet: "0xabc" }, deps({ marketState: () => "live", pixelMarket: async () => book }))) as unknown as Record<string, any>
    same("root", r, ok200)
    same("pixelMarket", r.pixelMarket, ok200.properties.pixelMarket)
    same("depth level", r.pixelMarket.depth[0], ok200.properties.pixelMarket.properties.depth.items)
    const view = r.wallet.pixelMarketView
    assert.ok(view, "a held wallet with a live book gets a view")
    same("view", view, ok200.properties.wallet.properties.pixelMarketView)
    assert.ok(view.cliffCost, "10 #PIXEL held: the next boost (15) can be priced")
    same("cliffCost", view.cliffCost, ok200.properties.wallet.properties.pixelMarketView.properties.cliffCost)
    same("buy", view.cliffCost.buy, ok200.properties.wallet.properties.pixelMarketView.properties.cliffCost.properties.buy)
    same("payback", view.cliffCost.payback[0], ok200.properties.wallet.properties.pixelMarketView.properties.cliffCost.properties.payback.items)
    assert.ok(view.sell.length > 0)
    same("sell row", view.sell[0], ok200.properties.wallet.properties.pixelMarketView.properties.sell.items)
    same("fodder", r.market.bestPixelFodder[0], ok200.properties.market.properties.bestPixelFodder.items)
    assert.ok(r.market.bestPixelFodder[0].vsAsk && r.market.bestPixelFodder[0].breakEvenNormieEth)
    same("sources", r.sources, ok200.properties.sources)
    assert.equal(view.cliffCost.needMore, 5)
    assert.equal(view.cliffCost.buy.costEth, 0.0845) // 5 #PIXEL, all at the 0.0169 best ask
  })
  it("market LIVE but the book is unreadable: pixelMarket is null, the wallet view is null, and the source says so", async () => {
    const r = (await buildBurnBuy({ wallet: "0xabc" }, deps({ marketState: () => "live", pixelMarket: async () => null }))) as unknown as Record<string, any>
    assert.equal(r.pixelMarket, null); assert.equal(r.wallet.pixelMarketView, null)
    assert.equal(r.sources.pixelMarket.ok, false)
    assert.ok(r.caveats.some((c: string) => /order book could not be read/.test(c)))
  })
  it("market-only (no wallet): wallet is null, as the spec says", async () => {
    const r = (await buildBurnBuy({}, deps())) as unknown as Record<string, any>
    same("root", r, ok200)
    assert.equal(r.wallet, null)
    assert.deepEqual(ok200.properties.wallet.type, ["object", "null"])
  })

  it("the error codes the route can return are all in the Error schema", () => {
    const codes: string[] = spec.components.schemas.Error.properties.code.enum
    const route = read("app/api/burn-buy/route.ts")
    for (const c of ["invalid_wallet", "rate_limit", "upstream_unavailable", "internal"]) {
      assert.ok(route.includes(`"${c}"`), `route no longer returns ${c}`)
      assert.ok(codes.includes(c), c)
    }
    assert.ok(codes.includes("not_found"))
  })
})
