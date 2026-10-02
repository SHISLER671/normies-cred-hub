import { describe, it } from "node:test"
import assert from "node:assert/strict"

import type { Move, TokenAdvice } from "./advise"
import { buildPageModel, describeMove, safeUrl } from "./narrate"
import type { BurnBuyResult } from "./service"

const move = (over: Partial<Move> = {}): Move => ({
  kind: "buy-and-burn", tokenIds: [8188], costEth: 0.35, heldAfter: 1, pixelAfter: 37,
  scoreBefore: 3.4, scoreAfter: 9.66, scoreGain: 6.26, gainPerEth: 17.89, shareBeforePct: 0.0131, shareAfterPct: 0.0373, note: "", ...over,
})
const tok = (tokenId: number, verdict: TokenAdvice["verdict"], reasons: string[], total = 18, fromPixels = 18, transferred = 0): TokenAdvice =>
  ({ tokenId, verdict, reasons, yield: { fromPixels, transferred, total } })

function result(over: Partial<NonNullable<BurnBuyResult["wallet"]>> | null, extra: Partial<BurnBuyResult> = {}): BurnBuyResult {
  const advice = {
    held: 1, pixel: 12, score: 3.4, sharePct: 0.0131, tokens: [tok(7141, "keep", ["awakened agent: an on-chain identity, not fodder"], 30, 18, 12)],
    nextBracket: { atHeld: 2, needMore: 1 }, nextBoost: { atPixel: 15, needMore: 3 }, moves: [move()], notes: ["Scores use the published formula."],
    holdings: [{ tokenId: 7141, originalPixels: 454, actionPoints: 12, rank: 3874, type: "Human" }],
  }
  return {
    asOf: "2026-10-03T00:00:00Z",
    promo: { ratePercent: 4, basis: "", ends: "" },
    wallet: over === null ? null : { address: "0xabc", ens: null, delegateOf: [], advice, historicalIllustration: { payoutEthIfSharePaidLikeArticleWindow: 0, source: "" }, ...over },
    market: { floorEth: 0.286, listedCount: 3, bestPixelFodder: [{ tokenId: 1, priceEth: 0.29, actionPoints: 0, originalPixels: 700, yieldTotal: 28, fromPixels: 28, yieldPerEth: 96.55, url: "https://example.com/1" }, { tokenId: 2, priceEth: 0.3, actionPoints: 0, originalPixels: 650, yieldTotal: 26, fromPixels: 26, yieldPerEth: 86.6, url: "javascript:alert(1)" }], bestApCarriers: [], skippedListings: 0 },
    census: { wallets: 1723, totalScore: 25872.7, livingSupply: 7226, indexOldestIndexedAt: null },
    sources: { holder: { ok: true }, rarity: { ok: true }, listings: { ok: true }, index: { ok: true } },
    caveats: [],
    ...extra,
  }
}
const withAdvice = (patch: Record<string, unknown>) => {
  const r = result({})
  Object.assign(r.wallet!.advice, patch)
  return r
}

describe("buildPageModel", () => {
  it("no wallet: asks for one, still shows market fodder", () => {
    const m = buildPageModel(result(null))
    assert.equal(m.state, "no-wallet")
    assert.equal(m.fodder.length, 2)
  })

  it("null result is the empty prompt", () => {
    assert.equal(buildPageModel(null).state, "no-wallet")
  })

  it("empty wallet says so plainly and never offers a burn", () => {
    const m = buildPageModel(withAdvice({ held: 0, pixel: 0, tokens: [], holdings: [], moves: [] }))
    assert.equal(m.state, "empty")
    assert.match(m.headline, /holds no Normies/)
    assert.equal(m.rows.length, 0)
  })

  it("delegate-only wallet is told it cannot burn and which owner to use", () => {
    const r = withAdvice({ held: 0, pixel: 0, tokens: [], holdings: [], moves: [] })
    r.wallet!.delegateOf = [{ tokenId: 7141, owner: "0xfafd" }]
    const m = buildPageModel(r)
    assert.equal(m.state, "delegate-only")
    assert.match(m.headline, /cannot burn/)
    assert.match(m.lines.join(" "), /#7141/)
    assert.deepEqual(m.delegateOf, [{ tokenId: 7141, owner: "0xfafd" }])
  })

  it("a holder with one kept agent: KEEP row in words, best move is the top move", () => {
    const m = buildPageModel(result({}))
    assert.equal(m.state, "holds")
    assert.equal(m.rows[0].label, "KEEP")
    assert.match(m.rows[0].reasons[0], /awakened agent/)
    assert.match(m.rows[0].pays, /30 #PIXEL \(18 from pixels, 12 AP carried over\)/)
    assert.match(m.headline, /^Best move right now: Buy #8188 for 0\.35 ETH/)
    assert.match(m.lines.join(" "), /1 more Normie lifts your whole stack/)
    assert.equal(m.moves.length, 1)
  })

  it("counts burn candidates and calls them candidates, not orders", () => {
    const m = buildPageModel(withAdvice({ held: 3, tokens: [tok(1, "burn", ["pays"]), tok(2, "burn", ["pays"]), tok(3, "keep", ["top 5%"])], holdings: [] }))
    assert.match(m.lines[1], /2 burn candidates, 1 to keep/)
    assert.match(m.lines[1], /not an order/)
    assert.deepEqual(m.rows.map((r) => r.label), ["BURN CANDIDATE", "BURN CANDIDATE", "KEEP"])
  })

  it("a wallet that is ALL burn candidates is told it cannot burn them all", () => {
    const m = buildPageModel(withAdvice({ held: 3, tokens: [tok(1, "burn", ["pays"]), tok(2, "burn", ["pays"]), tok(3, "burn", ["pays"])], holdings: [] }))
    assert.match(m.lines.join(" "), /at most 2 of these 3 can go/)
  })

  it("a single burn candidate warns that burning it ends membership", () => {
    const m = buildPageModel(withAdvice({ held: 1, tokens: [tok(1, "burn", ["pays"])], holdings: [] }))
    assert.match(m.lines.join(" "), /only Normie: burning it would leave you nothing to burn into/)
  })

  it("does not add that warning when something is kept", () => {
    const m = buildPageModel(withAdvice({ held: 3, tokens: [tok(1, "burn", ["pays"]), tok(2, "burn", ["pays"]), tok(3, "keep", ["top 5%"])], holdings: [] }))
    assert.doesNotMatch(m.lines.join(" "), /at most/)
  })

  it("says plainly when no move helps", () => {
    const m = buildPageModel(withAdvice({ moves: [] }))
    assert.match(m.headline, /Nothing to do right now/)
  })
})

describe("describeMove", () => {
  it("copies the numbers from the move", () => {
    const d = describeMove(move())
    assert.match(d.detail, /3\.4 → 9\.66 \(\+6\.26\)/)
    assert.match(d.detail, /0\.0131% → 0\.0373%/)
  })
  it("burn-own states the cost as forgone sale value and that it is permanent", () => {
    const d = describeMove(move({ kind: "burn-own", tokenIds: [5, 6], costEth: 0.572 }))
    assert.match(d.title, /^Burn #5 and #6/)
    assert.match(d.detail, /Permanent\. You give up about 0\.572 ETH/)
  })
  it("buy-and-hold", () => {
    assert.match(describeMove(move({ kind: "buy-and-hold" })).title, /and keep it$/)
  })
})

describe("safeUrl", () => {
  it("only passes https", () => {
    assert.equal(safeUrl("https://www.normies.art/x"), "https://www.normies.art/x")
    assert.equal(safeUrl("http://x.com"), null)
    assert.equal(safeUrl("javascript:alert(1)"), null)
    assert.equal(safeUrl(undefined), null)
    assert.equal(safeUrl("not a url"), null)
  })
  it("a javascript: listing url never reaches the page model", () => {
    const m = buildPageModel(result(null))
    assert.equal(m.fodder[1].url, null)
    assert.equal(m.fodder[0].url, "https://example.com/1")
  })
})
