// Tests for the Pixel Market launch-day fixes (2026-10-05).
// Run: npx tsx --test lib/burn-buy/launch-fixes.test.ts
import { describe, it } from "node:test"
import assert from "node:assert/strict"

import { requireListings, withTimeout } from "./data"
import { buildPageModel } from "./narrate"
import { buildBurnBuy, type Deps, type MarketSnapshot, type RawListing, type RarityToken } from "./service"

const NOW = new Date("2026-10-05T10:00:00.000Z")

function snapshot(pixels: Record<number, number>): MarketSnapshot {
  const originalPixels = new Map(Object.entries(pixels).map(([k, v]) => [Number(k), v]))
  const pixelSupply = new Map<number, number>()
  for (const px of originalPixels.values()) pixelSupply.set(px, (pixelSupply.get(px) ?? 0) + 100)
  return { livingSupply: 7226, wallets: 1723, censusTotal: 25873, originalPixels, pixelSupply, oldestIndexedAt: "2026-10-04T18:00:00Z", walletScores: new Map() }
}
const tk = (id: number, over: Partial<RarityToken> = {}): RarityToken => ({
  id, rank: 4000, type: "Human", actionPoints: 0, awakenedAgent: false, fairValueEth: 0.29, ...over,
})
const lst = (id: number, priceEth: number, over: Partial<RawListing> = {}): RawListing => ({ ...tk(id), priceEth, ...over })

function deps(over: Partial<Deps> = {}): Deps {
  return {
    resolveHolder: async () => ({ address: "0xabc", ens: null, tokenIds: [] }),
    fetchTokens: async () => [],
    fetchListings: async () => ({ items: [lst(2, 0.3)], floorEth: 0.286, total: 1 }),
    loadSnapshot: async () => snapshot({ 1: 700, 2: 900, 3: 500, 4: 600, 7141: 454 }),
    now: () => NOW,
    ...over,
  }
}

describe("requireListings: an empty answer is a failure, not an empty market", () => {
  it("throws when no listing came back", async () => {
    await assert.rejects(requireListings(async () => ({ items: [], total: 0 })), /no listings came back/)
  })
  it("throws when listings came back but none had a usable price", async () => {
    await assert.rejects(requireListings(async () => ({ items: [], total: 340 })), /without usable prices/)
  })
  it("passes a real answer through untouched", async () => {
    const r = await requireListings(async () => ({ items: [1], total: 1 }))
    assert.deepEqual(r, { items: [1], total: 1 })
  })
})

describe("withTimeout", () => {
  it("rejects with our message when the work is too slow", async () => {
    await assert.rejects(withTimeout(new Promise(() => {}), 20, "too slow"), /too slow/)
  })
  it("returns the value when the work is fast enough", async () => {
    assert.equal(await withTimeout(Promise.resolve(7), 1_000, "too slow"), 7)
  })
})

describe("service: launch-day failure modes", () => {
  it("every listing skipped (none in the index): listings are marked DOWN, not silently empty", async () => {
    const r = await buildBurnBuy({}, deps({ fetchListings: async () => ({ items: [lst(9999, 0.3)], floorEth: 0.286, total: 1 }) }))
    assert.equal(r.sources.listings.ok, false)
    assert.match(r.sources.listings.error!, /all 1 listings were skipped/)
  })

  it("listings down: an own burn with no fair value is 'unknown cost', never ranked as the best move", async () => {
    const r = await buildBurnBuy(
      { wallet: "0xabc" },
      deps({
        resolveHolder: async () => ({ address: "0xabc", ens: null, tokenIds: [1, 3, 7141] }),
        fetchTokens: async () => [tk(1, { fairValueEth: null }), tk(3, { fairValueEth: null }), tk(7141, { awakenedAgent: true })],
        fetchListings: async () => { throw new Error("listings took longer than 6 s") },
      }),
    )
    const own = r.wallet!.advice.moves.filter((m) => m.kind === "burn-own")
    assert.ok(own.length > 0, "there are own-burn moves to check")
    assert.ok(own.every((m) => m.costKnown === false && m.gainPerEth === null))
  })

  it("one clock per request: yieldMode and the promo window both get the same Date", async () => {
    const seen: Array<Date | undefined> = []
    await buildBurnBuy({}, deps({
      yieldMode: (now) => { seen.push(now); return "promo" },
      yieldPinned: (now) => { seen.push(now); return false },
    }))
    assert.equal(seen.length, 2)
    assert.equal(seen[0], NOW)
    assert.equal(seen[1], NOW)
  })

  it("market live: the wallet note no longer says '#PIXEL has no market price yet'", async () => {
    const r = await buildBurnBuy(
      { wallet: "0xabc" },
      deps({
        resolveHolder: async () => ({ address: "0xabc", ens: null, tokenIds: [7141] }),
        fetchTokens: async () => [tk(7141, { awakenedAgent: true })],
        marketState: () => "live",
      }),
    )
    assert.ok(!r.wallet!.advice.notes.some((n) => /no market price yet/.test(n)))
    assert.ok(r.wallet!.advice.notes.some((n) => /does not read live #PIXEL prices yet/.test(n)))
  })
})

describe("page model: listings down is said out loud", () => {
  it("a holder with no moves because listings failed gets an honest headline and a notice", async () => {
    const r = await buildBurnBuy(
      { wallet: "0xabc" },
      deps({
        resolveHolder: async () => ({ address: "0xabc", ens: null, tokenIds: [7141] }),
        fetchTokens: async () => [tk(7141, { awakenedAgent: true, actionPoints: 12 })],
        fetchListings: async () => { throw new Error("no listings came back") },
      }),
    )
    const m = buildPageModel(r, "share")
    assert.match(m.headline, /Market data did not load/)
    assert.ok(m.notices.some((n) => /Market listings did not load/.test(n)))
  })

  it("listings fine: no market notice is added", async () => {
    const r = await buildBurnBuy(
      { wallet: "0xabc" },
      deps({
        resolveHolder: async () => ({ address: "0xabc", ens: null, tokenIds: [7141] }),
        fetchTokens: async () => [tk(7141, { awakenedAgent: true, actionPoints: 12 })],
      }),
    )
    const m = buildPageModel(r, "share")
    assert.ok(!m.notices.some((n) => /Market listings did not load/.test(n)))
  })
})
