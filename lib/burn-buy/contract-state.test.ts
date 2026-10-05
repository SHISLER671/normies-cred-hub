import { describe, it } from "node:test"
import assert from "node:assert/strict"

import { buildBurnBuy, type Deps, type MarketSnapshot } from "./service"
import { contractRate, loadBurnContractStatus, matchesKnownTiers, parseContractStatus } from "./contract-state"
import { promoNotice } from "./narrate"

// The exact answer of https://api.normies.art/canvas/status on 2026-10-05 (the fixed 4% promo is active).
const LIVE_FIXED = { paused: false, maxBurnPercent: 4, tierThresholds: [490, 890], tierMinPercents: [4, 4, 4] }
const NORMAL = { paused: false, maxBurnPercent: 4, tierThresholds: [490, 890], tierMinPercents: [1, 2, 3] }

describe("parseContractStatus is strict", () => {
  it("accepts the real response and the expected normal one", () => {
    assert.deepEqual(parseContractStatus(LIVE_FIXED), LIVE_FIXED)
    assert.deepEqual(parseContractStatus(NORMAL), NORMAL)
  })
  it("rejects anything that is not exactly the documented shape", () => {
    for (const bad of [null, undefined, "x", 4, [], {}, { ...LIVE_FIXED, paused: "false" }, { ...LIVE_FIXED, maxBurnPercent: "4" }, { ...LIVE_FIXED, maxBurnPercent: 0 },
      { ...LIVE_FIXED, tierMinPercents: [4, 4] }, { ...LIVE_FIXED, tierMinPercents: [] }, { ...LIVE_FIXED, tierMinPercents: [4, "4", 4] },
      { ...LIVE_FIXED, tierMinPercents: [4, 4, 9] }, { ...LIVE_FIXED, tierThresholds: undefined }]) {
      assert.equal(parseContractStatus(bad), null, JSON.stringify(bad))
    }
  })
})

describe("contractRate", () => {
  it("every tier minimum equal to the 4% maximum is the fixed 4%", () => assert.equal(contractRate(LIVE_FIXED), "fixed"))
  it("lower minimums are the normal tiered roll", () => assert.equal(contractRate(NORMAL), "tiered"))
  it("a fixed rate other than 4% is something this page cannot state: unknown, the clock decides", () => {
    assert.equal(contractRate({ ...LIVE_FIXED, maxBurnPercent: 5, tierMinPercents: [5, 5, 5] }), "unknown")
  })
  it("no status at all is unknown", () => assert.equal(contractRate(null), "unknown"))
  it("matchesKnownTiers: only the Sep 23 article's table (490 / 890, 1-2-3 up to 4)", () => {
    assert.equal(matchesKnownTiers(NORMAL), true)
    assert.equal(matchesKnownTiers({ ...NORMAL, tierMinPercents: [2, 3, 4] }), false)
    assert.equal(matchesKnownTiers({ ...NORMAL, tierThresholds: [500, 900] }), false)
  })
})

describe("loadBurnContractStatus never throws", () => {
  const ok = (body: unknown, status = 200) => (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch
  it("returns the status for a good response", async () => assert.deepEqual(await loadBurnContractStatus(ok(LIVE_FIXED)), LIVE_FIXED))
  it("returns null for an HTTP error, a bad shape, invalid JSON and a network failure", async () => {
    assert.equal(await loadBurnContractStatus(ok({}, 502)), null)
    assert.equal(await loadBurnContractStatus(ok({ hello: 1 })), null)
    assert.equal(await loadBurnContractStatus((async () => new Response("<html>", { status: 200 })) as unknown as typeof fetch), null)
    assert.equal(await loadBurnContractStatus((async () => { throw new Error("down") }) as unknown as typeof fetch), null)
  })
})

describe("buildBurnBuy follows the contract (the key failure mode: the clock guessing wrong)", () => {
  const snapshot = (): MarketSnapshot => ({
    livingSupply: 7226, wallets: 1723, censusTotal: 25873, originalPixels: new Map([[1, 700]]), pixelSupply: new Map([[700, 100]]),
    oldestIndexedAt: "2026-10-05T06:00:00Z", walletScores: new Map(),
  })
  const run = (over: Partial<Deps>, now: string) =>
    buildBurnBuy({}, {
      resolveHolder: async () => ({ address: "0xabc", ens: null, tokenIds: [] }),
      fetchTokens: async () => [],
      fetchListings: async () => ({ items: [], floorEth: 0.28, total: 0 }),
      loadSnapshot: async () => snapshot(),
      now: () => new Date(now),
      // the clock path as production builds it: promo until 16:00 UTC, normal after
      yieldMode: (n) => ((n ?? new Date()).getTime() < Date.parse("2026-10-05T16:00:00Z") ? "promo" : "normal"),
      yieldPinned: () => false,
      ...over,
    })

  it("17:00 UTC: the clock alone says normal, but the contract still pays a fixed 4%: the page says 4%", async () => {
    const r = await run({ contractStatus: async () => LIVE_FIXED }, "2026-10-05T17:00:00Z")
    assert.equal(r.yieldMode, "promo")
    assert.equal(r.promo.source, "contract")
    assert.equal(r.promo.ratePercent, 4)
    assert.deepEqual(r.promo.contract, LIVE_FIXED)
    assert.match(promoNotice(r) ?? "", /paying a fixed 4% right now \(checked live\)/)
  })
  it("after the announced end, a contract that is STILL fixed says so (an extension)", async () => {
    const r = await run({ contractStatus: async () => LIVE_FIXED }, "2026-10-05T19:00:00Z")
    assert.equal(r.yieldMode, "promo")
    assert.match(promoNotice(r) ?? "", /still paying a fixed 4% \(checked live\), even though the announced end has passed/)
  })
  it("14:00 UTC: the clock says promo, but the contract already flipped to the normal tiers: the page follows the contract", async () => {
    const r = await run({ contractStatus: async () => NORMAL }, "2026-10-05T14:00:00Z")
    assert.equal(r.yieldMode, "normal")
    assert.equal(r.promo.source, "contract")
    assert.equal(r.promo.ratePercent, null)
    assert.match(r.promo.ends, /checked live/)
    assert.match(promoNotice(r) ?? "", /back to the normal tiered roll \(checked live\)/)
  })
  it("contract unreadable (null or throws): the clock decides, exactly as before", async () => {
    for (const contractStatus of [async () => null, async () => { throw new Error("down") }]) {
      const before = await run({ contractStatus }, "2026-10-05T14:00:00Z")
      assert.equal(before.yieldMode, "promo"); assert.equal(before.promo.source, "clock"); assert.equal(before.promo.contract, null)
      const after = await run({ contractStatus }, "2026-10-05T17:00:00Z")
      assert.equal(after.yieldMode, "normal"); assert.equal(after.promo.source, "clock")
    }
  })
  const WITH_MARKET = { ...NORMAL, pixelMarket: { marketAddress: "0x86156A8d6e4B9925F7fEca527ea5D71B0deeDB64", paused: false, feeBps: 1000, revenueShareBps: 5000 } }
  it("market: the contract's pixelMarket block opens it with no pin (source: contract), even with the old switch unset", async () => {
    const r = await run({ contractStatus: async () => WITH_MARKET, marketState: () => "pending", marketPin: () => null }, "2026-10-05T21:00:00Z")
    assert.equal(r.marketState, "live"); assert.equal(r.marketSource, "contract")
  })
  it("market: no block means closed (source: default); a pin beats the contract either way", async () => {
    const closed = await run({ contractStatus: async () => NORMAL, marketPin: () => null }, "2026-10-05T17:00:00Z")
    assert.equal(closed.marketState, "pending"); assert.equal(closed.marketSource, "default")
    const pinnedClosed = await run({ contractStatus: async () => WITH_MARKET, marketPin: () => "pending" }, "2026-10-05T21:00:00Z")
    assert.equal(pinnedClosed.marketState, "pending"); assert.equal(pinnedClosed.marketSource, "pinned")
    const pinnedOpen = await run({ contractStatus: async () => null, marketPin: () => "live" }, "2026-10-05T21:00:00Z")
    assert.equal(pinnedOpen.marketState, "live"); assert.equal(pinnedOpen.marketSource, "pinned")
  })
  it("market: contract unreadable and no pin falls back to the old switch, exactly as before", async () => {
    const r = await run({ contractStatus: async () => null, marketState: () => "live" }, "2026-10-05T21:00:00Z")
    assert.equal(r.marketState, "live"); assert.equal(r.marketSource, "default")
  })
  it("no contractStatus dependency at all behaves exactly as before the change", async () => {
    const r = await run({}, "2026-10-05T14:00:00Z")
    assert.equal(r.yieldMode, "promo"); assert.equal(r.promo.source, "clock")
  })
  it("the owner's pin beats the contract, and a disagreement is said out loud", async () => {
    const r = await run({ yieldPinned: () => true, yieldMode: () => "promo" as const, contractStatus: async () => NORMAL }, "2026-10-05T14:00:00Z")
    assert.equal(r.yieldMode, "promo")
    assert.equal(r.promo.source, "pinned")
    assert.ok(r.caveats.some((c) => /pinned the burn rate, but the Normies contract currently reports the normal tiered roll/.test(c)))
  })
  it("paused on the contract: said in the caveats and in the notice, whatever the rate", async () => {
    const r = await run({ contractStatus: async () => ({ ...LIVE_FIXED, paused: true }) }, "2026-10-05T14:00:00Z")
    assert.ok(r.caveats.some((c) => /Burning is paused on the Normies contract/.test(c)))
    assert.match(promoNotice(r) ?? "", /Burning is paused/)
  })
  it("normal tiers that differ from the table this page uses are flagged as approximate", async () => {
    const r = await run({ contractStatus: async () => ({ ...NORMAL, tierMinPercents: [2, 3, 4] }) }, "2026-10-05T14:00:00Z")
    assert.equal(r.yieldMode, "normal")
    assert.ok(r.caveats.some((c) => /differs from the ranges this page uses/.test(c)))
  })
  it("an unusual fixed rate falls back to the clock and says so", async () => {
    const r = await run({ contractStatus: async () => ({ ...LIVE_FIXED, maxBurnPercent: 5, tierMinPercents: [5, 5, 5] }) }, "2026-10-05T14:00:00Z")
    assert.equal(r.promo.source, "clock")
    assert.ok(r.caveats.some((c) => /unusual burn setting/.test(c)))
  })
})
