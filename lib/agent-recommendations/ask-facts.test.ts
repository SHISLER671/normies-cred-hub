import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { composeZuloPrompt } from "./composePrompt"
import {
  formatBurnMath,
  parsePaidEthFromQuery,
} from "./burnMath"
import {
  buildCollabRailsPromptBlock,
  getCollabRailsContextSummary,
  getDualEvalAndPixelMarketContextSummary,
  queryNeedsCollabRailsKnowledge,
} from "./loadKnowledge"
import type { ZuloRecommendationContext } from "./types"

function generalContext(): ZuloRecommendationContext {
  return {
    user: { walletAddress: "" },
    normie: {
      id: 7141,
      name: "Zulo · Normie #7141 (speaker identity — not visitor subject)",
      traits: {},
      agent: {
        id: 32626,
        name: "Zulo",
        status: "awakened",
      },
    },
    session: { history: [], currentGoal: "general Normies guidance" },
    platformContext: {
      currentTime: "2026-08-16T00:00:00.000Z",
      subjectScope: {
        mode: "general",
        walletConnected: false,
        activeNormieId: null,
        mentionedTokenIds: [],
        normieIsSpeakerIdentityOnly: true,
        userOwnsFocus: false,
      },
      mentionedNormies: [],
      collabRails: getCollabRailsContextSummary(),
    },
  }
}

describe("collab / rails knowledge", () => {
  it("names the three public pillars and TBA", () => {
    const block = buildCollabRailsPromptBlock()
    assert.match(block, /swarm/i)
    assert.match(block, /predict/i)
    assert.match(block, /launchpad/i)
    assert.match(block, /\bTBA\b/)
    assert.match(block, /not a StonkBroker/i)
  })

  it("frames #PIXEL as Action Points and not a token", () => {
    const block = buildCollabRailsPromptBlock()
    assert.match(block, /Action Points/)
    assert.match(block, /not a token/i)
    assert.match(block, /getting ready/i)
    assert.doesNotMatch(block, /market will add buy\/sell later/i)
  })

  it("splits industry x402 from Normies TBA", () => {
    const block = buildCollabRailsPromptBlock()
    assert.match(block, /industry-live/i)
    assert.match(block, /Normies has \*\*not\*\* enabled/i)
    assert.match(block, /Never:.*Normies agents can pay\/earn via x402/)
  })

  it("dual-eval market copy dropped invented buy/sell rules", () => {
    const summary = getDualEvalAndPixelMarketContextSummary()
    const joined = summary.pixelMarket.join(" ")
    assert.match(joined, /NOT a token/i)
    assert.match(joined, /getting ready/i)
    assert.doesNotMatch(joined, /will add buy\/sell later/i)
  })
})

describe("queryNeedsCollabRailsKnowledge", () => {
  it("matches collab, x402, passive, and pixel-token asks", () => {
    assert.equal(queryNeedsCollabRailsKnowledge("what's the stonk collab?"), true)
    assert.equal(queryNeedsCollabRailsKnowledge("x402 for Zulo?"), true)
    assert.equal(
      queryNeedsCollabRailsKnowledge("passive income from my agent?"),
      true,
    )
    assert.equal(queryNeedsCollabRailsKnowledge("is PIXEL a token"), true)
    assert.equal(queryNeedsCollabRailsKnowledge("hello"), false)
  })
})

describe("burn math", () => {
  it("parses paid ETH from free text", () => {
    assert.equal(parsePaidEthFromQuery("I paid 0.27 ETH for #412"), 0.27)
    assert.equal(parsePaidEthFromQuery("bought at 0.3 eth"), 0.3)
    assert.equal(parsePaidEthFromQuery("should I burn #7141"), null)
  })

  it("shows labeled $/AP range for 647 px / 0.27 ETH / $1900", () => {
    const result = formatBurnMath({
      pixelCount: 647,
      ethAmount: 0.27,
      priceKind: "paid",
      ethUsd: 1900,
    })
    assert.ok(result)
    assert.equal(result.minAp, 12)
    assert.equal(result.maxAp, 25)
    assert.equal(result.usd, 513)
    assert.match(result.line, /647 px/)
    assert.match(result.line, /~12–25 AP/)
    assert.match(result.line, /\$20/)
    assert.match(result.line, /\$43/)
    assert.match(result.line, /estimate/i)
  })

  it("omits USD when ethUsd is missing", () => {
    const result = formatBurnMath({
      pixelCount: 647,
      ethAmount: 0.27,
      priceKind: "paid",
      ethUsd: null,
    })
    assert.ok(result)
    assert.equal(result.usd, null)
    assert.match(result.line, /do not invent/i)
    assert.match(result.line, /ETH-USD unavailable/)
  })
})

describe("composed Ask prompt", () => {
  it("injects conservative facts and #7141 speaker-only rule", () => {
    const prompt = composeZuloPrompt(
      generalContext(),
      "What's the Stonk collab?",
    )
    assert.match(prompt, /swarm/)
    assert.match(prompt, /launchpad/)
    assert.match(prompt, /#PIXEL = Action Points, NOT a token/)
    assert.match(prompt, /getting ready/)
    assert.match(prompt, /industry YES/i)
    assert.match(prompt, /Normies enablement: TBA/)
    assert.match(prompt, /not a StonkBroker/i)
    assert.match(prompt, /do not treat #7141 as the visitor's Normie/i)
    assert.match(prompt, /Never:.*Normies agents can pay\/earn via x402/)
    assert.doesNotMatch(prompt, /pulse-analysis: \d+ AP/)
  })

  it("does not invent Pixel Market buy/sell rules in the composed prompt", () => {
    const prompt = composeZuloPrompt(generalContext(), "is PIXEL a token")
    assert.doesNotMatch(prompt, /market will add buy\/sell later/i)
    assert.match(prompt, /NOT a token/)
  })
})
