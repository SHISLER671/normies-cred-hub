// Ask v2 (2026-11-10): answer first, real numbers, only the doctrine the question needs, Pulse only when trust matters.
import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { computeCollectionMath } from "./collectionMath"
import { compactContextJson, composeZuloMessages, queryNeedsArenaFacts, routePrompt } from "./composePrompt"
import { isPlaceholderText, postProcessZuloOutput } from "./postProcess"
import { ensurePulseFirst, isPulseRelevant } from "./pulseFirst"
import type { ZuloRecommendationContext } from "./types"

const WALLET = "0xfafd8fb6b4e43ace0e365553f1b9242384591031"

function ctx(over: Partial<NonNullable<ZuloRecommendationContext["platformContext"]>> = {}): ZuloRecommendationContext {
  return {
    user: { walletAddress: WALLET },
    normie: { id: 7141, name: "Zulo", traits: {}, agent: { id: 32626, name: "Zulo", status: "awakened" } },
    session: { history: [], currentGoal: "general" },
    platformContext: {
      currentTime: "2026-11-10T00:00:00.000Z",
      subjectScope: {
        mode: "active_normie",
        walletConnected: true,
        activeNormieId: 7141,
        mentionedTokenIds: [],
        normieIsSpeakerIdentityOnly: false,
        userOwnsFocus: true,
      },
      pulse: {
        tokenId: 7141, agentId: 32626, pulseLevel: 4, maxLevel: 5, status: "Strong",
        breakdown: ["ERC-8004 registered", "Clean ownership & delegation"], gaps: [], nextSignal: null, note: "",
      },
      mentionedNormies: [],
      ...over,
    },
  }
}

const COLLECTION_Q = "Has anyone tried to figure out the possible amount of #pixel that is possible if every Normie was burnt?"

describe("prompt shape", () => {
  it("system message opens with the answer contract, the user message ends with the question", () => {
    const { system, user } = composeZuloMessages(ctx(), COLLECTION_Q, "live")
    assert.ok(system.indexOf("HOW TO ANSWER") < system.indexOf("PIXEL ECONOMY KNOWLEDGE"))
    assert.match(system, /"answer":/)
    assert.match(system, /"followUps":/)
    assert.doesNotMatch(system, /"understanding":/)
    assert.match(user, /=== QUESTION ===\n.*every Normie was burnt\?/)
  })

  it("loads the big collab and agent-protocol doctrine only when the question needs it", () => {
    assert.deepEqual(routePrompt(COLLECTION_Q), { collab: false, agentProtocols: false, arena: false })
    assert.equal(routePrompt("What's the Stonk collab?").collab, true)
    assert.equal(routePrompt("what tools should agents call?").agentProtocols, true)
    const plain = composeZuloMessages(ctx(), COLLECTION_Q, "live").system
    const collab = composeZuloMessages(ctx(), "What's the Stonk collab?", "live").system
    assert.ok(plain.length + 15_000 < collab.length, `plain ${plain.length} vs collab ${collab.length}`)
    assert.doesNotMatch(plain, /NORMIES AGENT TOOLS/)
  })

  it("a plain question's whole prompt stays well under the old ~100k characters", () => {
    const { system, user } = composeZuloMessages(ctx(), COLLECTION_Q, "live")
    assert.ok(system.length + user.length < 75_000, String(system.length + user.length))
  })

  it("puts computed collection math in front of the model when loaded", () => {
    const cm = computeCollectionMath(
      { originalPixels: new Map([[1, 400], [2, 1000]]), oldestIndexedAt: "2026-11-10T00:00:00.000Z" },
      "normal",
      "test index",
    )
    const { user } = composeZuloMessages(ctx({ collectionMath: cm }), COLLECTION_Q, "live")
    assert.match(user, /=== COLLECTION MATH/)
    assert.match(user, /If EVERY living Normie were burned: 34 \(all lowest rolls\) to 56 \(all 4% rolls\)/)
  })

  it("skips empty sections instead of printing 'not loaded' filler", () => {
    const { user } = composeZuloMessages(ctx(), COLLECTION_Q, "live")
    assert.doesNotMatch(user, /GACHA & RAFFLE/)
    assert.doesNotMatch(user, /Floor snapshot not loaded/)
    assert.doesNotMatch(user, /COLLECTION MATH/)
  })

  it("never hands the model the visitor's full wallet address", () => {
    const { user } = composeZuloMessages(ctx(), COLLECTION_Q, "live")
    assert.ok(!user.toLowerCase().includes(WALLET))
    assert.ok(!compactContextJson(ctx()).toLowerCase().includes(WALLET))
  })

  it("passes the recent conversation so follow-ups make sense", () => {
    const c = ctx()
    c.session.history = [{ userMessage: "how many normies are left?", zuloResponse: "9,412 of 10,000.", timestamp: "t" }]
    const { user } = composeZuloMessages(c, "and if half of those burned?", "live")
    assert.match(user, /Visitor: how many normies are left\?\n  Zulo: 9,412 of 10,000\./)
  })
})

describe("Pulse only when trust is part of the question", () => {
  const reply = { understanding: "", recommendation: "About 280k to 380k.", reasoning: "", nextSteps: [] }

  it("relevance check", () => {
    assert.equal(isPulseRelevant(COLLECTION_Q), false)
    assert.equal(isPulseRelevant("How do I raise my Level?"), false)
    assert.equal(isPulseRelevant("can I trust the agent on #1234?"), true)
    assert.equal(isPulseRelevant("Tell me about Normie #7141"), true)
    assert.equal(isPulseRelevant("should I buy #55"), true)
  })

  it("a collection question with a connected Normie gets no Pulse line (the live complaint)", () => {
    const out = ensurePulseFirst(reply, ctx(), COLLECTION_Q)
    assert.equal(out.pulseLead, undefined)
    assert.equal(out.recommendation, "About 280k to 380k.")
  })

  it("a trust question gets it, without stuffing it into an empty understanding", () => {
    const out = ensurePulseFirst(reply, ctx(), "can I trust my agent?")
    assert.match(out.pulseLead ?? "", /^Pulse 4\/5 \(Strong\)/)
    assert.equal(out.understanding, "")
  })
})

describe("postProcess reads the new answer format", () => {
  it("answer + followUps + sources", () => {
    const out = postProcessZuloOutput(
      JSON.stringify({ answer: "**About 300k #PIXEL.**", followUps: ["What if half burned?", "", 7], sources: ["NCH index"] }),
    )
    assert.equal(out.recommendation, "**About 300k #PIXEL.**")
    assert.deepEqual(out.followUps, ["What if half burned?"])
    assert.deepEqual(out.sources, ["NCH index"])
    assert.equal(out.understanding, "")
    assert.equal(out.confidence, undefined)
  })

  it("recovers a truncated answer", () => {
    const out = postProcessZuloOutput('{"answer": "Roughly 300k #PIXEL if every one burned. The catch')
    assert.match(String(out.recommendation), /^Roughly 300k #PIXEL/)
  })

  it("plain text (no JSON) becomes the answer with no filler around it", () => {
    const out = postProcessZuloOutput("About 300k #PIXEL.")
    assert.equal(out.recommendation, "About 300k #PIXEL.")
    assert.equal(out.understanding, "")
    assert.equal(out.reasoning, "")
  })

  it("old-format replies still parse", () => {
    const out = postProcessZuloOutput(JSON.stringify({ understanding: "u", recommendation: "r", reasoning: "why", nextSteps: ["a"] }))
    assert.equal(out.recommendation, "r")
    assert.equal(out.reasoning, "why")
  })

  it("the UI can tell filler from content", () => {
    assert.equal(isPlaceholderText("I received your request."), true)
    assert.equal(isPlaceholderText(""), true)
    assert.equal(isPlaceholderText("About 300k"), false)
  })
})

describe("GrokBot review of #156", () => {
  it("'should I' questions: key number or trade-off, the choice is the holder's, no yes/no, then /burn", () => {
    const { system, user } = composeZuloMessages(ctx(), "should I buy 1 PIXEL to reach 15?", "live")
    assert.match(system, /Exception, "should I" questions/)
    assert.match(system, /says the choice is the holder's\. Never yes or no\. End with: See \/burn for a vibe check \(not financial advice\)/)
    assert.match(user, /Never give a burn, keep or buy call/)
  })

  it("weak data is said plainly, never a soft hold verdict", () => {
    const { system } = composeZuloMessages(ctx(), "market status", "live")
    assert.doesNotMatch(system, /observe\/hold/)
    assert.match(system, /say plainly that the data is weak/)
  })

  it("MARKET STATE uses the official Pixel Market status and plain words, never 'AP market: planned'", async () => {
    const { PIXEL_MARKET_STATUS_LINE } = await import("../official-status")
    const marketState = {
      asOf: "2026-11-10T00:00:00.000Z", floorETH: 0.01, floorSource: "test", floorChangePct: 1,
      oneDayVolumeETH: 1, sevenDayVolumeETH: 7, volumeVelocityRatio: 1, burnTokensRecent24h: 3, burnTokensPrev24h: 2,
      burnVolumeRatio: 1.5, apMarketStatus: "planned", apMarketPriceETH: null, owners: 100,
    } as unknown as NonNullable<NonNullable<ZuloRecommendationContext["platformContext"]>["marketState"]>
    const { user } = composeZuloMessages(ctx({ marketState }), "market status", "live")
    assert.doesNotMatch(user, /AP market/)
    assert.ok(user.includes(`${PIXEL_MARKET_STATUS_LINE}; #PIXEL quotes: none in this scan`))
  })
})

describe("Arena facts from normiesART's article (Ryan, 2026-11-11)", () => {
  it("arena questions get the ARENA FACTS block; other questions don't", () => {
    assert.match(composeZuloMessages(ctx(), "How strong is a Zombie in Arena?", "live").system, /=== ARENA FACTS/)
    assert.doesNotMatch(composeZuloMessages(ctx(), COLLECTION_Q, "live").system, /=== ARENA FACTS/)
  })
  it("routing is narrow: everyday words alone don't load ARENA FACTS (GrokBot review of #162)", () => {
    for (const q of ["What's the Pixel Market fee?", "How do I raise my Level?", "what type is #55?", "how do I enter a blank canvas?", "is a human behind Zulo?"]) {
      assert.equal(queryNeedsArenaFacts(q), false, q)
    }
    for (const q of ["Is Arena live?", "how do I register my Normie", "how much health does a Cat have", "what's the Masterwork head start", "are zombies strong?"]) {
      assert.equal(queryNeedsArenaFacts(q), true, q)
    }
  })
  it("a named Normie gets its type and head-start line", () => {
    const c = ctx({
      mentionedNormies: [{ tokenId: 1234, fetchOk: true, traits: { Type: "Cat" }, level: 12 }],
      subjectScope: { mode: "mentioned", walletConnected: false, activeNormieId: null, mentionedTokenIds: [1234], normieIsSpeakerIdentityOnly: false, userOwnsFocus: false },
    } as never)
    const { user } = composeZuloMessages(c, "How would #1234 do in Arena?", "live")
    assert.match(user, /- #1234: Cat: 115 health.*Level 12 \(Inked\) head start: \+28% health, sword III, plate I/)
  })
})
