import { describe, it } from "node:test"
import assert from "node:assert/strict"

import { promoWindow, promoWindowState, PROMO_EARLIEST_END_UTC, PROMO_LATEST_END_UTC } from "./promo-window"
import { promoNotice, buildPageModel } from "./narrate"
import { resolveYieldMode } from "./switches"
import { buildBurnBuy, type Deps, type MarketSnapshot, type RarityToken } from "./service"

const at = (iso: string) => new Date(iso)

describe("the announced 4% window (Serc: until 8 PM CET Monday Oct 5, maybe 1-2 hours earlier)", () => {
  it("the two bounds are 16:00 and 18:00 UTC on Oct 5 (8 PM Central European summer time is 18:00 UTC)", () => {
    assert.equal(PROMO_EARLIEST_END_UTC, "2026-10-05T16:00:00Z")
    assert.equal(PROMO_LATEST_END_UTC, "2026-10-05T18:00:00Z")
  })

  it("state flips exactly at each bound", () => {
    assert.equal(promoWindowState(at("2026-10-04T00:00:00Z")), "open")
    assert.equal(promoWindowState(at("2026-10-05T15:59:59.999Z")), "open")
    assert.equal(promoWindowState(at("2026-10-05T16:00:00Z")), "may-have-closed")
    assert.equal(promoWindowState(at("2026-10-05T17:59:59.999Z")), "may-have-closed")
    assert.equal(promoWindowState(at("2026-10-05T18:00:00Z")), "closed")
    assert.equal(promoWindowState(at("2026-12-01T00:00:00Z")), "closed")
  })

  it("promoWindow carries the bounds and the pinned flag", () => {
    assert.deepEqual(promoWindow(at("2026-10-05T17:00:00Z"), true), { state: "may-have-closed", earliestEnd: PROMO_EARLIEST_END_UTC, latestEnd: PROMO_LATEST_END_UTC, pinned: true })
  })
})

describe("the clock flips the burn yield by itself, and a pin always wins", () => {
  const night = [["2026-10-05T12:00:00Z", "promo"], ["2026-10-05T15:59:59Z", "promo"], ["2026-10-05T16:00:00Z", "normal"], ["2026-10-05T19:00:00Z", "normal"], ["2026-10-06T04:00:00Z", "normal"]] as const
  for (const [iso, mode] of night) {
    it(`unset at ${iso} -> ${mode} (not pinned)`, () => {
      assert.deepEqual(resolveYieldMode(undefined, at(iso)), { mode, pinned: false })
    })
  }
  it("a pin to promo survives the deadline (if the window is extended); a pin to normal works early", () => {
    assert.deepEqual(resolveYieldMode("promo", at("2026-10-06T04:00:00Z")), { mode: "promo", pinned: true })
    assert.deepEqual(resolveYieldMode("normal", at("2026-10-05T01:00:00Z")), { mode: "normal", pinned: true })
  })
})

const snap = (): MarketSnapshot => ({
  livingSupply: 7226, wallets: 1723, censusTotal: 25873, oldestIndexedAt: "2026-10-04T20:00:00Z", walletScores: new Map(),
  originalPixels: new Map([[1, 600], [3, 640]]), pixelSupply: new Map([[600, 400], [640, 400]]),
})
const rt = (id: number): RarityToken => ({ id, rank: 4000, type: "Human", actionPoints: 0, awakenedAgent: false, fairValueEth: 0.29 })
/** Deps whose clock AND yield mode follow the same rule the real site uses. */
const depsAt = (iso: string, pin?: string): Deps => {
  const now = new Date(iso)
  const r = resolveYieldMode(pin, now)
  return {
    resolveHolder: async () => ({ address: "0xabc", ens: null, tokenIds: [1, 3] }), fetchTokens: async (ids) => ids.map(rt),
    fetchListings: async () => ({ items: [], floorEth: 0.286, total: 0 }), loadSnapshot: async () => snap(),
    now: () => now, yieldMode: () => r.mode, yieldPinned: () => r.pinned,
  }
}

describe("what the API and the page say at each moment", () => {
  const asked = async (iso: string, pin?: string) => buildBurnBuy({ wallet: "0xabc" }, depsAt(iso, pin))

  it("Sunday night (open): 4%, the narrow window is stated, notice says it ends at 16:00 UTC (official)", async () => {
    const r = await asked("2026-10-04T12:00:00Z")
    assert.equal(r.yieldMode, "promo")
    assert.equal(r.promo.window.state, "open")
    assert.match(r.promo.ends, /official Normies Discord.*16:00 UTC on Monday, October 5.*about 16:23 UTC/)
    assert.match(promoNotice(r)!, /ends at 16:00 UTC on Monday, October 5 \(official Normies announcement\)/)
  })

  it("Monday 16:30 UTC (may have closed): the API is already on the normal roll, and the page warns", async () => {
    const r = await asked("2026-10-05T16:30:00Z")
    assert.equal(r.yieldMode, "normal")
    assert.equal(r.promo.ratePercent, null)
    assert.equal(r.promo.window.state, "may-have-closed")
    assert.ok(r.wallet!.advice.tokens.every((t) => t.yield.range), "figures are rolled, with ranges")
    const m = buildPageModel(r, "share")
    assert.ok(m.notices.some((n) => /has ended.*official Normies announcement.*16:00 UTC.*Check normies\.art/.test(n)))
  })

  it("Tuesday 04:00 Guam time = Monday 18:00 UTC (closed): normal roll, 'has ended' notice", async () => {
    const r = await asked("2026-10-05T18:00:00Z")
    assert.equal(r.promo.window.state, "closed")
    assert.equal(r.yieldMode, "normal")
    assert.ok(buildPageModel(r, "share").notices.some((n) => /The 4% rate ended on Monday, October 5 at 16:00 UTC/.test(n)))
  })

  it("the 'has ended' notice stops after 72 hours", async () => {
    assert.equal(promoNotice(await asked("2026-10-08T17:59:00Z")) !== null, true)
    assert.equal(promoNotice(await asked("2026-10-08T18:01:00Z")), null)
  })

  it("pinned to promo past the deadline: still 4%, but with a loud warning", async () => {
    const r = await asked("2026-10-05T20:00:00Z", "promo")
    assert.equal(r.yieldMode, "promo")
    assert.equal(r.promo.window.pinned, true)
    assert.match(promoNotice(r)!, /still showing the 4% rate because the site owner has pinned it/)
  })

  it("pinned to normal early (before the window): normal, no 4% notice", async () => {
    const r = await asked("2026-10-04T12:00:00Z", "normal")
    assert.equal(r.yieldMode, "normal")
    assert.equal(promoNotice(r), null)
  })
})
