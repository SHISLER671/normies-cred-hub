// Canvas costs (2026-11-10): the old readiness score is gone; Ask and Canvas Watch quote the official cost table.
import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  buildCanvasCostTable,
  CANON_CANVAS_PRICES,
  describeCanvasCosts,
  enlargeCoveredNow,
  nextEnlargeCost,
  pricesFromStatus,
} from "./canvasCosts"

const pixels = (attached: number, free: number | null = attached, locked: number | null = free == null ? null : attached - free) => ({ attached, free, locked })
const costs = (t: ReturnType<typeof buildCanvasCostTable>) => t.enlarge.map((l) => [l.size, l.cost])

describe("official cost table from the current size", () => {
  it("from 40×40: 900 / 2,000 / 3,300 / 4,800 in total", () => {
    const t = buildCanvasCostTable({ gridSize: 40, pixels: pixels(0) })
    assert.deepEqual(costs(t), [[50, 900], [60, 2000], [70, 3300], [80, 4800]])
  })
  it("from 50×50: an upgrade costs the difference", () => {
    const t = buildCanvasCostTable({ gridSize: 50, pixels: pixels(0) })
    assert.deepEqual(costs(t), [[60, 1100], [70, 2400], [80, 3900]])
  })
  it("from 70×70: only 80×80 is left (1,500); at 80×80 nothing", () => {
    assert.deepEqual(costs(buildCanvasCostTable({ gridSize: 70, pixels: pixels(0) })), [[80, 1500]])
    const top = buildCanvasCostTable({ gridSize: 80, pixels: pixels(0) })
    assert.deepEqual(top.enlarge, [])
    assert.ok(describeCanvasCosts(top, 1, "t").some((l) => /largest official size/.test(l)))
  })
  it("a missing gridSize is read as the 40×40 base, never guessed bigger", () => {
    assert.deepEqual(costs(buildCanvasCostTable({ gridSize: null, pixels: pixels(0) }))[0], [50, 900])
  })
  it("live prices from api.normies.art/canvas/status win over the launch prices; a bad shape is rejected", () => {
    const live = pricesFromStatus({ pixelMarket: { enlargePrices: { "50": 1000, "60": 2100, "70": 3400, "80": 4900 }, blankCanvasPrice: 250 } })
    assert.ok(live)
    assert.equal(live!.from, "chain")
    assert.deepEqual(costs(buildCanvasCostTable({ gridSize: 50, pixels: pixels(0), prices: live! }))[0], [60, 1100])
    assert.equal(pricesFromStatus({ pixelMarket: { enlargePrices: { "50": 900 } } }), null)
    assert.equal(pricesFromStatus(null), null)
    assert.equal(CANON_CANVAS_PRICES.blank, 200)
  })
})

describe("blank canvas (contract: one-time, not for Zombies)", () => {
  it("offered at 200 when the base is still there", () => {
    const t = buildCanvasCostTable({ gridSize: 40, pixels: pixels(300) })
    assert.equal(t.blank?.cost, 200)
    assert.equal(t.blankUnavailableReason, null)
  })
  it("baseCleared: no blank row, and the reason says it is one-time", () => {
    const t = buildCanvasCostTable({ gridSize: 40, baseCleared: true, pixels: pixels(300) })
    assert.equal(t.blank, null)
    assert.match(t.blankUnavailableReason!, /already cleared; a blank canvas is one-time/)
    assert.ok(describeCanvasCosts(t, 9, "t")[0].includes("base art cleared"))
  })
  it("Zombies cannot blank", () => {
    const t = buildCanvasCostTable({ gridSize: 40, isZombie: true, pixels: pixels(300) })
    assert.equal(t.blank, null)
    assert.match(t.blankUnavailableReason!, /Zombies/)
  })
})

describe("free vs locked pixels, and the Level after paying", () => {
  it("free pixels cover it: no paint is cleared, Level drops by cost / 10", () => {
    const [to50] = buildCanvasCostTable({ gridSize: 40, pixels: pixels(1000, 950, 50) }).enlarge
    assert.equal(to50.shortUsingFree, 0)
    assert.equal(to50.clearsPaintIfPaidFromNormie, false)
    assert.equal(to50.levelAfterPayingFromNormie, 11) // 1000 - 900 = 100 → 100/10 + 1
  })
  it("only with locked pixels: it can still pay, but the contract clears the painted overlay", () => {
    const t = buildCanvasCostTable({ gridSize: 40, pixels: pixels(1000, 400, 600) })
    const [to50] = t.enlarge
    assert.equal(to50.shortUsingFree, 500)
    assert.equal(to50.shortUsingAttached, 0)
    assert.equal(to50.clearsPaintIfPaidFromNormie, true)
    const lines = describeCanvasCosts(t, 42, "2026-11-10T00:00:00Z")
    assert.ok(lines.some((l) => /To 50×50: 900 #PIXEL\. 500 more than its free pixels; all its attached pixels cover it\. Paid from the Normie, its Level goes from 101 to 11 and the painted overlay is cleared/.test(l)), lines.join("\n"))
    assert.ok(lines.some((l) => /Locked pixels can pay too, but then the contract clears the painted overlay/.test(l)))
  })
  it("split unknown: both are shown as unknown, never assumed free", () => {
    const t = buildCanvasCostTable({ gridSize: 40, pixels: pixels(1000, null, null) })
    assert.equal(t.enlarge[0].shortUsingFree, null)
    assert.equal(t.enlarge[0].clearsPaintIfPaidFromNormie, null)
    assert.match(describeCanvasCosts(t, 1, "t")[0], /free\/locked split not reported/)
  })
  it("not enough on the Normie: no Level after paying, the gap is stated", () => {
    const [to50] = buildCanvasCostTable({ gridSize: 40, pixels: pixels(120) }).enlarge
    assert.equal(to50.levelAfterPayingFromNormie, null)
    assert.equal(to50.shortUsingAttached, 780)
  })
})

describe("wallet line only when a wallet is given; sources and as-of always", () => {
  it("no wallet: says it was not read", () => {
    const lines = describeCanvasCosts(buildCanvasCostTable({ gridSize: 40, pixels: pixels(0) }), 7, "2026-11-10T01:00:00Z")
    assert.ok(lines.some((l) => /Wallet #PIXEL not read here \(no wallet given\)/.test(l)))
    assert.ok(!lines.some((l) => /wallet holds|wallet's #PIXEL covers/.test(l)))
    assert.match(lines[0], /Source: api\.normies\.art canvas\/info, as of 2026-11-10T01:00:00Z/)
  })
  it("wallet given: its gap is on every row", () => {
    const t = buildCanvasCostTable({ gridSize: 40, pixels: pixels(0), walletPixels: 1000 })
    assert.equal(t.enlarge[0].shortUsingWallet, 0)
    assert.equal(t.enlarge[1].shortUsingWallet, 1000)
    const lines = describeCanvasCosts(t, 7, "t")
    assert.ok(lines.some((l) => /the wallet's #PIXEL covers it/.test(l)))
    assert.ok(!lines.some((l) => /no wallet given/.test(l)))
  })
  it("no line calls a Normie ready or gives it a score", () => {
    const text = describeCanvasCosts(buildCanvasCostTable({ gridSize: 40, pixels: pixels(5000), walletPixels: 10 }), 7, "t").join("\n")
    assert.doesNotMatch(text, /\bready\b|score|recommend|should/i)
  })
})

describe("Canvas Watch alert: the official next-size cost (900 from 40×40), not a 200 AP target", () => {
  it("next size cost", () => {
    assert.deepEqual(nextEnlargeCost(40), { size: 50, cost: 900 })
    assert.deepEqual(nextEnlargeCost(60), { size: 70, cost: 1300 })
    assert.equal(nextEnlargeCost(80), null)
  })
  it("fires once, when the attached pixels first cover the next size", () => {
    assert.equal(enlargeCoveredNow(200, 40, 0), null)
    assert.equal(enlargeCoveredNow(899, 40, 0), null)
    assert.deepEqual(enlargeCoveredNow(900, 40, 899), { size: 50, cost: 900 })
    assert.deepEqual(enlargeCoveredNow(900, 40, undefined), { size: 50, cost: 900 })
    assert.equal(enlargeCoveredNow(950, 40, 900), null)
    assert.deepEqual(enlargeCoveredNow(1100, 50, 1000), { size: 60, cost: 1100 })
    assert.equal(enlargeCoveredNow(9000, 80, 0), null)
  })
})
