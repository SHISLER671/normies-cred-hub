// Drift guard for lib/official-status.ts. If this fails, a copy of an official status (Pixel Market, Arena, Zombies) disagrees
// with the one source of truth. Fix the copy (import from lib/official-status), do not loosen the test.
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { describe, it } from "node:test"

import { buildOperatorTandemPromptBlock } from "./agent-recommendations/operatorTandem"
import { buildSelfAwarenessPromptBlock } from "./agent-recommendations/selfAwareness"
import { buildNormiesWisdomPrompt, NORMIES_KNOWLEDGE } from "./agent-recommendations/normiesKnowledge"
import { composeZuloPrompt } from "./agent-recommendations/composePrompt"
import { COLLAB_RAILS_MD, DUAL_EVAL_AND_PIXEL_MARKET_MD } from "./agent-recommendations/loadKnowledge"
import { PIXEL_CURRENCY_MD } from "./knowledge/pixel-currency"
import {
  AGENTS_CANVAS_STATUS_LINE,
  ARENA_REGISTRATION_LINE,
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

describe("Arena Week 1 registration (official @serc1n post, 2026-11-09)", () => {
  const SOURCE = "https://x.com/serc1n/status/2119787233632719147"
  it("states the date and the source, and keeps Arena Coming Soon", () => {
    assert.equal(OFFICIAL_STATUS.arena.registration.week1Opens, "2026-11-14")
    assert.equal(OFFICIAL_STATUS.arena.registration.source, SOURCE)
    assert.ok(ARENA_REGISTRATION_LINE.startsWith("Arena Week 1 registration opens Saturday, November 14, 2026 (per @serc1n, "))
    assert.ok(ARENA_REGISTRATION_LINE.includes(SOURCE))
    assert.ok(ARENA_REGISTRATION_LINE.includes("as of the 2026-11-09 post"))
    assert.match(ARENA_REGISTRATION_LINE, /Registration opening is not Arena being live/)
    assert.match(ARENA_STATUS_LINE, /expected mid-November 2026/)
    assert.equal(OFFICIAL_STATUS.arena.status, "COMING_SOON")
    assert.equal(SURFACE_TAGS.arena, "COMING SOON")
  })
  it("no time, timezone, prize or earnings claim in the line", () => {
    assert.doesNotMatch(ARENA_REGISTRATION_LINE, /\b(UTC|GMT|ChST|PST|EST|[AP]M)\b|\d{1,2}:\d{2}/)
    assert.doesNotMatch(ARENA_REGISTRATION_LINE, /prize|pool|bet|earn|reward|win/i)
  })
  it("every surface that states Arena's status also carries the registration line", () => {
    for (const [name, text] of [
      ["operator tandem", buildOperatorTandemPromptBlock()],
      ["self-awareness", buildSelfAwarenessPromptBlock()],
      ["normies wisdom", buildNormiesWisdomPrompt()],
      ["knowledge future.arena", NORMIES_KNOWLEDGE.future.arena.status],
      ["dual-eval bundle", DUAL_EVAL_AND_PIXEL_MARKET_MD],
      ["collab-rails bundle", COLLAB_RAILS_MD],
    ] as const) {
      assert.ok(text.includes(ARENA_REGISTRATION_LINE), name)
    }
    for (const f of [
      "lib/agent-recommendations/knowledge/dual-evaluation-and-pixel-market.md",
      "lib/agent-recommendations/knowledge/collab-rails-and-ask-patterns.md",
      "docs/zulo/record-card-spec.md",
      "docs/zulo/thesis-lock.md",
      "lib/burn-buy/narrate.ts",
      "lib/agent-recommendations/composePrompt.ts",
    ]) {
      const src = fs.readFileSync(f, "utf8")
      assert.ok(src.includes(ARENA_REGISTRATION_LINE) || src.includes("${ARENA_REGISTRATION_LINE}"), f)
    }
  })
  it("Ask's prompt answers 'Is Arena live?' with no plus the registration date", () => {
    const ctx = {
      user: { walletAddress: "" },
      normie: { id: 7141, name: "Zulo", traits: {}, agent: { id: 32626, name: "Zulo", status: "awakened" } },
      session: { history: [], currentGoal: "general Normies guidance" },
      platformContext: {
        currentTime: "2026-11-10T00:00:00.000Z",
        subjectScope: { mode: "general", walletConnected: false, activeNormieId: null, mentionedTokenIds: [], normieIsSpeakerIdentityOnly: true, userOwnsFocus: false },
        mentionedNormies: [],
      },
    }
    const prompt = composeZuloPrompt(ctx as never, "Is Arena live?")
    assert.ok(prompt.includes(`"Is Arena live / can I play?": no. ${ARENA_STATUS_LINE}. ${ARENA_REGISTRATION_LINE}.`))
  })
  it("no surface says Arena is live, open or that registration is open now, and no Nov 15 date", () => {
    // User-facing code, prompts, knowledge and public files. docs/zulo is checked only for dates: its record-card spec
    // describes future states ("Arena is live, but the sample isn't met").
    const surfaces = [...walk("lib"), ...walk("app"), ...walk("components"), ...walk("public"), "README.md", "AGENTS.md"]
    const docs = walk("docs/zulo").filter((f) => !f.includes("/archive/"))
    const live = /\bArena\s*(?:=|:|is|now)\s*\**\s*(?:LIVE|open|playable)\b|registration is (?:now )?open\b/i
    const nov15 = /\bNov(?:ember)?\.? 15(?:th)?\b/i
    const hits: string[] = []
    for (const [files, re] of [[surfaces, new RegExp(`${live.source}|${nov15.source}`, "i")], [docs, nov15]] as const) {
      for (const f of files) {
        fs.readFileSync(f, "utf8").split("\n").forEach((line, i) => {
          if (re.test(line)) hits.push(`${f}:${i + 1}: ${line.trim().slice(0, 140)}`)
        })
      }
    }
    assert.deepEqual(hits, [])
  })
})

describe("surface tags fail closed", () => {
  it("Arena shows LIVE only for an explicit LIVE status, never as the fallback", () => {
    const src = fs.readFileSync("lib/official-status.ts", "utf8")
    assert.match(src, /arena: \(String\(OFFICIAL_STATUS\.arena\.status\) === "LIVE" \? "LIVE" : "COMING SOON"\)/)
    assert.doesNotMatch(src, /: "COMING SOON" : "LIVE"\)/)
    assert.equal(SURFACE_TAGS.arena, "COMING SOON")
  })
})
