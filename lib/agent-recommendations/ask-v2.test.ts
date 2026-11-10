// Ask v2 (2026-11-10): answer first, real numbers, only the doctrine the question needs, Pulse only when trust matters.
import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { computeCollectionMath } from "./collectionMath"
import { compactContextJson, composeZuloMessages, routePrompt } from "./composePrompt"
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
    assert.deepEqual(routePrompt(COLLECTION_Q), { collab: false, agentProtocols: false })
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
