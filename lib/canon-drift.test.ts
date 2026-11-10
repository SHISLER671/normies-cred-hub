// Canon drift guard (2026-11-10). The same Normies facts live in pages, Ask knowledge, tools and docs. This test fails when
// a copy disagrees with lib/normies-canon.ts / lib/burn-buy/score.ts, or when a known-wrong variant comes back.
import assert from "node:assert/strict"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"

import { apTierForPixelCount, estimateBurnApFromPixels, levelFromActionPoints } from "./agent-recommendations/normiesKnowledge"
import { launchTier, launchedBurnYield } from "./burn-buy/score"
import { ARENA_CANVAS_RANKS, BLANK_CANVAS_COST, CANVAS_SIZE_COSTS, canvasUpgradeCost, levelFor, rankForLevel, tierLabels } from "./normies-canon"

const ROOT = join(__dirname, "..")
const SCAN_DIRS = ["app", "components", "lib", "docs/zulo"]
const SCAN_FILES = ["public/llms.txt", "AGENTS.md"]

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (name === "node_modules" || name === "archive" || name.startsWith(".")) continue
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(ts|tsx|md|txt)$/.test(name) && !/\.test\.ts$/.test(name)) out.push(p)
  }
  return out
}

const files = [...SCAN_DIRS.flatMap((d) => walk(join(ROOT, d))), ...SCAN_FILES.map((f) => join(ROOT, f))]
const corpus = files.map((f) => ({ f: f.slice(ROOT.length + 1), text: readFileSync(f, "utf8") }))

function offenders(re: RegExp): string[] {
  return corpus.filter(({ text }) => re.test(text)).map(({ f }) => f)
}

describe("known-wrong variants never come back", () => {
  const banned: Array<[string, RegExp]> = [
    // Contract: tier i applies when pixels < threshold, so 490 is in the middle tier and 890 in the top tier.
    ["off-by-one burn tiers (491–890 / 891+)", /\b491\s*(–|-|to)\s*890\b|\b891\s*(\+|px and up)|\b0\s*(–|-|to)\s*490\b/],
    ["Level called permanent (docs: taking pixels off lowers it)", /permanent trait/i],
    ["bigger canvas described as a future era (it is live)", /80×80 (expansion )?era|80x80 (expansion )?era|80×80 rails/i],
    ["#PIXEL said to come only from burns (the Pixel Market sells it too)", /Earn only by burning/],
    ["a wallet linked to an X profile", /ethos\.network\/profile\/x\//],
    ["Arena combat rules stated (they are not published)", /(?<!how )stats scale with Level/i],
    // 2026-11-10 (readiness → official costs): a canvas is priced, never scored or called ready.
    ["a canvas called expansion-ready", /expansion[-_ ]ready/i],
    ["a readiness score", /readiness score/i],
    ["an 80×80 readiness label", /80(×|x)80 readiness/i],
    ["a 200 AP target (the next size costs 900 from 40×40)", /\b200 AP\b/],
    ["a hint that more burns should fund a canvas", /more burns fund/i],
    ["a 'best efficiency band'", /best efficiency band/i],
    // Trait and fair-value verdicts (AGENTS.md: no price talk, no burn/keep verdicts outside /burn).
    ["narrative value", /narrative value/i],
    ["premium over floor", /premium over floor/i],
    ["a DO NOT BURN verdict", /DO NOT BURN/],
    ["a 'lean hold' nudge", /lean hold/i],
    ["burn fodder into a Normie", /burn fodder into/i],
    // 2026-11-10 (Arena Canvas rank): the top band has a neutral label, so it is never confused with the NormiesLegendaryCanvas award.
    ["the top Arena Canvas rank called Legendary Canvas", /Legendary Canvas rank|rank:? "?Legendary Canvas|"Legendary Canvas"/i],
  ]
  for (const [what, re] of banned) {
    it(what, () => assert.deepEqual(offenders(re), []))
  }
})

describe("Ask's prompt text: no EV, arbitrage or value estimates (2026-11-10)", () => {
  const askText = corpus.filter(
    ({ f }) =>
      f.startsWith("lib/agent-recommendations/knowledge/") ||
      ["lib/agent-recommendations/zulo-persona.md", "lib/agent-recommendations/loadKnowledge.ts", "lib/agent-recommendations/composePrompt.ts", "lib/agent-recommendations/skillsCatalog.ts"].includes(f),
  )
  it("is scanning the Ask files", () => assert.ok(askText.length >= 6))
  it('no "+EV" (only the rule that forbids calling a pull "+EV")', () => {
    const bad = askText.filter(({ text }) => /\+EV/.test(text.replace(/Never call a pull or raffle "\+EV"/g, "")))
    assert.deepEqual(bad.map(({ f }) => f), [])
  })
  it("no arbitrage framing (Gacha EV / Monitor arbitrage / +EV gaps)", () => {
    assert.deepEqual(askText.filter(({ text }) => /arbitrage|Gacha EV|EV gaps/i.test(text)).map(({ f }) => f), [])
  })
  it("fairValue, typeFloor and impliedApCostETH never reach Ask's context", () => {
    const types = readFileSync(join(ROOT, "lib/agent-recommendations/types.ts"), "utf8")
    assert.doesNotMatch(types, /fairValue|typeFloor|impliedApCostETH/)
    const ctx = readFileSync(join(ROOT, "lib/agent-recommendations/buildContext.ts"), "utf8")
    // Read from the rarity API (typed), but never put on the context object.
    assert.doesNotMatch(ctx, /\b(fairValue|typeFloor)\s*:/)
    assert.match(ctx, /impliedApCostETH: _iac, \.\.\.rest/)
  })
})

describe("the copies agree with the canon", () => {
  it("both burn-tier implementations match the contract table for every pixel count", () => {
    for (let px = 0; px <= 1600; px++) {
      const a = apTierForPixelCount(px)
      const b = launchTier(px)
      assert.equal(a.minPct, b.minPct, `min% at ${px}`)
      assert.equal(a.maxPct, b.maxPct, `max% at ${px}`)
      const est = estimateBurnApFromPixels(px)
      const y = launchedBurnYield(px, 0).range!
      assert.deepEqual([est.minAp, est.maxAp], [y.min, y.max], `yield range at ${px}`)
    }
    assert.deepEqual(tierLabels(), ["under 490", "490–889", "890+"])
  })

  it("Level is one formula everywhere: floor(pixels on it / 10) + 1", () => {
    for (const n of [0, 9, 10, 11, 99, 100, 4800]) assert.equal(levelFor(n), levelFromActionPoints(n))
    assert.equal(levelFor(12), 2)
  })

  it("bigger and blank canvas prices match what Ask and the docs say", () => {
    const totals = CANVAS_SIZE_COSTS.map((c) => c.total.toLocaleString("en-US"))
    const list = `${totals.slice(0, -1).join(", ")} or ${totals.at(-1)}`
    const knowledge = corpus.filter(({ f }) => f.startsWith("lib/agent-recommendations/knowledge/"))
    assert.ok(knowledge.some(({ text }) => text.includes(list)), `knowledge should state "${list}"`)
    assert.ok(knowledge.some(({ text }) => text.includes(`${BLANK_CANVAS_COST} pixels`)))
    assert.equal(canvasUpgradeCost(40, 80), 4_800)
    assert.equal(canvasUpgradeCost(50, 70), 2_400)
    assert.equal(canvasUpgradeCost(80, 50), null)
  })

  it("Arena Canvas ranks match normiesART's Arena article (Oct 23, 2026), and use the same Level as everything else", () => {
    assert.deepEqual(
      ARENA_CANVAS_RANKS.map((r) => `${r.name}@${r.fromLevel}`),
      ["Blank@1", "Sketched@2", "Inked@10", "Painted@25", "Gilded@50", "Masterwork@100", "Level 150+ (top Arena rank)@150"],
    )
    assert.equal(rankForLevel(levelFor(1_507))?.fromLevel, 150) // #1: 1,507 pixels, Level 151
    assert.equal(rankForLevel(levelFor(12))?.name, "Sketched") // #7141: 12 pixels, Level 2
  })

  it("every stated tier set in user-facing text uses the contract boundaries", () => {
    // Any "under 490" mention must sit with "490–889"/"490 to 889" and "890+"/"890 px and up" in the same file.
    const stated = corpus.filter(({ text }) => /under 490/.test(text))
    for (const { f, text } of stated) {
      assert.match(text, /490\s*(–|-|to)\s*889/, `${f}: middle tier`)
      assert.match(text, /890\s*(\+|px and up|and up)/, `${f}: top tier`)
    }
  })
})
