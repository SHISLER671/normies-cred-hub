import { describe, it } from "node:test"
import assert from "node:assert/strict"

import { adviseToken, rankFodder, type HeldToken, type Listing } from "./advise"
import { buildPageModel } from "./narrate"
import { parseMarket, parseMarketPin, resolveMarketState, resolveYieldMode } from "./switches"
import { contractRate, parseContractStatus, parsePixelMarket } from "./contract-state"
import { burnYield, launchedBurnYield, launchTier, promoBurnYield } from "./score"
import { buildBurnBuy, type Deps, type MarketSnapshot, type RarityToken, type RawListing } from "./service"

const NOW = new Date("2026-10-05T00:00:00.000Z")

describe("normal burn yield (tiers from the Sep 23 article)", () => {
  it("tier boundaries match the contract (pixelCount < threshold): 489 / 490 and 889 / 890", () => {
    assert.deepEqual([launchTier(0), launchTier(489)].map((t) => [t.minPct, t.maxPct]), [[1, 4], [1, 4]])
    assert.deepEqual([launchTier(490), launchTier(889)].map((t) => [t.minPct, t.maxPct]), [[2, 4], [2, 4]])
    assert.deepEqual([launchTier(890), launchTier(1600)].map((t) => [t.minPct, t.maxPct]), [[3, 4], [3, 4]])
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
  it("BURN_YIELD_MODE: the exact words 'normal' and 'promo' PIN the mode, whatever the clock says", () => {
    const before = new Date("2026-10-05T10:00:00Z"), after = new Date("2026-10-06T10:00:00Z")
    for (const now of [before, after]) {
      assert.deepEqual(resolveYieldMode("normal", now), { mode: "normal", pinned: true })
      assert.deepEqual(resolveYieldMode(" Normal ", now), { mode: "normal", pinned: true })
      assert.deepEqual(resolveYieldMode("promo", now), { mode: "promo", pinned: true })
    }
  })

  it("BURN_YIELD_MODE unset, empty or a typo: the CLOCK decides (promo before 16:00 UTC Oct 5, normal from then)", () => {
    for (const v of [undefined, null, "", "launched", "true", "1", "norm", "normall"]) {
      assert.deepEqual(resolveYieldMode(v, new Date("2026-10-05T15:59:59Z")), { mode: "promo", pinned: false }, String(v))
      assert.deepEqual(resolveYieldMode(v, new Date("2026-10-05T16:00:00Z")), { mode: "normal", pinned: false }, String(v))
    }
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
    assert.ok(r.caveats.some((c) => /order book could not be read/.test(c)))
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

describe("market state: the pin, else the contract (2026-10-05: the market is open when /canvas/status carries a pixelMarket block)", () => {
  const block = { marketAddress: "0x86156A8d6e4B9925F7fEca527ea5D71B0deeDB64", market: { paused: false, feeBps: 1000, revenueShareBps: 5000 } }
  it("parseMarketPin: only the exact words pin", () => {
    assert.equal(parseMarketPin("live"), "live")
    assert.equal(parseMarketPin(" Pending "), "pending")
    for (const v of [undefined, "", "Live!", "true", "open"]) assert.equal(parseMarketPin(v as string | undefined), null)
  })
  it("a pin always wins, even against the contract", () => {
    assert.deepEqual(resolveMarketState("pending", { pixelMarket: block }), { state: "pending", source: "pinned" })
    assert.deepEqual(resolveMarketState("live", null), { state: "live", source: "pinned" })
  })
  it("no pin: the contract's pixelMarket block means open", () => {
    assert.deepEqual(resolveMarketState(null, { pixelMarket: block }), { state: "live", source: "contract" })
  })
  it("no pin and no block (or no contract): the fallback, which defaults to closed", () => {
    assert.deepEqual(resolveMarketState(null, {}), { state: "pending", source: "default" })
    assert.deepEqual(resolveMarketState(null, null), { state: "pending", source: "default" })
    assert.deepEqual(resolveMarketState(null, null, "live"), { state: "live", source: "default" })
  })
  it("parsePixelMarket is strict: a missing or malformed block is never read as open", () => {
    const good = { ...block, canvasAddress: "0x0", market: block.market }
    assert.deepEqual(parsePixelMarket(good), { marketAddress: block.marketAddress, paused: false, feeBps: 1000, revenueShareBps: 5000 })
    for (const bad of [null, {}, { ...block, marketAddress: "nope" }, { ...block, market: null }, { ...block, market: { paused: "no", feeBps: 1000, revenueShareBps: 5000 } }, { ...block, market: { paused: false, feeBps: -1, revenueShareBps: 5000 } }, { ...block, market: { paused: false, feeBps: 1000, revenueShareBps: 99999 } }]) {
      assert.equal(parsePixelMarket(bad), null, JSON.stringify(bad))
    }
  })
  it("the real /canvas/status from 2026-10-05 20:40 UTC parses, market block included", () => {
    const real = { paused: false, maxBurnPercent: 4, tierThresholds: [490, 890], tierMinPercents: [1, 2, 3], pixelMarket: { canvasAddress: "0xF14f2852e1fD6A4108156054AF49B3915dc40E2e", marketAddress: "0x86156A8d6e4B9925F7fEca527ea5D71B0deeDB64", enlargePrices: { "50": 900 }, blankCanvasPrice: 200, treasury: "0xAF8e9BDcF6463EA1f50f8f70ECF13d85a092a1Aa", market: { paused: false, feeBps: 1000, revenueShareBps: 5000 } } }
    const s = parseContractStatus(real)!
    assert.equal(s.pixelMarket?.feeBps, 1000)
    assert.equal(contractRate(s), "tiered")
  })
  it("an old-shape status (no market block) still parses exactly as before", () => {
    const old = { paused: false, maxBurnPercent: 4, tierThresholds: [490, 890], tierMinPercents: [4, 4, 4] }
    assert.deepEqual(parseContractStatus(old), old)
  })
})
