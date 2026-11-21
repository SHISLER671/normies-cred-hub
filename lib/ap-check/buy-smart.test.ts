import { describe, it } from "node:test"
import assert from "node:assert/strict"

import { burnForBudget, burnForPixels, burnPicks, lensValue, MAX_BURNS, pixelsForBudget, planForBudget, planForPixels, type BurnCandidate } from "./buy-smart"

// Normal roll (Normies new standard, Nov 2026): 2-4% of ORIGINAL pixels for every pixel count; plus every attached pixel.
const c = (tokenId: number, priceEth: number, originalPixels: number, livePixels = 0): BurnCandidate => ({ tokenId, priceEth, originalPixels, livePixels })
const book = [
  { priceEth: 0.001, remaining: 100, partialRemaining: 100 },
  { priceEth: 0.002, remaining: 1000, partialRemaining: 1000 },
]

describe("burnPicks", () => {
  it("prices a burn as a roll of original pixels plus all live attached pixels", () => {
    const [p] = burnPicks([c(1, 0.3, 1000, 50)], "normal") // 2-4% of 1000 = 20-40, typical 30, plus 50
    assert.deepEqual([p.low, p.mid, p.high], [70, 80, 90])
    assert.equal(p.ethPerPixel, 0.3 / 80)
  })
  it("a fixed promo rate has no range", () => {
    const [p] = burnPicks([c(1, 0.3, 1000, 0)], "promo") // 4% of 1000
    assert.deepEqual([p.low, p.mid, p.high], [40, 40, 40])
  })
  it("a stripped Normie is priced as stripped (its live pixels, not what it used to have)", () => {
    const [full] = burnPicks([c(1, 0.3, 400, 300)], "normal")
    const [stripped] = burnPicks([c(1, 0.3, 400, 0)], "normal")
    assert.ok(full.mid > 300)
    assert.ok(stripped.mid < 20)
  })
  it("ranks cheapest per pixel first and drops listings that pay nothing or have no price", () => {
    const picks = burnPicks([c(1, 0.5, 1000), c(2, 0.3, 1000), c(3, 0.3, 0), c(4, 0, 1000)], "normal")
    assert.deepEqual(picks.map((p) => p.tokenId), [2, 1])
  })
})

describe("market side", () => {
  it("a budget walks the book from the cheapest level up", () => {
    assert.deepEqual(pixelsForBudget(book, 0.3), { pixels: 200, costEth: 0.3, approx: false, shortfall: 0 })
    assert.equal(pixelsForBudget(book, 0.0005).pixels, 0)
  })
  it("marks the figure approximate when it stops inside a level that must be bought whole", () => {
    assert.equal(pixelsForBudget([{ priceEth: 0.001, remaining: 100, partialRemaining: 0 }], 0.05).approx, true)
  })
})

describe("burn plans", () => {
  const picks = burnPicks([c(1, 0.3, 1000), c(2, 0.3, 1000), c(3, 0.3, 1000)], "normal") // each pays 20-40, typical 30
  it("for a pixel target: typical rolls need fewer Normies than worst rolls", () => {
    assert.equal(burnForPixels(picks, 60, "mid").picks.length, 2)
    assert.equal(burnForPixels(picks, 60, "low").picks.length, 3)
  })
  it("says when the listings cannot reach the target", () => {
    assert.equal(burnForPixels(picks, 1000).reached, false)
  })
  it("for a budget: only what fits, skipping a listing that would overshoot", () => {
    const plan = burnForBudget(burnPicks([c(1, 0.3, 1000), c(2, 0.9, 5000), c(3, 0.3, 1000)], "normal"), 0.65)
    assert.deepEqual(plan.picks.map((p) => p.tokenId).sort(), [1, 3])
    assert.equal(plan.costEth, 0.6)
  })
  it("never plans more than MAX_BURNS Normies", () => {
    const many = burnPicks(Array.from({ length: 60 }, (_, i) => c(i, 0.01, 100)), "normal")
    assert.equal(burnForPixels(many, 10_000).picks.length, MAX_BURNS)
  })
})

describe("burnForPixels picks the cheapest way to reach the target", () => {
  it("finishes with one cheap Normie instead of overshooting with a pricey one", () => {
    // Best per pixel: #1 (0.1 ETH for ~30). Then #2 is great per pixel but costs 1 ETH (~1040). #3 alone covers the rest for 0.12.
    const picks = burnPicks([c(1, 0.1, 1000), c(2, 1, 1000, 1000), c(3, 0.12, 1000)], "normal")
    const plan = burnForPixels(picks, 60, "mid")
    assert.deepEqual(plan.picks.map((p) => p.tokenId).sort(), [1, 3])
    assert.equal(plan.costEth, 0.22)
  })
  it("a single listing that covers everything wins when it is cheapest", () => {
    const picks = burnPicks([c(1, 0.1, 1000), c(2, 0.1, 1000), c(3, 0.15, 1000, 100)], "normal")
    assert.deepEqual(burnForPixels(picks, 120, "mid").picks.map((p) => p.tokenId), [3])
  })
  it("being sure (worst rolls) never costs less than the typical plan on the same listings", () => {
    const picks = burnPicks(Array.from({ length: 40 }, (_, i) => c(i, 0.05 + (i % 7) * 0.03, 300 + (i * 37) % 900, (i * 13) % 50)), "normal")
    for (const need of [30, 120, 400]) {
      const typical = burnForPixels(picks, need, "mid")
      const sure = burnForPixels(picks, need, "low")
      if (typical.reached && sure.reached) assert.ok(sure.costEth >= typical.costEth - 1e-9, `need ${need}`)
    }
  })
})

describe("which route costs less (labels, not verdicts)", () => {
  it("pixels: the market wins when it is cheaper", () => {
    const picks = burnPicks([c(1, 0.05, 1000), c(2, 0.05, 1000)], "normal") // 20-40 each for 0.05 ETH
    const a = planForPixels(picks, book, 60) // market: 60 x 0.001 = 0.06; burn: 2 x 0.05 = 0.1
    assert.equal(a.market?.costEth, 0.06)
    assert.equal(a.burn?.costEth, 0.1)
    assert.equal(a.lowerCost, "pixel_market")
  })
  it("pixels: cheaper with typical rolls but not with bad ones is a gamble", () => {
    const picks = burnPicks([c(1, 0.1, 1000), c(2, 0.1, 1000), c(3, 0.1, 1000)], "normal")
    const dear = [{ priceEth: 0.0035, remaining: 1000, partialRemaining: 1000 }]
    const a = planForPixels(picks, dear, 60) // market 0.21; burn typical 2 x 0.1 = 0.2; worst needs 3 = 0.3
    assert.equal(a.lowerCost, "burn_typical_rolls")
    assert.equal(a.costGapEth, 0.01)
  })
  it("pixels: burn is the clear winner when even the worst case is cheaper", () => {
    const picks = burnPicks([c(1, 0.05, 1000), c(2, 0.05, 1000), c(3, 0.05, 1000)], "normal")
    const dear = [{ priceEth: 0.003, remaining: 1000, partialRemaining: 1000 }]
    assert.equal(planForPixels(picks, dear, 60).lowerCost, "burn_even_worst_rolls") // market 0.18, sure burn 0.15
  })
  it("budget: compares pixels for the same money", () => {
    const picks = burnPicks([c(1, 0.1, 1000), c(2, 0.1, 1000)], "normal") // 2 burns: 40-80, typical 60
    assert.equal(planForBudget(picks, [{ priceEth: 0.006, remaining: 1000, partialRemaining: 1000 }], 0.2).lowerCost, "burn_even_worst_rolls") // market 33 < worst 40
    assert.equal(planForBudget(picks, [{ priceEth: 0.004, remaining: 1000, partialRemaining: 1000 }], 0.2).lowerCost, "burn_typical_rolls") // market 50: 40 < 50 < 60
    assert.equal(planForBudget(picks, book, 0.2).lowerCost, "pixel_market") // market 150
  })
  it("without an order book the label is unknown or only one-sided, never invented", () => {
    assert.equal(planForPixels([], null, 10).lowerCost, "unknown")
    assert.equal(planForBudget([], null, 1).lowerCost, "unknown")
  })
})

describe("lensValue", () => {
  it("prices one Normie's burn payout at the Pixel Market ask", () => {
    const v = lensValue(1000, 50, "normal", 0.3, 0.002)
    assert.deepEqual([v?.low, v?.mid, v?.high], [70, 80, 90]) // 2-4% of 1000 = 20-40, typical 30, plus 50 attached
    assert.equal(v?.marketValueEth, 0.16)
    assert.equal(v?.ethPerPixel, 0.3 / 80)
  })
  it("no book: no market value, never a guess", () => {
    assert.equal(lensValue(1000, 0, "normal", 0.3, null)?.marketValueEth, null)
  })
})
