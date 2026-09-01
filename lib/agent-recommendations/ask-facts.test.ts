import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { composeZuloPrompt } from "./composePrompt"
import {
  ensurePulseFirst,
  formatPulseLead,
  resolvePulseSubject,
} from "./pulseFirst"
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
import {
  buildOperatorTandemPromptBlock,
  buildVisitorSafeTandemPromptBlock,
} from "./operatorTandem"
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
    assert.match(block, /Coming Soon/)
    assert.match(block, /not live full rules/i)
    assert.doesNotMatch(block, /market will add buy\/sell later/i)
  })

  it("keeps 2026-08-31 / 2026-09-01 pairing add-on inside public rails", () => {
    const block = buildCollabRailsPromptBlock()
    assert.match(block, /Future is Agentic/)
    assert.match(block, /NORMIES x STONKBROKERS/)
    assert.match(block, /TBA until @normiesART posts it live/)
    assert.match(block, /fees to projects/i)
    assert.match(block, /Zulo does not accept public pay-in/)
    assert.match(block, /not a CredHub feature/)
    assert.match(block, /Never invent a Hive URL/)
    assert.match(block, /Zulo does not place the trade/)
    assert.doesNotMatch(block, /Zulo Desk/)
    assert.doesNotMatch(block, /Grok Bot/)
    assert.doesNotMatch(block, /AGNT/)
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
    assert.match(joined, /Coming Soon/)
    assert.match(joined, /NOT live full rules/i)
    assert.doesNotMatch(joined, /will add buy\/sell later/i)
  })
})

describe("operator tandem layers", () => {
  it("keeps the internal roster dated 2026-09-01 and renamed Zulo Desk", () => {
    const internal = buildOperatorTandemPromptBlock()
    assert.match(internal, /Two desks exist as of 2026-09-01 \(Guam\)/)
    assert.match(internal, /Zulo Voice/)
    assert.match(internal, /Zulo Desk \(renamed from Hive Desk\)/)
    assert.match(internal, /Never put HOT\/AGNT\/COLD private keys/)
    assert.match(
      internal,
      /Do not name Zulo Desk, Grok Bot, Cursor, or credit budgets in visitor-facing recommendation text/,
    )
  })

  it("exposes a visitor-safe tandem without desk names", () => {
    const visitor = buildVisitorSafeTandemPromptBlock()
    assert.match(visitor, /Public voice @zulo7141 is human-pasted/)
    assert.match(visitor, /No autonomous posts/)
    assert.match(visitor, /No keys, burns, approvals, or pay-in through CredHub/)
    assert.match(visitor, /Live facts: ON-CHAIN or OFFICIAL only/)
    assert.doesNotMatch(visitor, /Grok Bot/)
    assert.doesNotMatch(visitor, /Zulo Desk/)
    assert.doesNotMatch(visitor, /Hive Desk/)
    assert.doesNotMatch(visitor, /Cursor/)
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

  it("matches hive, stonk launch, and pay-zulo asks", () => {
    assert.equal(queryNeedsCollabRailsKnowledge("Where is the Hive?"), true)
    assert.equal(
      queryNeedsCollabRailsKnowledge("Can my agent launch on Stonk today?"),
      true,
    )
    assert.equal(queryNeedsCollabRailsKnowledge("Where do I pay Zulo?"), true)
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
    assert.match(prompt, /Coming Soon/)
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
    assert.match(prompt, /Coming Soon/)
    assert.match(prompt, /not live full rules/i)
  })

  it("keeps visitor Ask tandem free of desk names and keys", () => {
    const prompt = composeZuloPrompt(
      generalContext(),
      "Can Zulo tweet? Where do I pay Zulo?",
    )
    assert.match(prompt, /Public voice @zulo7141 is human-pasted/)
    assert.match(prompt, /No autonomous posts/)
    assert.match(prompt, /No keys, burns, approvals, or pay-in through CredHub/)
    assert.match(prompt, /Live facts: ON-CHAIN or OFFICIAL only/)
    assert.doesNotMatch(prompt, /Grok Bot/)
    assert.doesNotMatch(prompt, /Zulo Desk/)
    assert.doesNotMatch(prompt, /Hive Desk/)
    assert.doesNotMatch(prompt, /Cursor/)
    assert.doesNotMatch(prompt, /SuperGrok/)
    assert.doesNotMatch(prompt, /AGNT/)
    assert.doesNotMatch(prompt, /Zulo can trade your bag/)
  })

  it("answers stonk-launch and hive asks as pairing + TBA, not live rails", () => {
    const prompt = composeZuloPrompt(
      generalContext(),
      "Can my agent launch on Stonk today? Where is the Hive?",
    )
    assert.match(prompt, /TBA until @normiesART posts it live/)
    assert.match(prompt, /Zulo does not place the trade/)
    assert.match(prompt, /not a CredHub (?:page|feature)/)
    assert.match(prompt, /Never invent a Hive URL/)
  })

  it("instructs Pulse-first structure before ranked advice", () => {
    const prompt = composeZuloPrompt(generalContext(), "what should I burn")
    assert.match(prompt, /PULSE-FIRST RESPONSE RULES/)
    assert.match(prompt, /Always open with or immediately include the subject's Pulse/)
    assert.match(prompt, /Pulse data unavailable for this token/)
    assert.match(prompt, /do not act/i)
    assert.match(prompt, /Never manufacture urgency/)
  })

  it("teaches Normies Cred Pulse then Normies Paths with canonical Ethereum IDs", () => {
    const prompt = composeZuloPrompt(
      generalContext(),
      "what tools should agents call?",
    )
    assert.match(prompt, /NORMIES AGENT TOOLS/)
    assert.match(prompt, /Normies Cred Pulse/)
    assert.match(prompt, /Normies Paths/)
    assert.match(prompt, /Tool #53/)
    assert.match(prompt, /Tool #215/)
    assert.match(prompt, /Never invent tool IDs/)
    assert.match(prompt, /Pulse → Paths/)
    assert.match(prompt, /Call this after Pulse/)
  })
})

describe("pulse-first guarantee", () => {
  it("does not invent visitor Pulse in general mode", () => {
    const subject = resolvePulseSubject(generalContext())
    assert.equal(subject.hasSubject, false)
    assert.equal(formatPulseLead(subject), null)

    const out = ensurePulseFirst(
      {
        understanding: "General burn question.",
        recommendation: "Need a token ID.",
        reasoning: "No subject.",
        nextSteps: ["Name a token ID"],
        confidence: 80,
      },
      generalContext(),
    )
    assert.equal(out.pulseLead, undefined)
    assert.equal(out.confidence, 80)
    assert.doesNotMatch(out.understanding, /Pulse /)
  })

  it("prepends Pulse snapshot when the model forgets", () => {
    const ctx = generalContext()
    ctx.platformContext!.subjectScope = {
      mode: "mentioned_ids",
      walletConnected: false,
      activeNormieId: null,
      mentionedTokenIds: [7141],
      normieIsSpeakerIdentityOnly: false,
      userOwnsFocus: false,
    }
    ctx.platformContext!.pulse = {
      tokenId: 7141,
      agentId: 32626,
      pulseLevel: 4,
      maxLevel: 5,
      status: "Strong",
      breakdown: [
        "ERC-8004 registered",
        "Has active agent card",
        "Canvas activity detected",
        "Clean ownership & delegation",
      ],
      gaps: [],
      nextSignal: null,
      note: "",
    }

    const out = ensurePulseFirst(
      {
        understanding: "You want burn fodder.",
        recommendation: "Ranked moves follow.",
        reasoning: "Efficiency plus identity.",
        nextSteps: ["Check PULSE", "Do not act if unsure"],
        confidence: 82,
      },
      ctx,
    )
    assert.match(out.pulseLead ?? "", /^Pulse 4\/5 \(Strong\)/)
    assert.match(out.pulseLead ?? "", /conditioned on this/)
    assert.match(out.understanding, /^Pulse 4\/5 \(Strong\)/)
    assert.equal(out.confidence, 82)
  })

  it("caps confidence when Pulse is missing for a subject token", () => {
    const ctx = generalContext()
    ctx.platformContext!.subjectScope = {
      mode: "active_normie",
      walletConnected: true,
      activeNormieId: 42,
      mentionedTokenIds: [],
      normieIsSpeakerIdentityOnly: false,
      userOwnsFocus: true,
    }
    ctx.normie.id = 42

    const out = ensurePulseFirst(
      {
        understanding: "Looking at #42.",
        recommendation: "Hold vs burn needs more signal.",
        reasoning: "Thin data.",
        nextSteps: ["Re-check Pulse"],
        confidence: 88,
      },
      ctx,
    )
    assert.equal(out.pulseLead, "Pulse data unavailable for this token → confidence capped.")
    assert.match(out.understanding, /Pulse data unavailable/)
    assert.equal(out.confidence, 55)
  })

  it("does not duplicate an existing Pulse lead", () => {
    const ctx = generalContext()
    ctx.platformContext!.subjectScope = {
      mode: "mentioned_ids",
      walletConnected: false,
      activeNormieId: null,
      mentionedTokenIds: [1],
      normieIsSpeakerIdentityOnly: false,
      userOwnsFocus: false,
    }
    ctx.platformContext!.pulse = {
      tokenId: 1,
      agentId: null,
      pulseLevel: 2,
      maxLevel: 5,
      status: "Building",
      breakdown: ["ERC-8004 registered"],
      gaps: [],
      nextSignal: null,
      note: "",
    }
    const lead = formatPulseLead(resolvePulseSubject(ctx))!
    const out = ensurePulseFirst(
      {
        understanding: `${lead}\n\nYou asked about identity.`,
        recommendation: "Stay with Pulse gaps.",
        reasoning: "Already led with Pulse.",
        nextSteps: [],
        confidence: 70,
      },
      ctx,
    )
    const count = (out.understanding.match(/Pulse 2\/5/g) ?? []).length
    assert.equal(count, 1)
  })
})
