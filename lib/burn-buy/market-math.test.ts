import { describe, it } from "node:test"
import assert from "node:assert/strict"

import { parseMarketStats, loadPixelMarket } from "./market-feed"
import { breakEvenNormieEth, buyCost, compareToAsk, monthlyPoolScenarios, paybackScenarios, queueAhead, sellProceeds, sellRows, weiToEth, type DepthLevel } from "./market-math"
import { walletScore } from "./score"

// Captured from https://api.normies.art/market/stats and /market/depth on 2026-10-05 ~20:40 UTC.
const REAL_STATS = { volumeWei: "71900000000000000", feesWei: "7190000000000000", feesCollectedWei: "7190000000000000", pixelsTraded: "4", fills: 3, listings: 21, feeBps: 1000, revenueShareBps: 5000, paused: false, activeListings: 17, pixelsListed: 499, bestAskWei: "16900000000000000", lastPriceWei: "17000000000000000", lastFillTimestamp: "1791230819", volume24hWei: "71900000000000000", pixels24h: 4, blockNumber: "26128469", timestamp: "1791231023" }
const REAL_DEPTH = { levels: [
  { pricePerPixel: "16900000000000000", remaining: 5, listings: 1, partialRemaining: 5 },
  { pricePerPixel: "17000000000000000", remaining: 2, listings: 1, partialRemaining: 2 },
  { pricePerPixel: "17500000000000000", remaining: 143, listings: 1, partialRemaining: 143 },
  { pricePerPixel: "19900000000000000", remaining: 49, listings: 1, partialRemaining: 49 },
] }

const depth: DepthLevel[] = [
  { priceEth: 0.0169, remaining: 5, partialRemaining: 5 },
  { priceEth: 0.017, remaining: 2, partialRemaining: 2 },
  { priceEth: 0.0175, remaining: 143, partialRemaining: 143 },
]

describe("weiToEth", () => {
  it("parses wei strings and refuses anything else", () => {
    assert.equal(weiToEth("16900000000000000"), 0.0169)
    assert.equal(weiToEth("0"), 0)
    for (const bad of [null, undefined, 5, "1.5", "-1", "abc", ""]) assert.equal(weiToEth(bad), null)
  })
})

describe("parseMarketStats (real 2026-10-05 responses)", () => {
  it("reads the best ask, last price, fee and the book", () => {
    const m = parseMarketStats(REAL_STATS, REAL_DEPTH, "t")!
    assert.equal(m.bestAskEth, 0.0169)
    assert.equal(m.lastPriceEth, 0.017)
    assert.equal(m.volume24hEth, 0.0719)
    assert.equal(m.feeBps, 1000)
    assert.equal(m.revenueShareBps, 5000)
    assert.equal(m.activeListings, 17)
    assert.equal(m.pixelsListed, 499)
    assert.deepEqual(m.depth.map((l) => l.priceEth), [0.0169, 0.017, 0.0175, 0.0199])
  })
  it("an empty book has no best ask, not a made-up one", () => {
    const m = parseMarketStats({ ...REAL_STATS, bestAskWei: null, lastPriceWei: null, activeListings: 0, pixelsListed: 0 }, { levels: [] }, "t")!
    assert.equal(m.bestAskEth, null); assert.equal(m.lastPriceEth, null); assert.deepEqual(m.depth, [])
  })
  it("is strict: a changed shape is null, never a price", () => {
    for (const [s, d] of [[null, REAL_DEPTH], [REAL_STATS, null], [{ ...REAL_STATS, feeBps: "1000" }, REAL_DEPTH], [{ ...REAL_STATS, paused: "no" }, REAL_DEPTH], [{ ...REAL_STATS, feeBps: 99999 }, REAL_DEPTH], [REAL_STATS, { levels: "x" }], [REAL_STATS, { levels: [{ pricePerPixel: "abc", remaining: 1, partialRemaining: 1 }] }], [REAL_STATS, { levels: [{ pricePerPixel: "0", remaining: 1, partialRemaining: 1 }] }]] as const) {
      assert.equal(parseMarketStats(s, d, "t"), null, JSON.stringify([s, d]).slice(0, 80))
    }
  })
  it("loadPixelMarket never throws: HTTP errors, timeouts and junk are null", async () => {
    assert.equal(await loadPixelMarket((async () => new Response("no", { status: 404 })) as unknown as typeof fetch), null)
    assert.equal(await loadPixelMarket((async () => { throw new Error("down") }) as unknown as typeof fetch), null)
    assert.equal(await loadPixelMarket((async () => new Response("not json", { status: 200 })) as unknown as typeof fetch), null)
    const ok = (async (u: string) => new Response(JSON.stringify(String(u).endsWith("stats") ? REAL_STATS : REAL_DEPTH))) as unknown as typeof fetch
    assert.equal((await loadPixelMarket(ok))?.bestAskEth, 0.0169)
  })
})

describe("buyCost walks the book", () => {
  it("5 #PIXEL is all at the best ask", () => {
    assert.deepEqual(buyCost(depth, 5), { filled: 5, shortfall: 0, costEth: 0.0845, avgEth: 0.0169, worstEth: 0.0169, approx: false })
  })
  it("the price rises as you go: 10 = 5 at 0.0169 + 2 at 0.017 + 3 at 0.0175", () => {
    const c = buyCost(depth, 10)
    assert.equal(c.costEth, 0.171) // 0.0845 + 0.034 + 0.0525
    assert.equal(c.avgEth, 0.0171)
    assert.equal(c.worstEth, 0.0175)
  })
  it("a thin book reports the shortfall instead of pretending", () => {
    const c = buyCost(depth, 500)
    assert.equal(c.filled, 150); assert.equal(c.shortfall, 350)
  })
  it("zero, negative and fractional asks are safe", () => {
    assert.equal(buyCost(depth, 0).filled, 0); assert.equal(buyCost(depth, -3).avgEth, null); assert.equal(buyCost(depth, 2.9).filled, 2)
    assert.equal(buyCost([], 5).shortfall, 5)
  })
  it("flags an estimate when a level holds listings that must be bought whole", () => {
    assert.equal(buyCost([{ priceEth: 0.02, remaining: 10, partialRemaining: 4 }], 3).approx, true)
  })
  it("is order-independent", () => {
    assert.deepEqual(buyCost([...depth].reverse(), 10), buyCost(depth, 10))
  })
})

describe("seller arithmetic", () => {
  it("the 10% fee comes off the seller: 92 at 0.0169 grosses 1.5548 and nets 1.39932", () => {
    assert.deepEqual(sellProceeds(92, 0.0169, 1000), { grossEth: 1.5548, feeEth: 0.15548, netEth: 1.39932 })
  })
  it("queueAhead counts what is listed at or below your price", () => {
    assert.equal(queueAhead(depth, 0.0169), 5)
    assert.equal(queueAhead(depth, 0.017), 7)
    assert.equal(queueAhead(depth, 0.01), 0)
    assert.equal(queueAhead(depth, 1), 150)
  })
  it("sellRows: the cushion keeps the boost, everything drops it, and the score shown is the formula's", () => {
    const rows = sellRows({ held: 8, pixel: 192, spare: 92, prices: [{ label: "the best ask", priceEth: 0.0169 }], depth, feeBps: 1000, othersScore: 28_000 })
    assert.equal(rows.length, 2)
    assert.equal(rows[0].pixels, 92)
    assert.equal(rows[0].scoreAfter, Math.round(walletScore(8, 100) * 100) / 100) // still 100 #PIXEL: boost kept
    assert.equal(rows[1].pixels, 192)
    assert.equal(rows[1].scoreAfter, Math.round(walletScore(8, 0) * 100) / 100)
    assert.ok(rows[1].scoreAfter < rows[0].scoreAfter)
    assert.equal(rows[0].ahead, 5)
  })
  it("with no boost to protect, all of it is 'the cushion' and there is one row per price", () => {
    const rows = sellRows({ held: 1, pixel: 12, spare: 12, prices: [{ label: "a", priceEth: 0.02 }, { label: "b", priceEth: 0.03 }], depth, feeBps: 1000, othersScore: 1000 })
    assert.equal(rows.length, 2); assert.match(rows[0].label, /all of it/)
  })
})

describe("burn versus market, per #PIXEL", () => {
  it("market cheaper only when the ask is below even the best roll; burn cheaper only when above even the worst", () => {
    const burn = { low: 0.0154, mid: 0.0195, high: 0.0308 }
    assert.equal(compareToAsk(burn, 0.0139), "market-cheaper")
    assert.equal(compareToAsk(burn, 0.0169), "depends-on-roll")
    assert.equal(compareToAsk(burn, 0.032), "burn-cheaper")
  })
  it("a fixed rate has no range, so the call is clean", () => {
    const fixed = { low: 0.0139, mid: 0.0139, high: 0.0139 }
    assert.equal(compareToAsk(fixed, 0.0169), "burn-cheaper")
    assert.equal(compareToAsk(fixed, 0.01), "market-cheaper")
  })
  it("break-even Normie price = pays x ask", () => {
    assert.equal(breakEvenNormieEth(19, 0.0169), 0.3211)
  })
})

describe("payback scenarios", () => {
  it("are three labelled pools built on the article's published pace, not invented numbers", () => {
    const s = monthlyPoolScenarios()
    assert.equal(s.length, 3)
    assert.equal(s[1].poolEthPerMonth, 11.26) // 81.09 ETH over 216 days, per 30 days
    assert.ok(s[0].poolEthPerMonth < s[1].poolEthPerMonth && s[1].poolEthPerMonth < s[2].poolEthPerMonth)
  })
  it("a bigger pool pays back faster; no score gain means no payback", () => {
    const rows = paybackScenarios(1.5, 8, 192, 500, 28_000)
    assert.ok(rows[0].months! > rows[1].months! && rows[1].months! > rows[2].months!)
    assert.deepEqual(paybackScenarios(1.5, 8, 192, 192, 28_000).map((r) => r.months), [null, null, null])
  })
  it("matches the share formula by hand for one case", () => {
    const [, mid] = paybackScenarios(1, 1, 0, 100, 1000)
    const before = walletScore(1, 0), after = walletScore(1, 100)
    const gain = after / (1000 + after) - before / (1000 + before)
    assert.equal(mid.monthlyEth, Math.round(11.26 * gain * 1e5) / 1e5)
  })
})
