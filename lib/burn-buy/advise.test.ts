import { describe, it } from "node:test"
import assert from "node:assert/strict"

import { adviseToken, adviseWallet, historicalPayoutEth, keepReasons, rankFodder, type HeldToken, type Listing } from "./advise"

const ctx = { livingSupply: 7226, censusTotal: 25873 }
const close = (a: number, b: number, eps = 0.02) => assert.ok(Math.abs(a - b) <= eps, `${a} vs ${b}`)

const tok = (over: Partial<HeldToken> & { tokenId: number }): HeldToken => ({
  originalPixels: 600, actionPoints: 0, rank: 4000, type: "Human", awakenedAgent: false,
  pixelSupply: 100, forgoneValueEth: 0.29, ...over,
})
const listing = (over: Partial<Listing> & { tokenId: number }): Listing => ({
  priceEth: 0.3, actionPoints: 0, originalPixels: 900, rank: 4000, type: "Human",
  awakenedAgent: false, pixelSupply: 100, ...over,
})
// A token that is never burnable (awakened agent), used to hold AP / be the receiver.
const anchor = (tokenId: number, ap = 0) => tok({ tokenId, awakenedAgent: true, actionPoints: ap })

describe("keepReasons (doctrine)", () => {
  it("plain Human, mid pixels, common: no reason to keep", () => {
    assert.deepEqual(keepReasons(tok({ tokenId: 1 }), ctx), [])
  })
  it("awakened agent is kept as identity", () => {
    assert.match(keepReasons(tok({ tokenId: 1, awakenedAgent: true }), ctx)[0], /awakened agent/)
  })
  it("non-Human type is kept", () => {
    assert.match(keepReasons(tok({ tokenId: 1, type: "Alien" }), ctx)[0], /rarer type/)
  })
  it("the doctrine's own example: ~280 px with ~11 in supply is a possible collectible", () => {
    assert.match(keepReasons(tok({ tokenId: 1, originalPixels: 280, pixelSupply: 11 }), ctx)[0], /possible collectible/)
  })
  it("a DENSE token with a unique pixel count is NOT scarce: it is the efficient fodder (regression)", () => {
    // 26 of 341 live listings were wrongly excluded by a 'very scarce pixel supply' rule; all were 800-919 px plain Humans.
    assert.deepEqual(keepReasons(tok({ tokenId: 1, originalPixels: 919, pixelSupply: 1, rank: 579 }), ctx), [])
    assert.deepEqual(keepReasons(tok({ tokenId: 1, originalPixels: 500, pixelSupply: 2, rank: 3000 }), ctx), [])
  })
  it("280 px but common (supply 400) is NOT flagged", () => {
    assert.deepEqual(keepReasons(tok({ tokenId: 1, originalPixels: 280, pixelSupply: 400 }), ctx), [])
  })
  it("top 5% by rank is kept (rank 361 of 7,226 yes, 362 no)", () => {
    assert.equal(keepReasons(tok({ tokenId: 1, rank: 361 }), ctx).length, 1)
    assert.equal(keepReasons(tok({ tokenId: 1, rank: 362 }), ctx).length, 0)
  })
})

describe("adviseToken", () => {
  it("a dense plain token is a burn candidate paying floor(4%)", () => {
    const a = adviseToken(tok({ tokenId: 1, originalPixels: 900 }), ctx)
    assert.equal(a.verdict, "burn")
    assert.equal(a.yield.fromPixels, 36)
  })
  it("its own AP is added to the yield (commit-990 numbers: 719 px + 22 AP = 50)", () => {
    const a = adviseToken(tok({ tokenId: 1, originalPixels: 719, actionPoints: 22 }), ctx)
    assert.equal(a.yield.total, 50)
  })
  it("a keep-worthy token is never marked burn, however dense", () => {
    assert.equal(adviseToken(tok({ tokenId: 1, originalPixels: 1000, awakenedAgent: true }), ctx).verdict, "keep")
  })
})

describe("adviseWallet: solo holder", () => {
  const solo = adviseWallet([anchor(7141)], [listing({ tokenId: 9, priceEth: 0.286, originalPixels: 500 })], ctx)
  it("standing: one Normie, no #PIXEL = score 1.0, about 0.004% of the pool", () => {
    assert.equal(solo.score, 1)
    close(solo.sharePct, 0.0039, 0.0003)
  })
  it("says plainly there is nothing to burn", () => {
    assert.ok(solo.notes.some((n) => /nothing to burn/.test(n)))
    assert.ok(solo.moves.every((m) => m.kind !== "burn-own"))
  })
  it("buying and keeping a second Normie lifts the stack to x1.15 (score 2.3)", () => {
    const m = solo.moves.find((x) => x.kind === "buy-and-hold")
    assert.ok(m)
    assert.equal(m!.scoreAfter, 2.3)
  })
})

describe("adviseWallet: crossing a boost cliff", () => {
  // 5 Normies, 90 #PIXEL held on one anchor: score (5*1.30 + 18) * 1.15 = 28.175
  const tokens = [tok({ tokenId: 1, originalPixels: 900 }), anchor(2, 90), anchor(3), anchor(4), anchor(5)]
  const w = adviseWallet(tokens, [], ctx)
  it("current score", () => close(w.score, 28.18, 0.01))
  it("next cliffs are reported", () => {
    assert.deepEqual(w.nextBracket, { atHeld: 10, needMore: 5 })
    assert.deepEqual(w.nextBoost, { atPixel: 100, needMore: 10 })
  })
  it("burning the 900 px token: held 4, #PIXEL 126 => (4*1.15 + 25.2) * 1.35 = 40.23", () => {
    const m = w.moves.find((x) => x.kind === "burn-own" && x.tokenIds.join() === "1")
    assert.ok(m)
    assert.equal(m!.heldAfter, 4)
    assert.equal(m!.pixelAfter, 126)
    close(m!.scoreAfter, 40.23)
  })
})

describe("adviseWallet: AP already in the wallet is not double counted", () => {
  it("burning an AP-laden token into your own: only the pixel yield is new", () => {
    const w = adviseWallet([tok({ tokenId: 1, originalPixels: 700, actionPoints: 40 }), anchor(2)], [], ctx)
    const m = w.moves.find((x) => x.kind === "burn-own")
    assert.ok(m)
    assert.equal(m!.pixelAfter, 40 + 28) // NOT 40 + 28 + 40
  })
})

describe("adviseWallet: buying fodder", () => {
  const w = adviseWallet(
    [anchor(7141)],
    [
      listing({ tokenId: 10, priceEth: 0.3, originalPixels: 900 }),
      listing({ tokenId: 11, priceEth: 0.1, originalPixels: 280, pixelSupply: 3 }), // collectible: must not be fodder
    ],
    ctx,
  )
  it("never suggests burning a collectible", () => {
    assert.ok(w.moves.filter((m) => m.kind === "buy-and-burn").every((m) => !m.tokenIds.includes(11)))
  })
  it("buy-and-burn of the 900 px listing: held stays 1, #PIXEL 36 => (1 + 7.2) * 1.15 = 9.43", () => {
    const m = w.moves.find((x) => x.kind === "buy-and-burn" && x.tokenIds.join() === "10")
    assert.ok(m)
    assert.equal(m!.heldAfter, 1)
    close(m!.scoreAfter, 9.43)
    close(m!.costEth, 0.3, 0.0001)
  })
  it("moves are ranked best score-per-ETH first", () => {
    const g = w.moves.map((m) => m.gainPerEth ?? Infinity)
    assert.deepEqual(g, [...g].sort((a, b) => b - a))
  })
})

describe("historical illustration", () => {
  it("0.717% of the article's 81.09 ETH pool is about 0.58 ETH (article: 0.582)", () => {
    close(historicalPayoutEth(0.717), 0.5814, 0.005)
  })
})

describe("rankFodder", () => {
  const ls = [
    listing({ tokenId: 1, priceEth: 0.30, originalPixels: 900 }),                       // 36 / 0.30 = 120
    listing({ tokenId: 2, priceEth: 0.29, originalPixels: 500 }),                       // 20 / 0.29 = 69
    listing({ tokenId: 3, priceEth: 0.10, originalPixels: 280, pixelSupply: 3 }),       // collectible: excluded
    listing({ tokenId: 4, priceEth: 0.25, originalPixels: 800, awakenedAgent: true }),  // identity: excluded
    listing({ tokenId: 5, priceEth: 0.35, originalPixels: 600, actionPoints: 100 }),    // 24 + 100 = 124 / 0.35 = 354
  ]
  it("pure pixel fodder is ranked by #PIXEL per ETH and never includes keep-worthy tokens", () => {
    const r = rankFodder(ls, ctx, { withAp: false })
    assert.deepEqual(r.map((x) => x.tokenId), [1, 2])
    assert.equal(r[0].yieldTotal, 36)
    assert.equal(r[0].yieldPerEth, 120)
  })
  it("AP-carrying listings are a separate list; their AP is added to the yield", () => {
    const r = rankFodder(ls, ctx, { withAp: true })
    assert.deepEqual(r.map((x) => x.tokenId), [5])
    assert.equal(r[0].yieldTotal, 124)
  })
  it("respects the limit", () => {
    assert.equal(rankFodder(ls, ctx, { withAp: false, limit: 1 }).length, 1)
  })
})
