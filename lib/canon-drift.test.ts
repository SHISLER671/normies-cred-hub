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
    ["the top Arena Canvas rank called Legendary Canvas", /Legendary Canvas rank|rank:\s*"?Legendary Canvas|name:\s*"Legendary Canvas"/i],
    ["Arena seats described as first come, first served or FIFO", /\bFIFO\b|first[\s-]*come[\s,]*first[\s-]*served|not a random draw|next in line|first 200 in line/i],
    ["fallen Normies said to rest 8 hours", /rests? 8 hours|8-hour rest|walks in at dawn/i],
    // 2026-11-16 (official FAQ): refills go to Normies that have not walked in yet; not every opted-in Normie is promised a seat.
    ["a fallen Normie's seat said to be refilled by a random draw", /another is drawn at random/i],
    ["every opted-in Normie promised a game", /so every Normie opted in plays|every opted-in Normie plays/i],
  ]
  for (const [what, re] of banned) {
    it(what, () => assert.deepEqual(offenders(re), []))
  }
})

// AGENTS.md "Numbers yes, advice never" (2026-11-18): official money figures may be shown, but nothing may nudge anyone
// to pay, enter or top up, or do returns math. These bans target nudging phrases, never bare words: the rule's own
// sentence and the official Arena state text must pass.
export const MONEY_NUDGES: Array<[string, RegExp]> = [
  ["a nudge to top up", /\btop(?:ping)?[ -]?up now\b|\btop up (?:today|to (?:play|win|stay in))\b/i],
  ["a nudge to enter", /\benter now\b|\benter to win\b|\benter (?:today|before it'?s too late)\b|\bworth entering\b/i],
  ["a nudge to burn in order to play", /\bburn to play\b|\bburn (?:now )?to (?:enter|win)\b/i],
  ["play-to-earn wording", /\bplay[ -]to[ -]earn\b/i],
  ["per-week returns math", /\b(?:earn(?:s|ed|ing)?|make(?:s)?|return(?:s)?|profit(?:s)?|yield(?:s)?)\b[^.\n]{0,40}\bper week\b|\bearned per week\b/i],
]
/** Returns-math terms, banned on the public agent docs and the Arena surfaces (Ask's doctrine names them only to forbid them). */
const RETURNS_MATH: Array<[string, RegExp]> = [
  ["expected value", /\bexpected value\b/i],
  ["ROI", /\bROI\b|return on investment/i],
]

describe("money: numbers yes, advice never (AGENTS.md, 2026-11-18)", () => {
  for (const [what, re] of MONEY_NUDGES) {
    it(`no ${what} anywhere`, () => assert.deepEqual(offenders(re), []))
  }
  const arenaSurfaces = corpus.filter(({ f }) => ["public/llms.txt", "AGENTS.md"].includes(f) || /^(app\/arena\/|app\/api\/arena-|app\/record\/|lib\/arena-|lib\/record-card\/|components\/arena-)/.test(f))
  it("is scanning the public docs and the Arena surfaces", () => assert.ok(arenaSurfaces.length >= 15))
  for (const [what, re] of RETURNS_MATH) {
    it(`no ${what} in the public docs or on any Arena surface`, () => assert.deepEqual(arenaSurfaces.filter(({ text }) => re.test(text)).map(({ f }) => f), []))
  }
  it("the bans pass on AGENTS.md's own rule sentence and on the official Arena state text", () => {
    const rule = "Never give financial advice, predict an outcome, show a projected per-Normie prize, do returns math, or nudge anyone to pay, enter or top up."
    const agents = corpus.find(({ f }) => f === "AGENTS.md")?.text ?? ""
    assert.ok(agents.includes(rule), "the rule sentence is in AGENTS.md as quoted here")
    const states = ["Active: plays every free round, and paid rounds while topped up", "Short: sat out a paid round; plays free rounds until topped up"]
    const arena = corpus.find(({ f }) => f === "lib/record-card/arena.ts")?.text ?? ""
    for (const s of states) assert.ok(arena.includes(s), s)
    for (const text of [rule, ...states]) {
      for (const [what, re] of [...MONEY_NUDGES, ...RETURNS_MATH]) assert.doesNotMatch(text, re, `${what} on: ${text}`)
    }
  })
  it("the bans do catch real nudges", () => {
    const nudges = ["Top up now to stay in.", "Enter now!", "Enter to win the pool", "Burn to play this week", "It's worth entering at this fee", "Play-to-earn with your Normie", "You could earn 40 #PIXEL per week", "Top up to play the paid round"]
    for (const n of nudges) assert.ok(MONEY_NUDGES.some(([, re]) => re.test(n)), n)
    assert.ok(RETURNS_MATH.some(([, re]) => re.test("The expected value of entering is positive")))
    assert.ok(RETURNS_MATH.some(([, re]) => re.test("ROI: 12%")))
  })
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
    assert.deepEqual(tierLabels(), ["every pixel count"])
    assert.deepEqual([launchTier(0).minPct, launchTier(0).maxPct, launchTier(1600).minPct], [2, 4, 2])
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

  it("Arena Canvas ranks match the official entry-page bands, and use the same Level as everything else", () => {
    assert.deepEqual(
      ARENA_CANVAS_RANKS.map((r) => `${r.name}@${r.fromLevel}`),
      ["Blank@1", "Sketched@2", "Inked@10", "Painted@25", "Gilded@50", "Masterwork@100", "Level 150+ (top Arena rank)@150"],
    )
    assert.equal(rankForLevel(levelFor(1_507))?.fromLevel, 150) // #1: 1,507 pixels, Level 151
    assert.equal(rankForLevel(levelFor(12))?.name, "Sketched") // #7141: 12 pixels, Level 2
  })

  it("no user-facing text still states the old tiered burn yield as today's rule (Normies new standard, Nov 2026: flat 2–4%)", () => {
    // The old table was under 490 px 1–4%, 490–889 px 2–4%, 890+ px 3–4%. Code comments may record it as history; copy may not.
    const oldRolls = /\b(1\s*(–|-|to)\s*4\s*%|3\s*(–|-|to)\s*4\s*%)/
    const userFacing = corpus.filter(({ f }) => /\.(md|txt|tsx)$/.test(f) || f.startsWith("lib/agent-recommendations/") || f === "lib/burn-buy/service.ts" || f === "lib/burn-buy/narrate.ts")
    const offending = userFacing.filter(({ text }) => oldRolls.test(text)).map(({ f }) => f)
    assert.deepEqual(offending, [])
  })
})
