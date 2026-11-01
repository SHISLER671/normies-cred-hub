import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { composeZuloPrompt } from "./composePrompt"
import { DUAL_EVAL_AND_PIXEL_MARKET_MD } from "./loadKnowledge"
import {
  HOLDING_WALLETS,
  REVENUE_SHARE_SOURCE,
  WALLET_SPREAD,
  cellMultiplier,
  findTierAnswerViolations,
  formatTierMath,
  isTierQuestion,
  parseTierQuestion,
} from "./tierMath"
import type { ZuloRecommendationContext } from "./types"

function must<T>(v: T | null | undefined, what = "value"): T {
  if (v == null) throw new Error(`expected ${what}`)
  return v
}

function ctx(): ZuloRecommendationContext {
  const c: ZuloRecommendationContext = {
    user: { walletAddress: "" },
    normie: {
      id: 7141,
      name: "Zulo · speaker identity",
      traits: {},
      agent: { id: 32626, name: "Zulo", status: "awakened" },
    },
    session: { history: [], currentGoal: "general" },
    platformContext: {
      currentTime: "2026-11-02T00:00:00.000Z",
      subjectScope: {
        mode: "general",
        walletConnected: false,
        activeNormieId: null,
        mentionedTokenIds: [],
        normieIsSpeakerIdentityOnly: true,
        userOwnsFocus: false,
      },
      mentionedNormies: [],
    },
  }
  return c
}

const ONE_NORMIE_14 = "I have 1 Normie and 14 #PIXEL. Is it worth buying 1 more #PIXEL to reach 15?"

describe("tier math: before/after score from the official formula (normies.art Revenue Share tab, 2026-11-02)", () => {
  it("one Normie, 14 -> 15 #PIXEL: x1.00 to x1.15, 3.8 to 4.6, about 21% more score, 18 wallets", () => {
    const tq = must(parseTierQuestion(ONE_NORMIE_14), "tier question")
    const r = formatTierMath(tq)
    assert.equal(r.before.held, 1)
    assert.equal(r.before.pixel, 14)
    assert.equal(r.after.pixel, 15)
    assert.equal(Math.round(r.scoreBefore * 10) / 10, 3.8)
    assert.equal(Math.round(r.scoreAfter * 10) / 10, 4.6)
    assert.equal(r.pctMoreScore, 21)
    assert.match(r.line, /from x1\.00 to x1\.15, about 21% more score \(3\.8 to 4\.6\)/)
    assert.match(r.line, /18 of 1,665 holding wallets are in that spot today/)
    assert.match(r.line, /can't be known in advance/)
    assert.match(r.line, /Don't take our word for it/)
    assert.match(r.line, /Not financial advice, and values can go up or down\. See \/burn for a vibe check\./)
  })

  it("every combined cell matches the tab (bracket x boost at 15+)", () => {
    const tab: Array<[number, number, number]> = [
      [1, 1.0, 1.15], [2, 1.15, 1.32], [5, 1.3, 1.49], [10, 1.45, 1.67], [25, 1.6, 1.84], [50, 1.75, 2.01],
    ]
    for (const [held, under, plus] of tab) {
      assert.ok(Math.abs(cellMultiplier({ held, pixel: 0 }) - under) < 0.006, `held ${held} under 15`)
      assert.ok(Math.abs(cellMultiplier({ held, pixel: 15 }) - plus) < 0.006, `held ${held} 15+`)
    }
  })

  it("a Normies-bracket question uses the bracket step", () => {
    const tq = must(parseTierQuestion("I hold 3 Normies and 20 pixel, worth buying 2 more normies to reach the 5 bracket?"), "tier question")
    assert.equal(tq.crosses, "normies")
    assert.equal(tq.after.held, 5)
    const r = formatTierMath(tq)
    assert.match(r.line, /from x1\.32 to x1\.49/)
    assert.match(r.line, /13 of 1,665/)
  })

  it("#PIXEL with no Normie is not scored and the holding is asked for, not guessed", () => {
    assert.equal(parseTierQuestion("is it worth buying 1 more #PIXEL to reach 15?"), null)
    const prompt = composeZuloPrompt(ctx(), "is it worth buying 1 more #PIXEL to reach 15?")
    assert.match(prompt, /holding is not stated: ask for Normies held and #PIXEL held/)
  })

  it("a token ID like #7141 is never read as a holding", () => {
    const tq = must(parseTierQuestion("I have 1 Normie (#7141) and 99 #PIXEL, worth buying 1 more to reach 100?"), "tier question")
    assert.equal(tq.before.held, 1)
    assert.equal(tq.before.pixel, 99)
    assert.equal(tq.after.pixel, 100)
  })

  it("non-tier questions are left alone", () => {
    assert.equal(isTierQuestion("what is the floor today?"), false)
    assert.match(composeZuloPrompt(ctx(), "what is the floor today?"), /No tier question this turn/)
  })

  it("the wallet spread carries its source and as-of time", () => {
    assert.equal(HOLDING_WALLETS, 1665)
    assert.equal(WALLET_SPREAD.length, 6)
    assert.match(REVENUE_SHARE_SOURCE.asOf, /2026-11-02 07:26 Guam/)
    assert.match(REVENUE_SHARE_SOURCE.post, /x\.com\/normiesART\/status\/2116953901417046511/)
  })
})

describe("tier answers: no verdict, no price, no ETH payout or earnings projection", () => {
  it("the detector catches each kind of bad answer", () => {
    const bad = [
      "Yes, it's worth it.",
      "Do it.",
      "You should buy the extra pixel.",
      "That's a no-brainer.",
      "The price will go up after the next epoch.",
      "That adds about 0.003 ETH to your payout.",
      "Roughly Ξ0.09 for you.",
      "About $211 extra.",
      "You'll earn more per month.",
      "That is a 21% ROI.",
    ]
    for (const b of bad) assert.ok(findTierAnswerViolations(b).length > 0, b)
  })

  it("every computed tier line is clean, across holdings and both kinds of step", () => {
    const helds = [1, 2, 3, 4, 5, 9, 10, 24, 25, 49, 50, 80]
    const pixels = [0, 4, 14, 15, 60, 99, 100, 499, 500, 1499, 1500]
    let checked = 0
    for (const held of helds) {
      for (const pixel of pixels) {
        for (const q of [
          `I have ${held} Normies and ${pixel} #PIXEL, worth buying more #PIXEL to reach the next boost tier?`,
          `I have ${held} Normies and ${pixel} #PIXEL, worth buying more normies to reach the next bracket?`,
        ]) {
          const tq = parseTierQuestion(q)
          if (!tq) continue
          const line = formatTierMath(tq).line
          assert.deepEqual(findTierAnswerViolations(line), [], line)
          assert.match(line, /See \/burn for a vibe check/)
          checked++
        }
      }
    }
    assert.ok(checked > 100, `checked ${checked}`)
  })

  it("the knowledge answer pattern (Ryan's target shape) is clean", () => {
    const m = must(/### "Is it worth buying 1 more #PIXEL[\s\S]*?- Shape: "([^\n]+)"\n/.exec(DUAL_EVAL_AND_PIXEL_MARKET_MD), "answer pattern")
    assert.deepEqual(findTierAnswerViolations(m[1]), [])
    assert.match(m[1], /x1\.00 to x1\.15, about 21% more score \(3\.8 to 4\.6\)/)
  })

  it("the composed prompt carries the rule, the tier tables and the computed line", () => {
    const prompt = composeZuloPrompt(ctx(), ONE_NORMIE_14)
    assert.match(prompt, /advise without advising/)
    assert.match(prompt, /Never say do it or don't, never call it worth it or not/)
    assert.match(prompt, /never quote simulator outputs/)
    assert.match(prompt, /1e\. Revenue Share tab: tiers and wallet spread/)
    assert.match(prompt, /1: 1,041 \/ 18 · 2-4: 338 \/ 37 · 5-9: 84 \/ 13 · 10-24: 50 \/ 8 · 25-49: 13 \/ 2 · 50\+: 1 \/ 4/)
    assert.match(prompt, /=== TIER MATH \(computed this turn/)
    const block = prompt.split("=== TIER MATH")[1].split("===")[1]
    assert.match(block, /x1\.00 to x1\.15/)
    // The computed block itself never carries an ETH, USD or earnings figure.
    const computed = block.split("\n").find((l) => l.startsWith("- Going from")) ?? ""
    assert.ok(computed)
    assert.deepEqual(findTierAnswerViolations(computed), [])
  })
})
