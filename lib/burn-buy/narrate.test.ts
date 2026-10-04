import { describe, it } from "node:test"
import assert from "node:assert/strict"

import type { Move, TokenAdvice } from "./advise"
import { buildPageModel, describeMove, levelOf, parseGoal, safeUrl, scoreBreakdown } from "./narrate"
import { walletScore } from "./score"
import type { BurnBuyResult } from "./service"

const move = (over: Partial<Move> = {}): Move => ({
  kind: "buy-and-burn", tokenIds: [8188], costEth: 0.35, heldAfter: 1, pixelAfter: 37,
  scoreBefore: 3.4, scoreAfter: 9.66, scoreGain: 6.26, gainPerEth: 17.89, shareBeforePct: 0.0131, shareAfterPct: 0.0373, note: "", ...over,
})
const tok = (tokenId: number, verdict: TokenAdvice["verdict"], reasons: string[], total = 18, fromPixels = 18, transferred = 0): TokenAdvice =>
  ({ tokenId, verdict, reasons, yield: { fromPixels, transferred, total } })

function result(over: Partial<NonNullable<BurnBuyResult["wallet"]>> | null, extra: Partial<BurnBuyResult> = {}): BurnBuyResult {
  const advice = {
    held: 1, pixel: 12, score: 3.4, sharePct: 0.0131, othersScore: 25873, tokens: [tok(7141, "keep", ["awakened agent: an on-chain identity, not fodder"], 30, 18, 12)],
    nextBracket: { atHeld: 2, needMore: 1 }, nextBoost: { atPixel: 15, needMore: 3 }, moves: [move()], notes: ["Scores use the published formula."],
    holdings: [{ tokenId: 7141, originalPixels: 454, actionPoints: 12, rank: 3874, type: "Human" }],
  }
  return {
    asOf: "2026-10-03T00:00:00Z",
    yieldMode: "promo",
    marketState: "pending",
    promo: { ratePercent: 4, basis: "", ends: "", window: { state: "open", earliestEnd: "2026-10-05T16:00:00Z", latestEnd: "2026-10-05T18:00:00Z", pinned: false } },
    wallet: over === null ? null : { address: "0xabc", ens: null, delegateOf: [], advice, historicalIllustration: { payoutEthIfSharePaidLikeArticleWindow: 0, source: "" }, ...over },
    market: { floorEth: 0.286, listedCount: 3, bestPixelFodder: [{ tokenId: 1, priceEth: 0.29, actionPoints: 0, originalPixels: 700, yieldTotal: 28, fromPixels: 28, yieldPerEth: 96.55, url: "https://example.com/1" }, { tokenId: 2, priceEth: 0.3, actionPoints: 0, originalPixels: 650, yieldTotal: 26, fromPixels: 26, yieldPerEth: 86.6, url: "javascript:alert(1)" }], bestApCarriers: [], skippedListings: 0 },
    census: { wallets: 1723, totalScore: 25872.7, livingSupply: 7226, indexOldestIndexedAt: null },
    sources: { holder: { ok: true }, rarity: { ok: true }, listings: { ok: true }, index: { ok: true }, jev: { ok: true, note: "off" } },
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

  it("your ONLY Normie is shown as KEEP even when the rules would call it a burn candidate", () => {
    const m = buildPageModel(withAdvice({ held: 1, tokens: [tok(1, "burn", ["pays"])], holdings: [{ tokenId: 1, originalPixels: 700, actionPoints: 0, rank: 9000, type: "Human" }] }))
    assert.equal(m.rows[0].label, "KEEP")
    assert.match(m.rows[0].reasons[0], /your only Normie/)
    assert.match(m.lines.join(" "), /Nothing here is a burn candidate/)
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

const hold = (tokenId: number, type: string, actionPoints = 0, originalPixels = 600) => ({ tokenId, originalPixels, actionPoints, rank: 5000, type })

describe("goals", () => {
  it("parseGoal only accepts the three goals", () => {
    assert.equal(parseGoal("arena"), "arena")
    assert.equal(parseGoal("art"), "art")
    assert.equal(parseGoal("share"), "share")
    assert.equal(parseGoal("burn-everything"), "share")
    assert.equal(parseGoal(undefined), "share")
  })

  it("levelOf is the official formula", () => {
    assert.equal(levelOf(0), 1)
    assert.equal(levelOf(9), 1)
    assert.equal(levelOf(10), 2)
    assert.equal(levelOf(12), 2)
    assert.equal(levelOf(40), 5)
  })

  it("ARENA with a lone Cat: keep it, say it is your only Cat, never suggest burning it", () => {
    const m = buildPageModel(withAdvice({ held: 1, tokens: [tok(7, "keep", ["rarer type (Cat); Humans are about 97% of living Normies"])], holdings: [hold(7, "Cat", 12)] }), "arena")
    assert.match(m.headline, /^Keep it\. It is your only Normie, so it is your only player/)
    assert.match(m.rows[0].reasons.join(" "), /only Cat/)
    assert.equal(m.rows[0].level, 2)
    assert.doesNotMatch(m.headline + m.lines.join(" "), /Best move/)
  })

  it("ARENA shows exact Level math when there is exactly one keeper", () => {
    const m = buildPageModel(withAdvice({ held: 1, tokens: [tok(7, "keep", ["x"])], holdings: [hold(7, "Cat", 12)] }), "arena")
    assert.match(m.moves[0].detail, /Adds 28 AP to it\. Level 2 → 5\./)
    assert.doesNotMatch(m.moves[0].title, /\.$/)
  })

  it("ARENA with a Cat and two spare Humans: keep the Cat, spare ones are for AP", () => {
    const m = buildPageModel(
      withAdvice({ held: 3, tokens: [tok(7, "keep", ["rarer type (Cat)"]), tok(8, "burn", ["pays"], 20, 20), tok(9, "burn", ["pays"], 10, 10)], holdings: [hold(7, "Cat", 5), hold(8, "Human"), hold(9, "Human")] }),
      "arena",
    )
    assert.match(m.headline, /^Arena plan: keep 1 fighter\. 2 spare could go for \+30 AP, if you want the Level\./)
    assert.match(m.rows[0].reasons[0], /only Cat/)
    assert.match(m.rows[1].reasons[0], /adds 20 AP to a Normie you keep \(10 AP = 1 Level\)/)
  })

  it("ARENA notes say the rules are unpublished and nothing can be entered from here", () => {
    const m = buildPageModel(result({}), "arena")
    const notes = m.goalNotes.join(" ")
    assert.match(notes, /NOT been published/)
    assert.match(notes, /cannot enter you into anything/)
    assert.match(notes, /Death is not a burn/)
  })

  it("ART: spare Normies add paint budget, painting never spends it, and the lost-art warning is there", () => {
    const m = buildPageModel(
      withAdvice({ held: 3, tokens: [tok(7, "keep", ["top 5%"]), tok(8, "burn", ["pays"], 20, 20), tok(9, "burn", ["pays"], 10, 10)], holdings: [hold(7, "Human"), hold(8, "Human"), hold(9, "Human")] }),
      "art",
    )
    assert.match(m.headline, /^Art plan: burning your 2 spare adds 30 pixels to the ones you keep/)
    assert.match(m.rows[1].reasons[0], /adds 20 pixels to a Normie you keep\. If you have drawn on this one, that art is lost/)
    const notes = m.goalNotes.join(" ")
    assert.match(notes, /paint budget/)
    assert.match(notes, /Painting never spends them/)
    assert.match(notes, /erases that art for good/)
    assert.match(m.moves[0].detail, /Adds \d+ pixels to it, so you can repaint more of its face/)
    assert.doesNotMatch(m.headline + notes, /pixels to draw with|edit budget/)
  })

  it("ARENA with ALL burn candidates never says 'keep 0' and only counts what can actually be burned", () => {
    const m = buildPageModel(
      withAdvice({ held: 3, tokens: [tok(1, "burn", ["pays"], 20, 20), tok(2, "burn", ["pays"], 15, 15), tok(3, "burn", ["pays"], 10, 10)], holdings: [hold(1, "Human"), hold(2, "Human"), hold(3, "Human")] }),
      "arena",
    )
    assert.match(m.headline, /^Arena plan: keep at least 1 as your fighter\. Up to 2 of the others could go for up to \+35 AP/)
    assert.doesNotMatch(m.headline, /keep 0/)
  })

  it("ART with ALL burn candidates counts only the best held-1 yields", () => {
    const m = buildPageModel(
      withAdvice({ held: 3, tokens: [tok(1, "burn", ["pays"], 20, 20), tok(2, "burn", ["pays"], 15, 15), tok(3, "burn", ["pays"], 10, 10)], holdings: [hold(1, "Human"), hold(2, "Human"), hold(3, "Human")] }),
      "art",
    )
    assert.match(m.headline, /^Art plan: keep at least 1 to paint\. Burning up to 2 of the others adds up to 35 pixels\./)
  })

  it("SHARE explains where the pool comes from and keeps the old best-move headline", () => {
    const m = buildPageModel(result({}), "share")
    assert.match(m.headline, /^Best move right now/)
    const notes = m.goalNotes.join(" ")
    assert.match(notes, /half of every Pixel Market fee/)
    assert.match(notes, /half of the royalties on Normie resales/)
    assert.match(notes, /paid out monthly, in rounds, and claimed on chain/)
  })

  it("SHARE notes carry exactly the OFFICIAL figures (pinned from the official Pixel Market video, 2026-10-03)", () => {
    const notes = buildPageModel(result({}), "share").goalNotes.join(" ")
    for (const x of ["1 = 1×", "2 or more = 1.15×", "5 or more = 1.3×", "10 or more = 1.45×", "25 or more = 1.6×", "50 or more = 1.75×"]) assert.ok(notes.includes(x), x)
    for (const x of ["15 or more = +15%", "100 or more = +35%", "500 or more = +60%", "1,500 or more = +100%"]) assert.ok(notes.includes(x), x)
    assert.ok(notes.includes("(Normies × bracket + #PIXEL ÷ 5) × (1 + boost)"))
  })

  it("ARENA notes carry the official status and permanent Level", () => {
    const notes = buildPageModel(result({}), "arena").goalNotes.join(" ")
    assert.match(notes, /COMING SOON/)
    assert.match(notes, /every 10 pixels is one level/)
    assert.match(notes, /permanent trait/)
  })

  it("empty and delegate-only wallets answer the same in every goal", () => {
    for (const g of ["share", "arena", "art"] as const) {
      const m = buildPageModel(withAdvice({ held: 0, pixel: 0, tokens: [], holdings: [], moves: [] }), g)
      assert.equal(m.state, "empty")
      assert.equal(m.goal, g)
    }
  })
})

describe("card data for the compact layout", () => {
  it("moves carry a short before/after stat", () => {
    assert.equal(describeMove(move()).stat, "Score 3.4 → 9.66")
  })

  it("arena and art fodder cards carry their own short stat", () => {
    const lone = buildPageModel(withAdvice({ held: 1, tokens: [tok(7, "keep", ["x"])], holdings: [hold(7, "Cat", 12)] }), "arena")
    assert.equal(lone.moves[0].stat, "Level 2 → 5")
    const art = buildPageModel(withAdvice({ held: 1, tokens: [tok(7, "keep", ["x"])], holdings: [hold(7, "Human", 0)] }), "art")
    assert.equal(art.moves[0].stat, "+28 px")
  })

  it("tiles get a short yield in the unit that goal uses", () => {
    const tokens = [tok(1, "burn", ["pays"], 20, 20), tok(2, "keep", ["x"], 5, 5)]
    const holdings = [hold(1, "Human"), hold(2, "Human")]
    assert.equal(buildPageModel(withAdvice({ held: 2, tokens, holdings }), "share").rows[0].yieldText, "+20 #PIXEL")
    assert.equal(buildPageModel(withAdvice({ held: 2, tokens, holdings }), "arena").rows[0].yieldText, "+20 AP")
    assert.equal(buildPageModel(withAdvice({ held: 2, tokens, holdings }), "art").rows[0].yieldText, "+20 px")
  })

  it("the cannot-burn-them-all warning is a visible notice; ordinary wallets have none", () => {
    const all = buildPageModel(withAdvice({ held: 3, tokens: [tok(1, "burn", ["p"]), tok(2, "burn", ["p"]), tok(3, "burn", ["p"])], holdings: [] }))
    const cap = all.notices.filter((n) => /at most 2 of these 3 can go/.test(n))
    assert.equal(cap.length, 1)
    assert.ok(all.lines.includes(cap[0]))
    // the only other notice an ordinary wallet gets is the one about the 4% window (the fixture's window is open)
    assert.deepEqual(buildPageModel(result({})).notices.filter((n) => !/4% rate/.test(n)), [])
    assert.equal(buildPageModel(null).notices.length, 0)
  })

  it("ARENA notes include the official trailer lines", () => {
    const notes = buildPageModel(result({}), "arena").goalNotes.join(" ")
    assert.match(notes, /They play\. You watch\./)
    assert.match(notes, /You do not steer it/)
    assert.match(notes, /The Maw/)
    assert.match(notes, /gives no numbers/)
  })
})

describe("scoreBreakdown: how your score adds up", () => {
  const base = { held: 3, pixel: 100, sharePct: 0.11, othersScore: 27990, nextBracket: { atHeld: 5, needMore: 2 }, nextBoost: { atPixel: 500, needMore: 400 } }
  const score = walletScore(3, 100)
  const out = scoreBreakdown({ ...base, score })

  it("reproduces the simulator's worked example (3 Normies, 100 #PIXEL)", () => {
    const v = Object.fromEntries(out.ledger.map((r) => [r.label.split(" (")[0], r.value]))
    assert.equal(v["Normies"], "3.45")
    assert.equal(v["#PIXEL"], "20")
    assert.equal(v["Boost from #PIXEL"], "+35%")
    assert.equal(v["Your score"], "31.66")
    assert.equal(v["Everyone else"], "27,990")
  })
  it("the next steps use the exact formula and say they are a minimum", () => {
    assert.equal(out.nextSteps.length, 2)
    assert.match(out.nextSteps[0].title, /^2 more Normies \(5 in all\) for a 1\.3x multiplier$/)
    assert.match(out.nextSteps[0].detail, new RegExp(`to ${String(Number(walletScore(5, 100).toFixed(2)))} `))
    assert.match(out.nextSteps[1].title, /^400 more #PIXEL \(500 in all\) for a \+60% boost$/)
    assert.ok(out.nextSteps.every((s) => /At least/.test(s.detail)))
  })
  it("is empty for a wallet with no Normies and has no step when already at the top", () => {
    assert.deepEqual(scoreBreakdown({ ...base, held: 0, pixel: 0, score: 0 }), { ledger: [], nextSteps: [] })
    assert.equal(scoreBreakdown({ ...base, score, nextBracket: null, nextBoost: null }).nextSteps.length, 0)
  })
})

describe("delegate-only wording", () => {
  const empty = () => withAdvice({ held: 0, pixel: 0, tokens: [], holdings: [], moves: [] })
  it("a Delegate.xyz delegate is not described as a Canvas delegate, and still gets the owner", () => {
    const r = empty()
    r.wallet!.delegateOf = [{ tokenId: 7141, owner: "0xfafd", via: "delegate.xyz" }]
    const m = buildPageModel(r)
    assert.equal(m.state, "delegate-only")
    assert.match(m.lines.join(" "), /Delegate\.xyz delegate for #7141/)
    assert.doesNotMatch(m.headline, /edit pixels/)
    assert.deepEqual(m.delegateOf, [{ tokenId: 7141, owner: "0xfafd", via: "delegate.xyz" }])
  })
  it("a Canvas delegate keeps the pixel-editing wording", () => {
    const r = empty()
    r.wallet!.delegateOf = [{ tokenId: 7141, owner: "0xfafd" }]
    assert.match(buildPageModel(r).headline, /edit pixels/)
  })
  it("a big vault is summarised, not listed 378 times", () => {
    const r = empty()
    r.wallet!.delegateOf = Array.from({ length: 378 }, (_, i) => ({ tokenId: 30 + i, owner: "0xvault", via: "delegate.xyz" as const }))
    const line = buildPageModel(r).lines.join(" ")
    assert.match(line, /378 Normies \(including #30, #31, #32\)/)
    assert.ok(line.length < 300)
  })
})
