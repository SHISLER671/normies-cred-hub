import { describe, it } from "node:test"
import assert from "node:assert/strict"

import { listingsWithFallback } from "./listings-source"
import { loadOpenSeaListings, MAX_PAGES, openSeaAssetUrl, parseOpenSeaListings } from "./opensea-listings"
import { buildBurnBuy, type Deps, type MarketSnapshot, type RarityToken, type RawListing } from "./service"

const CONTRACT = "0x9eb6e2025b64f340691e424b7fe7022ffde12438"
// Shape captured from GET https://api.opensea.io/api/v2/listings/collection/normies/best on 2026-10-05 (trimmed to the fields we read).
const os = (id: number | string, wei: string, over: Record<string, unknown> = {}) => ({
  order_hash: "0x" + String(id), chain: "ethereum", status: "ACTIVE", type: "basic", remaining_quantity: 1,
  asset: { identifier: String(id), contract: CONTRACT }, price: { current: { currency: "ETH", decimals: 18, value: wei } }, ...over,
})

describe("parseOpenSeaListings", () => {
  it("reads ETH prices, keeps each token's cheapest listing, sorts cheapest first, and passes the cursor on", () => {
    const r = parseOpenSeaListings({ listings: [os(8213, "420000000000000000"), os(6942, "310000000000000000"), os(8213, "330000000000000000")], next: "abc" })!
    assert.deepEqual(r.listings, [{ tokenId: 6942, priceEth: 0.31 }, { tokenId: 8213, priceEth: 0.33 }])
    assert.equal(r.next, "abc")
  })
  it("drops anything that is not an active ETH listing for the Normies contract", () => {
    const r = parseOpenSeaListings({ listings: [
      os(1, "300000000000000000"),
      os(2, "300000000000000000", { status: "EXPIRED" }),
      os(3, "300000000000000000", { price: { current: { currency: "WETH", decimals: 18, value: "300000000000000000" } } }),
      os(4, "300000000000000000", { price: { current: { currency: "ETH", decimals: 6, value: "300000000000000000" } } }),
      os(5, "300000000000000000", { asset: { identifier: "5", contract: "0x0000000000000000000000000000000000000001" } }),
      os(6, "0"), os(7, "abc"), os(10001, "300000000000000000"), os("x", "300000000000000000"),
    ] })!
    assert.deepEqual(r.listings.map((l) => l.tokenId), [1])
    assert.equal(r.next, null)
  })
  it("a changed shape is null, never a price", () => {
    for (const bad of [null, {}, { listings: "x" }, "html", 4]) assert.equal(parseOpenSeaListings(bad), null)
  })
  it("asset links point at the Normies contract on OpenSea", () => {
    assert.equal(openSeaAssetUrl(6942), `https://opensea.io/item/ethereum/${CONTRACT}/6942`)
  })
})

describe("loadOpenSeaListings", () => {
  const page = (items: unknown[], next: string | null) => new Response(JSON.stringify({ listings: items, next }))
  it("without a key it does nothing (null), so a deployment with no key is unchanged", async () => {
    let called = false
    assert.equal(await loadOpenSeaListings(undefined, (async () => { called = true; return page([], null) }) as unknown as typeof fetch), null)
    assert.equal(await loadOpenSeaListings("  ", (async () => { called = true; return page([], null) }) as unknown as typeof fetch), null)
    assert.equal(called, false)
  })
  it("follows the cursor, merges duplicates across pages, sends the key, and stops at MAX_PAGES", async () => {
    const urls: string[] = []; const keys: string[] = []
    const f = (async (u: string, init: RequestInit) => {
      urls.push(u); keys.push((init.headers as Record<string, string>)["X-API-KEY"])
      const n = urls.length
      return page([os(n, `${300 + n}000000000000000`), os(1, "999000000000000000")], "cursor" + n)
    }) as unknown as typeof fetch
    const r = (await loadOpenSeaListings("k", f))!
    assert.equal(urls.length, MAX_PAGES)
    assert.match(urls[1], /next=cursor1/)
    assert.deepEqual(keys, ["k", "k", "k"])
    assert.deepEqual(r.map((l) => l.tokenId), [1, 2, 3]) // token 1 keeps its cheapest price (0.301)
    assert.equal(r[0].priceEth, 0.301)
  })
  it("stops cleanly when there is no next page", async () => {
    let n = 0
    const r = await loadOpenSeaListings("k", (async () => { n++; return page([os(9, "300000000000000000")], null) }) as unknown as typeof fetch)
    assert.equal(n, 1); assert.deepEqual(r, [{ tokenId: 9, priceEth: 0.3 }])
  })
  it("never throws: HTTP errors, junk and network failures are null; a later-page failure keeps what we have", async () => {
    assert.equal(await loadOpenSeaListings("k", (async () => new Response("no", { status: 429 })) as unknown as typeof fetch), null)
    assert.equal(await loadOpenSeaListings("k", (async () => new Response("<html>")) as unknown as typeof fetch), null)
    assert.equal(await loadOpenSeaListings("k", (async () => { throw new Error("down") }) as unknown as typeof fetch), null)
    let n = 0
    const r = await loadOpenSeaListings("k", (async () => (++n === 1 ? page([os(5, "300000000000000000")], "c") : new Response("no", { status: 500 }))) as unknown as typeof fetch)
    assert.deepEqual(r, [{ tokenId: 5, priceEth: 0.3 }])
  })
})

describe("listingsWithFallback", () => {
  const boom = (m: string) => async () => { throw new Error(m) }
  it("the Normies API answering first time never touches the fallback", async () => {
    let fb = 0
    assert.equal(await listingsWithFallback(async () => "api", async () => { fb++; return "os" }, 0), "api")
    assert.equal(fb, 0)
  })
  it("the API's retry wins when it works, even if the fallback also works", async () => {
    let n = 0
    assert.equal(await listingsWithFallback(async () => { if (++n === 1) throw new Error("empty"); return "api-retry" }, async () => "os", 0), "api-retry")
  })
  it("falls back when the API keeps failing", async () => {
    assert.equal(await listingsWithFallback(boom("empty"), async () => "os", 0), "os")
  })
  it("throws the API's own error when both fail; with no fallback it is the old single retry", async () => {
    await assert.rejects(() => listingsWithFallback(boom("api down"), boom("os down"), 0), /api down/)
    let n = 0
    assert.equal(await listingsWithFallback(async () => { if (++n === 1) throw new Error("x"); return "ok" }, null, 0), "ok")
    await assert.rejects(() => listingsWithFallback(boom("api down"), null, 0), /api down/)
  })
})

describe("the page says where the listings came from", () => {
  const snap = (): MarketSnapshot => ({
    livingSupply: 7226, wallets: 1723, censusTotal: 25873, oldestIndexedAt: "2026-10-05T12:00:00Z", walletScores: new Map(),
    originalPixels: new Map([[1, 600], [2, 700]]), pixelSupply: new Map([[600, 400], [700, 400]]),
  })
  const rt = (id: number): RarityToken => ({ id, rank: 4000, type: "Human", actionPoints: 5, awakenedAgent: false, fairValueEth: 0.29 })
  const deps = (over: Partial<Deps> = {}): Deps => ({
    resolveHolder: async () => ({ address: "0xabc", ens: null, tokenIds: [1] }),
    fetchTokens: async (ids) => ids.map(rt),
    fetchListings: async () => ({ items: [{ ...rt(2), actionPoints: 0, priceEth: 0.31 } as RawListing], floorEth: 0.31, total: 1, source: "opensea" }),
    loadSnapshot: async () => snap(),
    now: () => new Date("2026-10-05T21:00:00Z"),
    ...over,
  })
  it("OpenSea fallback: listings are ok, the note and caveat say so, and the floor is OpenSea's", async () => {
    const r = await buildBurnBuy({ wallet: "0xabc" }, deps())
    assert.equal(r.sources.listings.ok, true)
    assert.match(r.sources.listings.note ?? "", /come from OpenSea.*the cheapest 1 only/)
    assert.ok(r.caveats.some((c) => /straight from OpenSea/.test(c)))
    assert.equal(r.market?.floorEth, 0.31)
    assert.ok(r.market!.bestPixelFodder.length > 0)
  })
  it("the Normies API (or no source field): no OpenSea wording at all", async () => {
    const r = await buildBurnBuy({ wallet: "0xabc" }, deps({ fetchListings: async () => ({ items: [{ ...rt(2), actionPoints: 0, priceEth: 0.31 } as RawListing], floorEth: 0.31, total: 1 }) }))
    assert.doesNotMatch(JSON.stringify(r.sources) + r.caveats.join(" "), /OpenSea/)
  })
})
