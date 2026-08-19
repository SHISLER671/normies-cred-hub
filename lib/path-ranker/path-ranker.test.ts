import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  parseIntent,
  isIntentTag,
  INTENT_CHIPS,
  accessScore,
  pulseScore,
  relevanceScore,
  scoreCandidate,
  combineScores,
  DEFAULT_SCORE_WEIGHTS,
  helpfulScoreFromCounts,
  candidatesFromSkills,
  type PathCandidate,
  type RankPathsSubject,
} from "./index"
import { tagOverlapScore } from "./intents"
import { candidatesFromNormiesTools } from "./candidates"

describe("intent tags & chips", () => {
  it("exposes closed chip set", () => {
    assert.ok(INTENT_CHIPS.length >= 5)
    assert.ok(INTENT_CHIPS.every((c) => isIntentTag(c.tag)))
  })

  it("parses burn free-text", () => {
    const p = parseIntent({ intent: "scan burns for efficient fodder" })
    assert.ok(p.tags.includes("burn"))
    assert.equal(p.primary, "burn")
  })

  it("parses pulse free-text", () => {
    const p = parseIntent({ intent: "analyze my pulse and trust gaps" })
    assert.ok(p.tags.includes("pulse"))
  })

  it("honors intentTag chip over empty text", () => {
    const p = parseIntent({ intentTag: "canvas" })
    assert.deepEqual(p.tags[0], "canvas")
    assert.equal(p.primary, "canvas")
  })

  it("falls back to strategy when nothing matches", () => {
    const p = parseIntent({ intent: "zzz" })
    assert.ok(p.tags.includes("strategy"))
  })

  it("rejects unknown tags", () => {
    assert.equal(isIntentTag("not-a-tag"), false)
    assert.equal(isIntentTag("burn"), true)
  })
})

describe("tag overlap & scoring pure functions", () => {
  it("prefers primary tag hits", () => {
    const withPrimary = tagOverlapScore(["burn", "market"], ["burn", "strategy"])
    const without = tagOverlapScore(["canvas"], ["burn", "strategy"])
    assert.ok(withPrimary > without)
  })

  it("accessScore orders open > gated", () => {
    assert.ok(accessScore("open") > accessScore("gated"))
    assert.ok(accessScore("granted") > accessScore("unknown"))
  })

  it("weights sum to 1", () => {
    const w = DEFAULT_SCORE_WEIGHTS
    assert.equal(
      Math.round(
        (w.pulse + w.access + w.relevance + w.feedback) * 100,
      ) / 100,
      1,
    )
    assert.ok(w.feedback <= 0.15)
    assert.ok(w.pulse >= w.access)
  })

  it("combineScores applies Pulse-primary weights", () => {
    const s = combineScores({ pulse: 1, access: 0, relevance: 0, feedback: 0 })
    assert.equal(s.total, DEFAULT_SCORE_WEIGHTS.pulse)
  })

  it("helpful paths outrank equal peers via weak feedback", () => {
    const base = { pulse: 0.5, access: 0.5, relevance: 0.5 }
    const up = combineScores({ ...base, feedback: 0.9 })
    const down = combineScores({ ...base, feedback: 0.1 })
    const cold = combineScores({ ...base, feedback: 0.5 })
    assert.ok(up.total > cold.total)
    assert.ok(cold.total > down.total)
    assert.ok(up.total - down.total < 0.12)
  })
})

describe("pulseScore prefers identity when low pulse + gaps", () => {
  const subjectLow: RankPathsSubject = {
    tokenId: 1,
    pulse_level: 1,
    status: "Emerging",
    gaps: ["ERC-8004 registered", "Has active agent card"],
  }

  const identityCandidate: PathCandidate = {
    pathId: "skill:pulse-analysis",
    kind: "zulo-skill",
    title: "PULSE Analysis",
    publisher: { name: "Zulo" },
    tags: ["pulse"],
    keywords: ["pulse"],
    access: { status: "open", note: "free" },
    nextStep: { label: "Read Pulse" },
    pulseAffinity: 50,
    skillId: "pulse-analysis",
  }

  const marketCandidate: PathCandidate = {
    pathId: "skill:market-sentinel",
    kind: "zulo-skill",
    title: "Market",
    publisher: { name: "Zulo" },
    tags: ["market"],
    keywords: ["floor"],
    access: { status: "open", note: "free" },
    nextStep: { label: "Market" },
    pulseAffinity: 15,
    skillId: "market-sentinel",
  }

  it("scores pulse skill higher than market for low-pulse identity gaps", () => {
    const pPulse = pulseScore(identityCandidate, subjectLow, ["pulse", "identity"])
    const pMarket = pulseScore(marketCandidate, subjectLow, ["pulse", "identity"])
    assert.ok(pPulse > pMarket)
  })
})

describe("scoreCandidate burn intent prefers burn skill", () => {
  const subject: RankPathsSubject = {
    tokenId: 7141,
    pulse_level: 4,
    status: "Strong",
    gaps: [],
  }

  it("ranks burn-efficiency above unrelated skill on burn intent", () => {
    const intent = parseIntent({ intentTag: "burn" })
    const burn: PathCandidate = {
      pathId: "skill:burn-efficiency",
      kind: "zulo-skill",
      title: "Burn Efficiency",
      publisher: { name: "Zulo", agentId: 32626 },
      tags: ["burn"],
      keywords: ["scan burns"],
      access: { status: "open", note: "free" },
      nextStep: { label: "Scan" },
      pulseAffinity: 35,
      skillId: "burn-efficiency",
    }
    const canvas: PathCandidate = {
      pathId: "skill:canvas-evolution",
      kind: "zulo-skill",
      title: "Canvas",
      publisher: { name: "Zulo" },
      tags: ["canvas"],
      keywords: ["preview"],
      access: { status: "open", note: "free" },
      nextStep: { label: "Canvas" },
      pulseAffinity: 35,
      skillId: "canvas-evolution",
    }

    const sBurn = scoreCandidate(burn, subject, intent)
    const sCanvas = scoreCandidate(canvas, subject, intent)
    assert.ok(
      sBurn.total > sCanvas.total,
      `expected burn ${sBurn.total} > canvas ${sCanvas.total}`,
    )
    assert.ok(sBurn.relevance > sCanvas.relevance)
  })
})

describe("feedback scoring", () => {
  it("is neutral with no votes", () => {
    assert.equal(helpfulScoreFromCounts(0, 0), 0.5)
  })

  it("rises with ups and falls with downs", () => {
    assert.ok(helpfulScoreFromCounts(5, 0) > 0.5)
    assert.ok(helpfulScoreFromCounts(0, 5) < 0.5)
  })
})

describe("candidates (no network)", () => {
  it("includes Zulo skills and excludes holder-chat", () => {
    const intent = parseIntent({ intentTag: "burn" })
    const skills = candidatesFromSkills(intent, 7141)
    assert.ok(skills.some((c) => c.skillId === "burn-efficiency"))
    assert.ok(skills.some((c) => c.skillId === "pulse-analysis"))
    assert.ok(!skills.some((c) => c.skillId === "holder-chat"))
    assert.ok(skills.every((c) => c.publisher.name === "Zulo"))
  })

  it("makes Zulo skills agent-executable", () => {
    const intent = parseIntent({ intentTag: "pulse" })
    const skills = candidatesFromSkills(intent, 7141)
    const pulse = skills.find((c) => c.skillId === "pulse-analysis")
    assert.ok(pulse)
    assert.equal(pulse!.nextStep.method, "GET")
    assert.equal(pulse!.nextStep.executable, true)
    assert.match(pulse!.nextStep.endpoint ?? "", /\/api\/agent\/7141\/pulse/)
    const burn = skills.find((c) => c.skillId === "burn-efficiency")
    assert.ok(burn)
    assert.equal(burn!.nextStep.method, "POST")
    assert.equal(burn!.nextStep.executable, true)
    assert.match(burn!.nextStep.endpoint ?? "", /\/api\/zulo\/paths/)
  })

  it("returns capped Normies tool candidates", () => {
    const intent = parseIntent({ intentTag: "canvas" })
    const list = candidatesFromNormiesTools(undefined, intent, 8)
    assert.ok(list.length > 0 && list.length <= 8)
    assert.ok(list.some((c) => c.tags.includes("canvas") || c.pathId.includes("canvas")))
  })
})

describe("relevanceScore", () => {
  it("boosts keyword hits in free-text intent", () => {
    const intent = parseIntent({ intent: "I need a burn efficiency scan" })
    const c: PathCandidate = {
      pathId: "skill:burn-efficiency",
      kind: "zulo-skill",
      title: "Burn",
      publisher: { name: "Zulo" },
      tags: ["burn"],
      keywords: ["burn efficiency", "scan burns"],
      access: { status: "open", note: "" },
      nextStep: { label: "Go" },
      pulseAffinity: 20,
      skillId: "burn-efficiency",
    }
    const r = relevanceScore(c, intent)
    assert.ok(r > 0.4)
  })
})
