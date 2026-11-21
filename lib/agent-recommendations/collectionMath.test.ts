import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { computeCollectionMath, formatCollectionMath, isCollectionMathQuery, ORIGINAL_SUPPLY } from "./collectionMath"

const SOURCE = "test index"
const AS_OF = "2026-11-10T00:00:00.000Z"

/** Three living Normies, small to big: 400, 600, 1000. Every pixel count rolls 2–4% (Normies new standard, Nov 2026). */
function snap(extra: Partial<{ attachedActionPoints: number }> = {}) {
  return {
    originalPixels: new Map([
      [1, 400],
      [2, 600],
      [3, 1000],
    ]),
    oldestIndexedAt: AS_OF,
    ...extra,
  }
}

describe("computeCollectionMath (normal mode: a flat 2–4% roll)", () => {
  const m = computeCollectionMath(snap({ attachedActionPoints: 77 }), "normal", SOURCE)

  it("counts living, burned and pixels exactly", () => {
    assert.equal(m.livingSupply, 3)
    assert.equal(m.burnedSoFar, ORIGINAL_SUPPLY - 3)
    assert.equal(m.totalOriginalPixels, 2000)
    assert.equal(m.averagePixels, 667)
  })

  it("sums the 2%, middle and 4% rolls with the same integer math as /burn", () => {
    // min: 2% of each = 8 + 12 + 20 = 40
    // max: 4% of each = 16 + 24 + 40 = 80
    // middle: round(400*6/200)=12, round(600*6/200)=18, round(1000*6/200)=30 → 60
    assert.deepEqual(m.fromPixels, { min: 40, middle: 60, max: 80 })
  })

  it("keeps the biggest Normie as the last receiver (a burn needs a survivor)", () => {
    assert.equal(m.allButOne.keptTokenPixels, 1000)
    assert.deepEqual({ min: m.allButOne.min, middle: m.allButOne.middle, max: m.allButOne.max }, { min: 20, middle: 30, max: 40 })
  })

  it("puts every Normie in one 2–4% group (no pixel-count tiers since the new standard)", () => {
    assert.deepEqual(
      m.tiers.map((t) => [t.label, t.minPct, t.maxPct, t.normies, t.pixels]),
      [["every pixel count", 2, 4, 3, 2000]],
    )
    assert.match(formatCollectionMath(m), /All Normies: 3 Normies, 2,000 pixels, yields 2–4% each/)
    assert.match(formatCollectionMath(m), /between 2% and 4%/)
  })

  it("reports attached #PIXEL as moved, not new", () => {
    assert.equal(m.attachedActionPoints, 77)
    assert.match(formatCollectionMath(m), /Already on living Normies today: 77 #PIXEL\. A burn moves that/)
  })
})

describe("promo mode: a flat 4%", () => {
  it("has one number, not a range", () => {
    const m = computeCollectionMath(snap(), "promo", SOURCE)
    assert.deepEqual(m.fromPixels, { min: 80, middle: 80, max: 80 })
    assert.match(formatCollectionMath(m), /80 new #PIXEL from pixels\./)
  })
})

describe("formatCollectionMath", () => {
  const text = formatCollectionMath(computeCollectionMath(snap(), "normal", SOURCE))
  it("carries the source and as-of time", () => {
    assert.match(text, /Source: test index, as of 2026-11-10 00:00 UTC/)
  })
  it("uses plain words, never a bare AP", () => {
    assert.doesNotMatch(text, /\bAP\b/)
  })
  it("says attached #PIXEL is unknown rather than zero when the index lacks it", () => {
    assert.match(text, /not available this turn/)
  })
})

describe("isCollectionMathQuery", () => {
  it("matches collection-wide questions", () => {
    for (const q of [
      "Has anyone tried to figure out the possible amount of #pixel that is possible if every Normie was burnt?",
      "How much #PIXEL would exist if every Normie was burned?",
      "what's the total pixel supply",
      "how many normies are left?",
      "how many Normies have been burned so far",
      "max #pixel if all normies burn",
    ]) {
      assert.equal(isCollectionMathQuery(q), true, q)
    }
  })
  it("leaves single-Normie and market questions alone", () => {
    for (const q of [
      "Tell me about #7141",
      "market status",
      "is the pixel market live?",
      "How do I raise my Level?",
      // A named Normie is a single-Normie question (GrokBot review of #156).
      "max #PIXEL if I burn #1234",
      "total pixels on normie 55",
    ]) {
      assert.equal(isCollectionMathQuery(q), false, q)
    }
  })
})
