// Drift guard for lib/official-status.ts. If this fails, a copy of an official status (Pixel Market, Arena, Zombies) disagrees
// with the one source of truth. Fix the copy (import from lib/official-status), do not loosen the test.
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { describe, it } from "node:test"

import { buildOperatorTandemPromptBlock } from "./agent-recommendations/operatorTandem"
import { buildSelfAwarenessPromptBlock } from "./agent-recommendations/selfAwareness"
import { buildNormiesWisdomPrompt, NORMIES_KNOWLEDGE } from "./agent-recommendations/normiesKnowledge"
import { PIXEL_CURRENCY_MD } from "./knowledge/pixel-currency"
import {
  AGENTS_CANVAS_STATUS_LINE,
  ARENA_STATUS_LINE,
  OFFICIAL_STATUS,
  PIXEL_MARKET_STATUS_LINE,
  SURFACE_TAGS,
  ZOMBIES_STATUS_LINE,
} from "./official-status"

const IMPORTERS = [
  "lib/agent-recommendations/operatorTandem.ts",
  "lib/agent-recommendations/selfAwareness.ts",
  "lib/agent-recommendations/normiesKnowledge.ts",
  "lib/agent-recommendations/generate.ts",
  "lib/knowledge/pixel-currency.ts",
  "app/page.tsx",
]

const walk = (dir: string, out: string[] = []): string[] => {
  if (!fs.existsSync(dir)) return out
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".next", ".git"].includes(e.name)) continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (/\.(ts|tsx|md|txt|json)$/.test(e.name) && !/\.test\./.test(e.name)) out.push(p)
  }
  return out
}

/** Phrases that contradict the official status. Each is a regression we have shipped before. */
const CONTRADICTIONS: Array<{ re: RegExp; why: string }> = [
  { re: /Pixel Market\s*(?:=|:|is|stays)\s*\**\s*(?:Coming Soon|not live|planned)/i, why: "Pixel Market is LIVE" },
  { re: /PIXEL MARKET[^\n]{0,40}\bnot live\b/i, why: "Pixel Market is LIVE" },
  { re: /PIXEL MARKET[^\n]{0,10}\(announced \/ (?:technical )?WIP/i, why: "Pixel Market is LIVE" },
  { re: /\bArena\s*(?:=|:|is)\s*\**\s*(?:LIVE|open now|playable)\b/i, why: "Arena is Coming Soon" },
  { re: /\bAgents Canvas\s*(?:=|:|is)\s*\**\s*(?:LIVE|open now)\b/i, why: "Agents Canvas is announced, not live" },
  { re: /Zombies[^\n]{0,20}\b(?!21\/21)\d{1,2}\/21\b/i, why: "Zombies are 21/21 sealed" },
  { re: /\bspent\b[^\n]{0,30}\bper pixel\b|\bpainting (?:spends|costs|uses up)\b/i, why: "Painting never spends PIXEL / action points" },
]

describe("official status: one source of truth", () => {
  it("states the confirmed 2026-10-18 statuses", () => {
    assert.equal(OFFICIAL_STATUS.pixelMarket.status, "LIVE")
    assert.equal(OFFICIAL_STATUS.pixelMarket.since, "2026-10-05")
    assert.equal(OFFICIAL_STATUS.arena.status, "COMING_SOON")
    assert.equal(OFFICIAL_STATUS.zombies.claimed, 21)
    assert.equal(OFFICIAL_STATUS.zombies.total, 21)
    assert.deepEqual(SURFACE_TAGS, { pixelMarket: "LIVE", arena: "COMING SOON", zombies: "ALL CLAIMED" })
    assert.equal(OFFICIAL_STATUS.agentsCanvas.status, "ANNOUNCED")
    assert.match(AGENTS_CANVAS_STATUS_LINE, /not live/)
  })

  it("every file that states these statuses imports the status module", () => {
    for (const f of IMPORTERS) {
      assert.match(fs.readFileSync(f, "utf8"), /from "@\/lib\/official-status"/, f)
    }
  })

  it("operator tandem and self-awareness carry the canonical lines verbatim", () => {
    for (const block of [buildOperatorTandemPromptBlock(), buildSelfAwarenessPromptBlock()]) {
      assert.ok(block.includes(PIXEL_MARKET_STATUS_LINE), "pixel market line")
      assert.ok(block.includes(ARENA_STATUS_LINE), "arena line")
      assert.ok(block.includes(ZOMBIES_STATUS_LINE), "zombies line")
      assert.ok(block.includes(AGENTS_CANVAS_STATUS_LINE), "agents canvas line")
    }
  })

  it("normies knowledge carries the canonical lines", () => {
    const w = buildNormiesWisdomPrompt()
    assert.ok(w.includes(PIXEL_MARKET_STATUS_LINE))
    assert.ok(w.includes(ARENA_STATUS_LINE))
    assert.ok(w.includes(AGENTS_CANVAS_STATUS_LINE))
    assert.ok(NORMIES_KNOWLEDGE.future.arena.status.startsWith(ARENA_STATUS_LINE))
    assert.match(NORMIES_KNOWLEDGE.future.pixelMarket.status, new RegExp(`^Live since ${OFFICIAL_STATUS.pixelMarket.since}`))
  })

  it("the pixel-currency .ts bundle and its .md authoring copy both say the market is live", () => {
    assert.ok(PIXEL_CURRENCY_MD.includes(PIXEL_MARKET_STATUS_LINE))
    assert.ok(fs.readFileSync("lib/knowledge/pixel-currency.md", "utf8").includes(PIXEL_MARKET_STATUS_LINE))
  })

  it("the homepage reads its surface tags from the module (no hard-coded copy)", () => {
    const src = fs.readFileSync("app/page.tsx", "utf8")
    assert.match(src, /name: "Pixel Market", status: SURFACE_TAGS\.pixelMarket/)
    assert.match(src, /name: "Arena", status: SURFACE_TAGS\.arena/)
    assert.match(src, /name: "Zombies", status: SURFACE_TAGS\.zombies/)
  })

  it("no file in lib, app, components or public contradicts the official status", () => {
    const files = [...walk("lib"), ...walk("app"), ...walk("components"), ...walk("public"), "README.md"]
    const hits: string[] = []
    for (const f of files) {
      const lines = fs.readFileSync(f, "utf8").split("\n")
      lines.forEach((line, i) => {
        for (const c of CONTRADICTIONS) if (c.re.test(line)) hits.push(`${f}:${i + 1} (${c.why}): ${line.trim().slice(0, 140)}`)
      })
    }
    assert.deepEqual(hits, [])
  })
})
