// Market-or-burn compare moved under /burn (Ryan, 2026-11-10). AGENTS.md fences buy-vs-burn views to /burn, so the /pixels
// Buy tab is gone, the API lives at /api/burn/ap-check, and the old /api/ap-check?calc= keeps answering (pinned ERC-8257
// manifest; Ryan chose option B) with the same labels plus movedTo.
import assert from "node:assert/strict"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"

import { burnPicks, planForBudget, planForPixels, type BurnCandidate } from "./buy-smart"
import { COMPARE_API_NOTES, COMPARE_API_PATH, movedCompareFields, movedCompareUrl } from "./compare-api"
import { COMPARE_FINE_PRINT, compareLines, parseCalcAmount } from "./compare-text"

const ROOT = join(__dirname, "..", "..")
const read = (f: string) => readFileSync(join(ROOT, f), "utf8")

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(join(ROOT, dir))) {
    const p = join(dir, name)
    if (statSync(join(ROOT, p)).isDirectory()) walk(p, out)
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p)
  }
  return out
}

describe("the compare is reachable only under /burn", () => {
  it("/pixels has no Buy tab, no calc form and no compare; ?calc= redirects to /burn#compare", () => {
    const page = read("app/pixels/page.tsx")
    assert.doesNotMatch(page, /id: "buy"/)
    assert.doesNotMatch(page, /name="calc"/)
    assert.doesNotMatch(page, /planForPixels|planForBudget|CalcResult/)
    assert.match(page, /redirect\(`\/burn\?\$\{q\.toString\(\)\}#compare`\)/)
    assert.match(page, /id: "market", label: "Market"/)
  })
  it("in app/, only /burn computes the compare; the APIs go through the one labelled helper", () => {
    const users = walk("app").filter((f) => /planForPixels|planForBudget/.test(read(f)))
    assert.deepEqual(users.sort(), ["app/burn/page.tsx"])
    const helperUsers = walk("app").filter((f) => /compareResponse\(/.test(read(f)))
    // /api/ap-check stays only for the ERC-8257 manifest pinned on chain (Ryan, option B, 2026-11-10).
    assert.deepEqual(helperUsers.sort(), ["app/api/ap-check/route.ts", "app/api/burn/ap-check/route.ts"])
  })
  it("/burn renders the compare with its labels", () => {
    assert.match(read("app/burn/page.tsx"), /<PixelCompare /)
    const ui = read("app/burn/pixel-compare.tsx")
    assert.match(ui, /id="compare"/)
    assert.match(ui, /COMPARE_FINE_PRINT/)
    assert.deepEqual([...COMPARE_FINE_PRINT], [
      "Not financial advice.",
      "Values can go up or down, and no one knows the future.",
      "Don't take our word for it: check the order book and the listings yourself before you do anything.",
    ])
  })
  it("the old /api/ap-check?calc= keeps answering for the pinned manifest: same shared answer, labels, plus movedTo", () => {
    const route = read("app/api/ap-check/route.ts")
    assert.match(route, /compareResponse\(sp, isPost, movedCompareFields\(sp\)\)/)
    assert.doesNotMatch(route, /status: 410/)
    // One implementation for both addresses, so the labels can never differ.
    assert.match(read("app/api/burn/ap-check/route.ts"), /compareResponse\(sp, isPost\)/)
    assert.match(read("lib/ap-check/compare-answer.ts"), /\.\.\.COMPARE_API_NOTES/)
    const sp = new URLSearchParams({ calc: "eth", amount: "0.5", token: "1" })
    assert.equal(movedCompareUrl(sp), "/api/burn/ap-check?calc=eth&amount=0.5")
    const extra = movedCompareFields(sp)
    assert.equal(extra.movedTo, `${COMPARE_API_PATH}?calc=eth&amount=0.5`)
    assert.equal(extra.page, "/burn#compare")
  })
  it("llms.txt and the tool docs point to /api/burn/ap-check, not /api/ap-check?calc=", () => {
    const llms = read("public/llms.txt")
    assert.doesNotMatch(llms, /^GET \/api\/ap-check\?calc=/m)
    // Option B: the old address keeps answering, so no doc may say it is gone.
    for (const [f, text] of [["public/llms.txt", llms], ["README.md", read("README.md")]] as const) {
      const apCheckLines = text.split("\n").filter((l) => /ap-check/.test(l))
      assert.deepEqual(apCheckLines.filter((l) => /\b410\b|\bGone\b/.test(l)), [], `${f} claims ap-check answers 410`)
    }
    assert.match(llms, /old \/api\/ap-check\?calc= .*still answers with the same labelled result, plus movedTo and page/)
    assert.match(llms, /GET \/api\/burn\/ap-check\?calc=pixels/)
    assert.match(read("lib/agent-recommendations/knowledge/agent-tools.md"), /moved to `\/api\/burn\/ap-check`/)
    assert.doesNotMatch(read("lib/erc8257/our-tools.ts"), /buy pixels vs burn floor Normies/)
  })
  it("the API answer always ships the not-financial-advice notes", () => {
    assert.equal(COMPARE_API_NOTES.notFinancialAdvice, true)
    assert.ok(COMPARE_API_NOTES.notes.includes("Not financial advice."))
    assert.match(COMPARE_API_NOTES.framing, /not a recommendation/)
  })
})

describe("neutral wording: two routes, two costs, an as-of time", () => {
  const c = (tokenId: number, priceEth: number, originalPixels: number, livePixels = 0): BurnCandidate => ({ tokenId, priceEth, originalPixels, livePixels })
  const picks = burnPicks([c(1, 0.3, 1000, 50), c(2, 0.4, 1000, 100)], "normal")
  const book = [{ priceEth: 0.001, remaining: 100, partialRemaining: 100 }, { priceEth: 0.002, remaining: 1000, partialRemaining: 1000 }]
  const verdicts = /cheaper|better|wins|winner|should|recommend|best|smart/i

  for (const [label, a] of [
    ["pixels", planForPixels(picks, book, 150)],
    ["eth", planForBudget(picks, book, 0.5)],
    ["no book", planForPixels(picks, null, 150)],
    ["no listings", planForBudget([], book, 0.5)],
  ] as const) {
    it(label, () => {
      const l = compareLines(a, "2026-11-10T03:04:05.000Z")
      assert.match(l.burning, /^Burning route: /)
      assert.match(l.market, /^Pixel Market route: /)
      assert.equal(l.asOf.slice(0, 26), "As of 2026-11-10 03:04 UTC")
      for (const s of Object.values(l)) assert.doesNotMatch(s, verdicts)
    })
  }
  it("the compare UI has no verdict headline either", () => {
    assert.doesNotMatch(read("app/burn/pixel-compare.tsx"), /is cheaper|is better|you should|Burning wins|Buy on the market/i)
  })
  it("amount parsing", () => {
    assert.equal(parseCalcAmount("1,000 pixels", "pixels"), 1000)
    assert.equal(parseCalcAmount("0.5 eth", "eth"), 0.5)
    assert.equal(parseCalcAmount("1.5", "pixels"), null)
    assert.equal(parseCalcAmount("-1", "eth"), null)
    assert.equal(parseCalcAmount("", "eth"), null)
  })
})
