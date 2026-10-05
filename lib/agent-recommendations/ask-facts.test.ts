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
import { CANVAS_EVOLUTION_DISCLAIMER } from "./canvasEvolution"
import { COMMUNITY_TOOLS } from "./communityTools"
import { buildMarketStatusBlock } from "./marketStatus"
import { launchTimePassed } from "../burn-buy/market-launch"
import { ECOSYSTEM_LINKS } from "./constants"
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

  it("locks canvas / Normifier preview as not an AP debit", () => {
    const block = buildCollabRailsPromptBlock()
    assert.match(block, /not spent when you draw/i)
    assert.match(block, /#PIXEL as pixel budget/)
    assert.match(block, /1 PIXEL = 1 pixel/)
    assert.match(block, /not an AP debit/)
    assert.match(block, /Preview on Normifier/)
    assert.match(block, /not a spend rail/)
    assert.match(block, /customize to earn PIXEL/)
    assert.doesNotMatch(block, /before spending/i)
    assert.doesNotMatch(block, /spending \d+ AP/i)
    assert.doesNotMatch(block, /this will cost AP/i)
    assert.doesNotMatch(block, /1 AP per pixel/i)
  })

  it("keeps Yacht Club as a community rail, not a Stonk pillar", () => {
    const block = buildCollabRailsPromptBlock()
    const summary = getCollabRailsContextSummary()
    assert.match(block, /Community build — Normies Yacht Club/)
    assert.match(block, /not official Normies product/)
    assert.match(block, /@OsayKancuno/)
    assert.match(block, /normiesyachtclub\.com/)
    assert.match(block, /\/developers/)
    assert.match(block, /\/purser/)
    assert.match(block, /\/claim/)
    assert.match(block, /0x87306c282eBd62Fe1c80AA69Dd9408331Dc11f64/)
    assert.match(block, /Anchor Points ≠ Normies PIXEL/)
    assert.match(block, /Brokers’ Atoll ≠ StonkBrokers/)
    assert.match(block, /Do not write “official Normies Yacht Club”/)
    assert.match(block, /Zulo does not claim, mint, or sign/)
    assert.match(block, /Do not pitch NYC Anchor Points as an earn product/)
    assert.match(block, /will not execute standing orders/)
    assert.match(block, /CredHub does not run their agents/)
    assert.doesNotMatch(block, /Grok Bot/)
    assert.doesNotMatch(block, /Zulo Desk/)
    assert.doesNotMatch(block, /Cursor/)
    assert.doesNotMatch(block, /Halu/)
    assert.doesNotMatch(block, /#2688/)
    assert.doesNotMatch(block, /0x4301dc2/i)
    assert.ok(
      summary.pillars.every((p) => !/yacht/i.test(p)),
      "Yacht Club must not sit in official StonkBrokers pillars",
    )
    assert.ok(summary.rails.some((r) => /Yacht Club = community build/.test(r)))
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

  it("keeps 2026-09-18 official Arena description public, not playable on CredHub", () => {
    const block = buildCollabRailsPromptBlock()
    assert.match(block, /2026-09-18 official Arena description/)
    assert.match(block, /2100884284659667175/)
    assert.match(block, /640×640/)
    assert.match(block, /No human players/)
    assert.match(block, /No script/)
    assert.match(block, /Human, Cat, Alien, Agent, Zombie/)
    assert.match(block, /six minutes/)
    assert.match(block, /next Arena round and respawns/)
    assert.match(block, /NFT is \*\*not\*\* burned/)
    assert.match(block, /same wallet or related wallet history/)
    assert.match(block, /Zulo does \*\*not\*\* form the team/)
    assert.match(block, /Survivors earn \*\*#PIXEL\*\*/)
    assert.match(block, /in-world PX \/ survivor PIXEL ≠ a shop/i)
    assert.match(block, /does \*\*not\*\* open Pixel Market/)
    assert.match(block, /Not playable on CredHub/)
    assert.match(block, /Not “enter from CredHub.”/)
    assert.match(block, /Not play from here/)
    assert.match(block, /Zombies \*\*21\/21 sealed\*\* ≠ join Arena from CredHub/)
    assert.match(block, /on-chain:\*\* Canvas, Pixel Market, Arena, Hive/)
    assert.match(block, /murals, IRL events, physicals, limited edition artworks/)
    assert.doesNotMatch(block, /Grok Bot/)
    assert.doesNotMatch(block, /Zulo Desk/)
    assert.doesNotMatch(block, /Cursor/)
    assert.doesNotMatch(block, /Shardborn/)
    assert.doesNotMatch(block, /combat INT/)
    assert.doesNotMatch(block, /smart Human/i)
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
    // 2026-10-05: the market is "not open yet", and its revenue-share rules are now OFFICIAL; prices and order-book mechanics stay TBA.
    assert.match(joined, /not open yet/i)
    assert.match(joined, /revenue-share rules are OFFICIAL/)
    assert.match(joined, /order-book mechanics TBA/i)
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

  it("matches Yacht Club community-rail asks", () => {
    assert.equal(queryNeedsCollabRailsKnowledge("What is Normies Yacht Club?"), true)
    assert.equal(queryNeedsCollabRailsKnowledge("Are Yacht Club points PIXEL?"), true)
    assert.equal(
      queryNeedsCollabRailsKnowledge(
        "Is Yacht Club the Hive / Arena / Pixel Market / StonkBrokers?",
      ),
      true,
    )
    assert.equal(
      queryNeedsCollabRailsKnowledge("Should I burn #7141 for a yacht?"),
      true,
    )
    assert.equal(
      queryNeedsCollabRailsKnowledge("I burned a Normie — do I get a yacht?"),
      true,
    )
    assert.equal(
      queryNeedsCollabRailsKnowledge("can Zulo talk to the Yacht Club API?"),
      true,
    )
    assert.equal(queryNeedsCollabRailsKnowledge("Can Zulo run my Purser agent?"), true)
    assert.equal(
      queryNeedsCollabRailsKnowledge("what are Anchor Points / the Tide / Chandlery?"),
      true,
    )
    assert.equal(queryNeedsCollabRailsKnowledge("is Brokers' Atoll StonkBrokers?"), true)
  })

  it("matches official Arena 2026-09-18 asks", () => {
    assert.equal(queryNeedsCollabRailsKnowledge("Is Arena live / can I play?"), true)
    assert.equal(
      queryNeedsCollabRailsKnowledge("If my agent dies is the NFT gone?"),
      true,
    )
    assert.equal(
      queryNeedsCollabRailsKnowledge("Will my two Normies team?"),
      true,
    )
    assert.equal(
      queryNeedsCollabRailsKnowledge("Where do I sell Arena PIXEL?"),
      true,
    )
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

  it("does not tell visitors they spend AP to preview or customize appearance", () => {
    const questions = [
      "Preview edits on Normifier",
      "Should I customize my canvas?",
      "preview canvas add 12 pixels",
    ]
    for (const q of questions) {
      const prompt = composeZuloPrompt(generalContext(), q)
      assert.match(prompt, /Preview on Normifier before you commit a canvas edit in official UI/)
      assert.match(prompt, /AP stays on the token you keep/)
      assert.match(prompt, /#PIXEL as pixel budget/)
      assert.match(prompt, /not an AP debit/)
      assert.match(prompt, /CredHub \/ Normifier preview is not a spend rail/)
      assert.match(prompt, /Holder draws \/ canvases only at official Normies UI/)
      assert.doesNotMatch(prompt, /before spending/i)
      assert.doesNotMatch(prompt, /spending \d+ AP/i)
      assert.doesNotMatch(prompt, /this will cost AP/i)
      assert.doesNotMatch(prompt, /On-chain edit fee is 1 AP per pixel/i)
      assert.doesNotMatch(prompt, /1 AP per pixel (?:changed|flip|add)/i)
      assert.doesNotMatch(prompt, /Grok Bot/)
      assert.doesNotMatch(prompt, /Zulo Desk/)
      assert.doesNotMatch(prompt, /Cursor/)
    }
    assert.doesNotMatch(CANVAS_EVOLUTION_DISCLAIMER, /AP cost uses 1 AP/)
    assert.doesNotMatch(CANVAS_EVOLUTION_DISCLAIMER, /1 AP per pixel/)
    assert.match(CANVAS_EVOLUTION_DISCLAIMER, /not an AP debit/)
    assert.match(CANVAS_EVOLUTION_DISCLAIMER, /not a spend rail/)
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

  it("answers Yacht Club as community, not official product / PIXEL / Hive", () => {
    const questions = [
      "What is Normies Yacht Club?",
      "Are Yacht Club points PIXEL?",
      "Is Yacht Club the Hive / Arena / Pixel Market / StonkBrokers?",
      "Should I burn #7141 for a yacht?",
      "I burned a Normie — do I get a yacht?",
      "can Zulo / CredHub talk to the Yacht Club API?",
      "Can Zulo run my Purser agent?",
      "what are Anchor Points / the Tide / Chandlery?",
    ]
    for (const q of questions) {
      const prompt = composeZuloPrompt(generalContext(), q)
      assert.match(prompt, /not official Normies product/)
      assert.match(prompt, /@OsayKancuno/)
      assert.match(prompt, /normiesyachtclub\.com/)
      assert.match(prompt, /\/purser/)
      assert.match(prompt, /\/developers/)
      assert.match(prompt, /Anchor Points ≠ PIXEL/)
      assert.match(prompt, /Marina \/ Agent Islands \/ Trade Wind Quay ≠ Hive \/ Pixel Market \/ Arena/)
      assert.match(prompt, /Brokers' Atoll ≠ StonkBrokers/)
      assert.match(prompt, /Do not write "official Normies Yacht Club"/)
      assert.match(prompt, /Last-face hygiene/)
      assert.match(prompt, /do not treat #7141 as the visitor's Normie/i)
      assert.match(prompt, /hold Purser keys, or execute standing orders/)
      assert.doesNotMatch(prompt, /Grok Bot/)
      assert.doesNotMatch(prompt, /Zulo Desk/)
      assert.doesNotMatch(prompt, /Hive Desk/)
      assert.doesNotMatch(prompt, /Cursor/)
      assert.doesNotMatch(prompt, /Halu/)
      assert.doesNotMatch(prompt, /#2688/)
      assert.doesNotMatch(prompt, /0x4301dc2/i)
    }
  })

  it("does not add Yacht Club to community-tools Paths catalog or ecosystem links", () => {
    const names = COMMUNITY_TOOLS.map((t) => `${t.name} ${t.url}`).join("\n")
    assert.doesNotMatch(names, /yacht/i)
    assert.doesNotMatch(names, /normiesyachtclub/i)
    const links = Object.values(ECOSYSTEM_LINKS)
      .map((v) => (typeof v === "function" ? v(1) : v))
      .join("\n")
    assert.doesNotMatch(links, /yacht/i)
    assert.doesNotMatch(links, /normiesyachtclub/i)
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

  it("answers Arena 2026-09-18 asks as official design, not playable on CredHub", () => {
    const questions = [
      "Is Arena live / can I play?",
      "If my agent dies is the NFT gone?",
      "Will my two Normies team?",
      "Where do I sell Arena PIXEL?",
    ]
    for (const q of questions) {
      const prompt = composeZuloPrompt(generalContext(), q)
      assert.match(prompt, /official 2026-09-18 design is public/i)
      assert.match(prompt, /CredHub does not host the map/)
      assert.match(prompt, /Not enter-from-CredHub/)
      assert.match(prompt, /Not play from here/)
      assert.match(prompt, /next Arena round and respawns/)
      assert.match(prompt, /Not an NFT burn/)
      assert.match(prompt, /can group if same wallet or related wallet history/)
      assert.match(prompt, /Zulo does not form the team/)
      assert.match(prompt, /survivors earn #PIXEL/i)
      assert.match(prompt, /Pixel Market not opened by the 2026-09-18 post/)
      assert.match(prompt, /in-world PX \/ survivor PIXEL ≠ a shop/)
      assert.match(prompt, /Coming Soon/)
      assert.match(prompt, /not live full rules/i)
      assert.match(prompt, /640×640/)
      assert.match(prompt, /No human players/)
      assert.doesNotMatch(prompt, /Grok Bot/)
      assert.doesNotMatch(prompt, /Zulo Desk/)
      assert.doesNotMatch(prompt, /Hive Desk/)
      assert.doesNotMatch(prompt, /Cursor/)
      assert.doesNotMatch(prompt, /Shardborn/)
      assert.doesNotMatch(prompt, /combat INT/)
      assert.doesNotMatch(prompt, /smart Human/i)
    }
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

describe("Ask knows the OFFICIAL Pixel Market economics (updated 2026-10-05)", () => {
  const prompt = composeZuloPrompt(generalContext(), "How is my share of the Pixel Market revenue calculated?")

  it("gives the official score formula, brackets, boosts and the 50% holder split", () => {
    assert.match(prompt, /\(Normies x bracket multiplier \+ #PIXEL \/ 5\) x \(1 \+ boost\)/)
    assert.match(prompt, /2 = 1\.15x, 5 = 1\.30x, 10 = 1\.45x, 25 = 1\.60x, 50 = 1\.75x/)
    assert.match(prompt, /15 = \+15%, 100 = \+35%, 500 = \+60%, 1,500 = \+100%/)
    assert.match(prompt, /10% fee/)
    assert.match(prompt, /50% of that fee goes to holders/)
    assert.match(prompt, /5% royalty/)
    assert.match(prompt, /four random blocks a day/)
    assert.match(prompt, /#PIXEL alone earns nothing/)
  })
  it("no longer tells people the revenue-share rules are unpublished", () => {
    assert.match(prompt, /Never say the revenue-share formula is unpublished/)
    assert.match(prompt, /revenue-share rules ARE official/)
  })
  it("keeps the honesty rails: market not open yet, no invented prices or order book", () => {
    assert.match(prompt, /not open yet/)
    assert.match(prompt, /Never invent AP prices, order books, buy\/sell mechanics/)
    assert.match(prompt, /audits permitting/)
  })
  it("burn yield is on the ORIGINAL pixel count and editing does not raise it", () => {
    assert.match(prompt, /ORIGINAL pixel count/)
    assert.match(prompt, /Painting or editing does not raise burn yield/)
    assert.match(prompt, /Never say edited or painted pixels raise burn yield/)
  })
  it("the 4% promo is described as community-sourced, never as official", () => {
    assert.match(prompt, /community-sourced/)
    assert.match(prompt, /NOT from an official @normiesART post/)
  })
  it("points to the independent /burn tool and the official simulator, nothing else invented", () => {
    assert.match(prompt, /https:\/\/normiescredhub\.vercel\.app\/burn/)
    assert.match(prompt, /simulator\.normies\.art/)
    assert.match(prompt, /independent community tool, not made by the Normies team/)
  })
})

describe("the knowledge .md files and their bundled runtime copies stay in sync", () => {
  const norm = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").trim()
  it("dual-evaluation-and-pixel-market", async () => {
    const fs = await import("node:fs")
    const { DUAL_EVAL_AND_PIXEL_MARKET_MD } = await import("./loadKnowledge")
    assert.equal(norm(fs.readFileSync("lib/agent-recommendations/knowledge/dual-evaluation-and-pixel-market.md", "utf8")), norm(DUAL_EVAL_AND_PIXEL_MARKET_MD))
  })
  it("pixel-economy", async () => {
    const fs = await import("node:fs")
    const { PIXEL_ECONOMY_MD } = await import("./loadKnowledge")
    assert.equal(norm(fs.readFileSync("lib/agent-recommendations/knowledge/pixel-economy.md", "utf8")), norm(PIXEL_ECONOMY_MD))
  })
})

describe("Ask: painting, Level, Canvas and Arena stay inside the official facts (audit 2026-10-05)", () => {
  const prompt = composeZuloPrompt(generalContext(), "Does painting my Normie cost #PIXEL, and what does Level do?")

  it("painting never spends #PIXEL, and never changes Level (live Ask said each flip costs 1 #PIXEL)", () => {
    assert.match(prompt, /Painting does NOT spend or use up #PIXEL/)
    assert.match(prompt, /Never say each pixel flip costs #PIXEL/)
    assert.match(prompt, /painting never spends it/)
  })
  it("bigger and blank canvas belong to the Pixel Market, and readiness numbers are labelled as Zulo's own heuristics", () => {
    assert.match(prompt, /Bigger canvas and blank canvas/)
    assert.match(prompt, /not available until the market opens/)
    assert.match(prompt, /Zulo's own planning heuristics, NOT official requirements/)
  })
  it("Level formula is stated, with the two official sources that differ on withdrawing #PIXEL", () => {
    assert.match(prompt, /Level = floor\(AP \/ 10\) \+ 1/)
    assert.match(prompt, /September 23 article said withdrawing #PIXEL strips a level/)
  })
  it("Arena: only what is official; the combat rules are not published", () => {
    assert.match(prompt, /combat rules are NOT published/)
    assert.match(prompt, /never say how stats scale/)
  })
  it("the community tool catalog lists the independent burn advisor with its /burn URL", () => {
    const tool = COMMUNITY_TOOLS.find((t) => t.url === "https://normiescredhub.vercel.app/burn")
    assert.ok(tool, "burn advisor missing from COMMUNITY_TOOLS")
    assert.match(tool!.description, /Independent community tool, not made by the Normies team/)
    assert.match(tool!.description, /read-only/)
  })
})

describe("Ask prompt hygiene: no knowledge block is pasted twice (audit 2026-10-05)", () => {
  // The COLLAB / RAILS block (21,645 chars) and the ERC-6551 block used to be in the system prompt AND pasted again whenever the question
  // matched, adding about 23,000 characters of exact duplicates to every matching question.
  const queries = [
    "Is Pixel Market live?",
    "Tell me about the Stonk collab",
    "How does x402 work for agents?",
    "What is an ERC-6551 token bound account?",
    "What is Arena?",
    "Should I burn my Normie?",
  ]
  it("no block longer than 400 characters appears twice in a composed prompt", () => {
    for (const q of queries) {
      const prompt = composeZuloPrompt(generalContext(), q)
      const blocks = prompt.split(/\n(?==== )/).filter((b) => b.length > 400)
      const seen = new Map<string, number>()
      for (const b of blocks) seen.set(b, (seen.get(b) ?? 0) + 1)
      const dupes = [...seen].filter(([, n]) => n > 1).map(([b]) => b.split("\n")[0])
      assert.deepEqual(dupes, [], `duplicate block(s) for: ${q}`)
    }
  })
  it("a collab question still gets the full doctrine exactly once", () => {
    const prompt = composeZuloPrompt(generalContext(), "Tell me about the Stonk collab")
    const marker = "Always-on Ask doctrine."
    assert.equal(prompt.split(marker).length - 1, 1)
  })
})

describe("Ask follows the same Pixel Market switch as /burn (PIXEL_MARKET)", () => {
  const withMarket = (value: string | undefined, run: () => void) => {
    const before = process.env.PIXEL_MARKET
    if (value === undefined) delete process.env.PIXEL_MARKET
    else process.env.PIXEL_MARKET = value
    try { run() } finally { if (before === undefined) delete process.env.PIXEL_MARKET; else process.env.PIXEL_MARKET = before }
  }
  it("by default (unset): never says it is open, whatever the clock says", () => {
    withMarket(undefined, () => {
      const p = composeZuloPrompt(generalContext(), "Is Pixel Market live?")
      assert.match(p, /LIVE STATUS: PIXEL MARKET \(overrides any older wording below\)/)
      assert.match(p, /8 PM CET \/ 2 PM EST \(18:00 UTC\) on Monday, October 5, 2026/)
      assert.match(p, /has NOT been told it is open/)
      assert.doesNotMatch(p, /The Pixel Market is OPEN/)
    })
  })
  it("PIXEL_MARKET=live: open, but Ask still has no live prices and points to the official page and /burn", () => {
    withMarket("live", () => {
      const p = composeZuloPrompt(generalContext(), "Is Pixel Market live?")
      assert.match(p, /The Pixel Market is OPEN \(confirmed by the site owner\)/)
      assert.match(p, /You have NO live market data: never quote #PIXEL prices/)
      assert.match(p, /https:\/\/normiescredhub\.vercel\.app\/burn/)
      assert.match(p, /overrides any older "not open yet", "Coming Soon" or "not tradable" wording/)
      assert.doesNotMatch(p, /has NOT been told it is open/)
    })
  })
  it("a typo does not open the market (strict, like /burn)", () => {
    withMarket("Live!", () => {
      assert.match(composeZuloPrompt(generalContext(), "x"), /has NOT been told it is open/)
    })
  })
})


describe("the launch clock only changes WORDING, never opens the market (@serc1n: 8 PM CET / 2 PM EST = 18:00 UTC, 2026-10-05)", () => {
  const before = new Date("2026-10-05T17:59:59Z")
  const after = new Date("2026-10-05T18:00:00Z")

  it("before 18:00 UTC: scheduled for today, never open", () => {
    const b = buildMarketStatusBlock("pending", before)
    assert.match(b, /is scheduled to launch at 8 PM CET \/ 2 PM EST \(18:00 UTC\)/)
    assert.match(b, /Never say it is open or live/)
    assert.doesNotMatch(b, /OPEN \(confirmed/)
  })
  it("from 18:00 UTC with the switch unset: the scheduled time has passed, check the official page, neither open nor delayed", () => {
    const b = buildMarketStatusBlock("pending", after)
    assert.match(b, /was SCHEDULED to launch/)
    assert.match(b, /the scheduled launch time has passed; check @normiesART or the official Pixel Market page/)
    assert.match(b, /Never claim it is open, and never claim it is delayed/)
    assert.doesNotMatch(b, /OPEN \(confirmed/)
  })
  it("only the switch says open, at any time", () => {
    for (const t of [before, after]) assert.match(buildMarketStatusBlock("live", t), /The Pixel Market is OPEN \(confirmed by the site owner\)/)
  })
  it("carries the official facts from Serc's post: #PIXEL tradable, no separate coin, HIVE and Arena next month, moved links", () => {
    for (const state of ["pending", "live"] as const) {
      const b = buildMarketStatusBlock(state, before)
      assert.match(b, /#PIXEL is the new name for Action Points/)
      assert.match(b, /free to trade on the Pixel Market/)
      assert.match(b, /There is NO separate coin/)
      assert.match(b, /Next month \(official\): NormiesHIVE \(agentic swarm\) and Arena/)
      assert.match(b, /Arena rules are still not published/)
      assert.match(b, /normies\.art deep links in older notes may have moved/)
    }
  })
  it("the announcement holds no numbers that go stale (volumes, burn counts, agent counts)", () => {
    const b = buildMarketStatusBlock("pending", before)
    assert.doesNotMatch(b, /3200|2957|1884|\$6\.6M|\$2\.5M/)
  })
  it("launchTimePassed is exact at the boundary", () => {
    assert.equal(launchTimePassed(new Date("2026-10-05T17:59:59.999Z")), false)
    assert.equal(launchTimePassed(new Date("2026-10-05T18:00:00.000Z")), true)
  })
})
