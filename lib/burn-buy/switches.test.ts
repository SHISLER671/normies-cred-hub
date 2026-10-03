import { describe, it } from "node:test"
import assert from "node:assert/strict"

import { adviseToken, rankFodder, type HeldToken, type Listing } from "./advise"
import { buildPageModel } from "./narrate"
import { parseMarket, parseYieldMode } from "./switches"
import { burnYield, launchedBurnYield, launchTier, promoBurnYield } from "./score"
import { buildBurnBuy, type Deps, type MarketSnapshot, type RarityToken, type RawListing } from "./service"

const NOW = new Date("2026-10-05T00:00:00.000Z")

describe("normal burn yield (tiers from the Sep 23 article)", () => {
  it("tier boundaries: 490 / 491 and 890 / 891", () => {
    assert.deepEqual([launchTier(0), launchTier(490)].map((t) => [t.minPct, t.maxPct]), [[1, 4], [1, 4]])
    assert.deepEqual([launchTier(491), launchTier(890)].map((t) => [t.minPct, t.maxPct]), [[2, 4], [2, 4]])
    assert.deepEqual([launchTier(891), launchTier(1600)].map((t) => [t.minPct, t.maxPct]), [[3, 4], [3, 4]])
  })

  it("range and middle per tier, with the burned token's AP added whole", () => {
    assert.deepEqual(launchedBurnYield(300, 0), { fromPixels: 8, transferred: 0, total: 8, range: { min: 3, max: 12 } })
    assert.deepEqual(launchedBurnYield(600, 10), { fromPixels: 18, transferred: 10, total: 28, range: { min: 12, max: 24 } })
    assert.deepEqual(launchedBurnYield(1000, 0), { fromPixels: 35, transferred: 0, total: 35, range: { min: 30, max: 40 } })
  })

  it("the middle always sits inside the range", () => {
    for (const px of [0, 1, 99, 300, 490, 491, 700, 890, 891, 1200, 1600]) {
      const y = launchedBurnYield(px, 0)
      assert.ok(y.fromPixels >= y.range!.min && y.fromPixels <= y.range!.max, `px ${px}`)
    }
  })

  it("promo yield is untouched and burnYield dispatches on the mode", () => {
    assert.deepEqual(promoBurnYield(454, 12), { fromPixels: 18, transferred: 12, total: 30 })
    assert.equal(burnYield("promo", 454, 12).range, undefined)
    assert.ok(burnYield("normal", 454, 12).range)
  })
})

describe("the two switches parse strictly and independently", () => {
  it("BURN_YIELD_MODE: only the exact word 'normal' turns normal rates on", () => {
    assert.equal(parseYieldMode("normal"), "normal")
    assert.equal(parseYieldMode(" Normal "), "normal")
    for (const v of [undefined, null, "", "promo", "launched", "true", "1", "norm", "normall"]) assert.equal(parseYieldMode(v), "promo", String(v))
  })

  it("PIXEL_MARKET: only the exact word 'live' says the market is open", () => {
    assert.equal(parseMarket("live"), "live")
    assert.equal(parseMarket(" LIVE "), "live")
    for (const v of [undefined, null, "", "pending", "launched", "true", "1", "liv", "lived"]) assert.equal(parseMarket(v), "pending", String(v))
  })
})

const held = (over: Partial<HeldToken> = {}): HeldToken => ({
  tokenId: 1, originalPixels: 600, actionPoints: 10, rank: 5000, type: "Human", awakenedAgent: false, pixelSupply: 400, forgoneValueEth: 0.29, ...over,
})

describe("advice by yield mode", () => {
  it("promo (default): reason says 4% and there is no range", () => {
    const a = adviseToken(held(), { livingSupply: 7226 })
    assert.match(a.reasons[0], /4% of 600 original px/)
    assert.equal(a.yield.range, undefined)
  })

  it("normal: reason says it is a roll, with the range; the middle is the planning figure", () => {
    const a = adviseToken(held(), { livingSupply: 7226, yieldMode: "normal" })
    assert.match(a.reasons[0], /about 18 #PIXEL \(12 to 24: it is a roll, based on 600 original px\)/)
    assert.deepEqual(a.yield.range, { min: 12, max: 24 })
    assert.equal(a.yield.total, 28)
  })

  it("fodder carries the full range in normal mode only", () => {
    const l: Listing = { tokenId: 9, priceEth: 0.3, actionPoints: 0, originalPixels: 600, rank: 5000, type: "Human", awakenedAgent: false, pixelSupply: 400 }
    assert.equal(rankFodder([l], { livingSupply: 7226 }, { withAp: false })[0].yieldMin, undefined)
    const f = rankFodder([l], { livingSupply: 7226, yieldMode: "normal" }, { withAp: false })[0]
    assert.deepEqual([f.yieldMin, f.yieldMax, f.yieldTotal], [12, 24, 18])
  })
})

const snap = (): MarketSnapshot => ({
  livingSupply: 7226, wallets: 1723, censusTotal: 25873, oldestIndexedAt: "2026-10-04T20:00:00Z", walletScores: new Map(),
  originalPixels: new Map([[1, 600], [2, 700], [3, 300]]), pixelSupply: new Map([[600, 400], [700, 400], [300, 400]]),
})
const tk = (id: number): RarityToken => ({ id, rank: 4000, type: "Human", actionPoints: 0, awakenedAgent: false, fairValueEth: 0.29 })
const lst = (id: number, priceEth: number): RawListing => ({ ...tk(id), priceEth })
const deps = (over: Partial<Deps> = {}): Deps => ({
  resolveHolder: async () => ({ address: "0xabc", ens: null, tokenIds: [1, 3] }),
  fetchTokens: async (ids) => ids.map(tk),
  fetchListings: async () => ({ items: [lst(2, 0.3)], floorEth: 0.286, total: 1 }),
  loadSnapshot: async () => snap(),
  now: () => NOW,
  ...over,
})

describe("the API result under each combination", () => {
  it("nothing set: promo yield, market pending, exactly as today", async () => {
    const r = await buildBurnBuy({ wallet: "0xabc" }, deps())
    assert.equal(r.yieldMode, "promo")
    assert.equal(r.marketState, "pending")
    assert.equal(r.promo.ratePercent, 4)
    assert.match(r.promo.ends, /Monday, October 5/)
    assert.ok(r.caveats.every((c) => !/roll/.test(c)))
    assert.equal(r.wallet!.advice.tokens[0].yield.range, undefined)
  })

  it("MONDAY SCENARIO: normal yield while the marketplace is still pending (audits)", async () => {
    const r = await buildBurnBuy({ wallet: "0xabc" }, deps({ yieldMode: () => "normal" }))
    assert.equal(r.yieldMode, "normal")
    assert.equal(r.marketState, "pending")
    assert.equal(r.promo.ratePercent, null)
    assert.match(r.promo.basis, /roll/)
    assert.ok(r.caveats.some((c) => /roll inside a range/.test(c)))
    assert.ok(r.caveats.some((c) => /#PIXEL has no market price yet/.test(c)), "still says there is no price: the market is not open")
    assert.ok(r.wallet!.advice.tokens.every((t) => t.yield.range))
  })

  it("market live alone does not change the burn yield", async () => {
    const r = await buildBurnBuy({ wallet: "0xabc" }, deps({ marketState: () => "live" }))
    assert.equal(r.marketState, "live")
    assert.equal(r.yieldMode, "promo")
    assert.equal(r.promo.ratePercent, 4)
    assert.ok(r.caveats.some((c) => /does not read live #PIXEL prices/.test(c)))
  })

  it("both on", async () => {
    const r = await buildBurnBuy({ wallet: "0xabc" }, deps({ yieldMode: () => "normal", marketState: () => "live" }))
    assert.deepEqual([r.yieldMode, r.marketState], ["normal", "live"])
    assert.ok(r.market!.bestPixelFodder.every((f) => f.yieldMin !== undefined))
  })
})

describe("the page wording under each combination", () => {
  it("promo: no ~ and no 'roll' on the tiles", async () => {
    const m = buildPageModel(await buildBurnBuy({ wallet: "0xabc" }, deps()), "share")
    assert.deepEqual([m.yieldMode, m.marketState], ["promo", "pending"])
    assert.ok(m.rows.every((x) => !x.yieldText.includes("~") && !/roll/.test(x.pays)))
  })

  it("normal yield: figures are ~ with a range and moves say a burn is a roll", async () => {
    const m = buildPageModel(await buildBurnBuy({ wallet: "0xabc" }, deps({ yieldMode: () => "normal" })), "share")
    assert.ok(m.rows.every((x) => x.yieldText.startsWith("+~")))
    assert.ok(m.rows.every((x) => /about \d+ #PIXEL \(\d+ to \d+; it is a roll/.test(x.pays)))
    assert.ok(m.fodder.every((f) => f.range !== null))
    assert.ok(m.moves.some((x) => /roll/.test(x.detail)))
  })

  it("normal yield, art and arena goals also say about / ~", async () => {
    const r = await buildBurnBuy({ wallet: "0xabc" }, deps({ yieldMode: () => "normal" }))
    assert.ok(buildPageModel(r, "art").moves.every((x) => x.stat.startsWith("~+")))
    assert.ok(buildPageModel(r, "arena").rows.filter((x) => x.verdict === "burn").every((x) => /about \d+ AP/.test(x.reasons[0])))
  })

  it("the Arena note carries the Level conflict between the Sep 23 article and the Oct 3 video", () => {
    assert.match(buildPageModel(null, "arena").goalNotes.join(" "), /Sep 23 article said withdrawing #PIXEL strips a level/)
  })
})
