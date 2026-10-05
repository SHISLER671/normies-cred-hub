import { describe, it } from "node:test"
import assert from "node:assert/strict"

import { buildPageModel, cliffCostSentences, GOALS, marketLineText, parseGoal } from "./narrate"
import { cliffCost, type PixelMarketSnapshot } from "./market-math"
import { buildBurnBuy, type Deps, type MarketSnapshot, type RarityToken, type RawListing } from "./service"

const book = (over: Partial<PixelMarketSnapshot> = {}): PixelMarketSnapshot => ({
  asOf: "2026-10-05T20:40:00Z", bestAskEth: 0.0169, lastPriceEth: 0.017, volume24hEth: 0.0719, pixels24h: 4, activeListings: 17, pixelsListed: 499,
  feeBps: 1000, revenueShareBps: 5000, paused: false,
  depth: [{ priceEth: 0.0169, remaining: 5, partialRemaining: 5 }, { priceEth: 0.017, remaining: 2, partialRemaining: 2 }, { priceEth: 0.0175, remaining: 143, partialRemaining: 143 }],
  ...over,
})
const snap = (): MarketSnapshot => ({
  livingSupply: 7226, wallets: 1723, censusTotal: 25873, oldestIndexedAt: "2026-10-04T20:00:00Z", walletScores: new Map(),
  originalPixels: new Map([[1, 600], [2, 700], [3, 300], [4, 650]]), pixelSupply: new Map([[600, 400], [700, 400], [300, 400], [650, 400]]),
})
const rt = (id: number, ap = 60): RarityToken => ({ id, rank: 4000, type: "Human", actionPoints: ap, awakenedAgent: false, fairValueEth: 0.29 })
const lst = (id: number, priceEth: number): RawListing => ({ ...rt(id, 0), priceEth })
const deps = (over: Partial<Deps> = {}): Deps => ({
  resolveHolder: async () => ({ address: "0xabc", ens: null, tokenIds: [1, 3] }),
  fetchTokens: async (ids) => ids.map((id) => rt(id)), // 2 Normies x 60 AP = 120 #PIXEL: standing on the 100 line with 20 to spare
  fetchListings: async () => ({ items: [lst(2, 0.3), lst(4, 0.32)], floorEth: 0.286, total: 2 }),
  loadSnapshot: async () => snap(),
  now: () => new Date("2026-10-05T21:00:00Z"),
  marketState: () => "live",
  ...over,
})

describe("the Sell goal", () => {
  it("is a real tab and only the exact word selects it", () => {
    assert.ok(GOALS.some((g) => g.id === "sell"))
    assert.equal(parseGoal("sell"), "sell")
    for (const v of ["Sell", "selling", "", null, undefined, "x"]) assert.equal(parseGoal(v as string | null | undefined), "share")
  })
  it("prices the cushion and says what dropping a boost does, with no verdict", async () => {
    const r = await buildBurnBuy({ wallet: "0xabc" }, deps({ pixelMarket: async () => book() }))
    const m = buildPageModel(r, "sell")
    assert.match(m.headline, /You can sell up to 20 #PIXEL and keep your boost: about 0\.3042 ETH at the best ask after the 10% fee/) // 20 x 0.0169 x 0.9
    assert.ok(m.sellView && m.sellView.rows.length >= 2)
    assert.match(m.sellView!.rows[0].net, /0\.3042 ETH net/)
    assert.deepEqual([m.rows, m.moves, m.fodder], [[], [], []], "the Sell view hides burn rows, moves and the fodder table")
    assert.ok(m.goalNotes.some((n) => /sell-side order book/.test(n)))
    assert.ok(m.goalNotes.some((n) => /still counts toward your score until it sells/.test(n)))
    const text = JSON.stringify(m)
    assert.doesNotMatch(text, /you should sell|worth selling|good time to sell|best price/i)
  })
  it("a wallet with no #PIXEL has nothing to sell, and no book means no price", async () => {
    const none = await buildBurnBuy({ wallet: "0xabc" }, deps({ fetchTokens: async (ids) => ids.map((id) => rt(id, 0)), pixelMarket: async () => book() }))
    assert.match(buildPageModel(none, "sell").headline, /no #PIXEL, so there is nothing to sell/)
    const down = await buildBurnBuy({ wallet: "0xabc" }, deps({ pixelMarket: async () => null }))
    const m = buildPageModel(down, "sell")
    assert.match(m.headline, /order book could not be read/)
    assert.equal(m.sellView, null)
  })
  it("before the market is live there is nothing to sell into", async () => {
    const r = await buildBurnBuy({ wallet: "0xabc" }, deps({ marketState: () => "pending", pixelMarket: async () => book() }))
    assert.equal(r.pixelMarket, null)
    assert.match(buildPageModel(r, "sell").headline, /not open yet/)
  })
})

describe("live numbers on the page", () => {
  it("the market line is a labelled snapshot with the real fields", () => {
    const t = marketLineText(book())!
    assert.match(t, /best ask 0\.0169 ETH per #PIXEL/)
    assert.match(t, /last fill 0\.017/)
    assert.match(t, /499 #PIXEL listed in 17 listings/)
    assert.match(t, /A snapshot of a new, thin market/)
    assert.equal(marketLineText(null), null)
    assert.match(marketLineText(book({ bestAskEth: null, lastPriceEth: null, activeListings: 0, pixelsListed: 0 }))!, /nothing listed right now/)
    assert.match(marketLineText(book({ paused: true }))!, /paused/)
  })
  it("fodder rows carry the comparison with the ask and the break-even Normie price", async () => {
    const r = await buildBurnBuy({ wallet: "0xabc" }, deps({ pixelMarket: async () => book(), yieldMode: () => "normal", yieldPinned: () => true }))
    const m = buildPageModel(r, "share")
    assert.ok(m.marketLine)
    assert.ok(m.fodder.length > 0)
    for (const f of m.fodder) {
      assert.ok(f.vsAsk && /ask \(0\.0169\)/.test(f.vsAsk), f.vsAsk ?? "null")
      assert.match(f.breakEven ?? "", /ETH/)
    }
  })
  it("without a live book the fodder rows carry no comparison and no market line", async () => {
    const r = await buildBurnBuy({ wallet: "0xabc" }, deps({ pixelMarket: async () => null }))
    const m = buildPageModel(r, "share")
    assert.equal(m.marketLine, null)
    for (const f of m.fodder) assert.deepEqual([f.vsAsk, f.breakEven], [null, null])
  })
  it("the cliff-cost sentence states the cost, the rising price and labelled-illustrative payback", () => {
    const c = cliffCost(2, 10, { at: 15, needMore: 5, value: 0.15 }, book().depth, 28_000)
    const s = cliffCostSentences(c).join(" ")
    assert.match(s, /buying 5 more: about 0\.0845 ETH off the book today/)
    assert.match(s, /the price rises as you buy/)
    assert.match(s, /illustrative scenarios.*NOT forecasts/)
    assert.deepEqual(cliffCostSentences(null), [])
  })
  it("a book too thin for the step says so and shows no payback", () => {
    const c = cliffCost(2, 10, { at: 500, needMore: 490, value: 0.6 }, book().depth, 28_000)
    const s = cliffCostSentences(c).join(" ")
    assert.match(s, /too thin to fill the next boost.*only 150 of the 490/)
    assert.doesNotMatch(s, /illustrative/)
  })
})
