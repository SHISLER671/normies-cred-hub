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
  ARENA_API_STATUS,
  ARENA_LIVE_SOURCE,
  ARENA_ENTER_SOURCE,
  ARENA_REGISTRATION_LINE,
  ARENA_SITE,
  ARENA_STATUS_LINE,
  ARENA_STORAGE_CONTRACT,
  isArenaOfficiallyLive,
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
  // Arena went LIVE on launch weekend (2026-11-14). The old "Coming Soon" wording is now the regression.
  { re: /\bArena\s*(?:=|:|is|stays)\s*(?:still\s+)?\**\s*(?:Coming Soon|not live|not open|not playable)\b/i, why: "Arena is LIVE" },
  { re: /\bArena\b[^\n]{0,40}\bplayable on CredHub\b(?<!not playable on CredHub)/i, why: "Arena is entered at the official site, never on CredHub" },
  { re: /\bAgents Canvas\s*(?:=|:|is)\s*\**\s*(?:LIVE|open now)\b/i, why: "Agents Canvas is announced, not live" },
  { re: /Zombies[^\n]{0,20}\b(?!21\/21)\d{1,2}\/21\b/i, why: "Zombies are 21/21 sealed" },
  { re: /\bspent\b[^\n]{0,30}\bper pixel\b|\bpainting (?:spends|costs|uses up)\b/i, why: "Painting never spends PIXEL / action points" },
]

describe("official status: one source of truth", () => {
  it("states the confirmed statuses", () => {
    assert.equal(OFFICIAL_STATUS.pixelMarket.status, "LIVE")
    assert.equal(OFFICIAL_STATUS.pixelMarket.since, "2026-10-05")
    assert.equal(OFFICIAL_STATUS.arena.status, "LIVE")
    assert.equal(OFFICIAL_STATUS.arena.since, "2026-11-14")
    assert.equal(OFFICIAL_STATUS.zombies.claimed, 21)
    assert.equal(OFFICIAL_STATUS.zombies.total, 21)
    assert.deepEqual(SURFACE_TAGS, { pixelMarket: "LIVE", arena: "LIVE", zombies: "ALL CLAIMED" })
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
  it("states the date and the source, word for word as before launch", () => {
    assert.equal(OFFICIAL_STATUS.arena.registration.week1Opens, "2026-11-14")
    assert.equal(OFFICIAL_STATUS.arena.registration.source, SOURCE)
    // Exact prefix (date, author, source URL, as-of), not a substring search for the URL.
    assert.match(
      ARENA_REGISTRATION_LINE,
      /^Arena Week 1 registration date: Saturday, November 14, 2026 \(per @serc1n, https:\/\/x\.com\/serc1n\/status\/2119787233632719147, as of the 2026-11-09 post\); /,
    )
    assert.match(ARENA_REGISTRATION_LINE, /Registration opening isn't the Arena launch\. CredHub doesn't handle registration$/)
    // Worded as a date, not "opens", so it stays true after November 14 (Claude review of #160).
    assert.doesNotMatch(ARENA_REGISTRATION_LINE, /registration opens/i)
    // Ryan, 2026-11-11: the planned date from normiesART's Arena article replaces "mid-November".
    assert.equal(OFFICIAL_STATUS.arena.source, "https://x.com/normiesART/status/2120475856372142292")
    assert.equal(ARENA_ENTER_SOURCE, "https://arena.normies.art/world/enter")
    assert.equal(OFFICIAL_STATUS.arena.enterPage, ARENA_ENTER_SOURCE)
    assert.equal(OFFICIAL_STATUS.arena.expected, "Monday, November 16, 2026 (planned, per normiesART's Nov 11 post)")
    assert.doesNotMatch(OFFICIAL_STATUS.arena.expected, /http/i)
  })
  it("on-page expected copy has no URL", () => {
    assert.doesNotMatch(OFFICIAL_STATUS.arena.expected, /http/i)
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
  it("Ask's prompt answers 'Is Arena live?' with yes, at the official site, plus the status and registration lines", () => {
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
    assert.ok(prompt.includes(`"Is Arena live / can I play?": yes, Arena is live, at the official site and not here. ${ARENA_STATUS_LINE}. ${ARENA_REGISTRATION_LINE}.`))
    assert.ok(prompt.includes(`NCH does not handle opt-in and cannot enter anyone: point people to ${ARENA_SITE}.`))
    assert.ok(prompt.includes("Being entered and in line is not a record"))
    assert.ok(prompt.includes("Arena is not the Pixel Market"))
    assert.ok(prompt.includes("Never mention prizes, a prize pool, payouts or winnings."))
  })
  it("no surface says registration is open now or that Arena can be entered or played on CredHub; Nov 16 only as the plan or Game 1's clock", () => {
    // User-facing code, prompts, knowledge and public files. docs/zulo is checked only for dates.
    const surfaces = [...walk("lib"), ...walk("app"), ...walk("components"), ...walk("public"), "README.md", "AGENTS.md"]
    const docs = walk("docs/zulo").filter((f) => !f.includes("/archive/"))
    // Arena is live at the official site. What stays banned: a claim that sign-up is open right now (it opens on a
    // schedule), and any claim that NCH is where you enter or play.
    const claims = /registration is (?:now )?open\b|\b(?:enter|play|opt in to|register for) (?:the )?Arena (?:here|on CredHub|on NCH|from CredHub|from NCH|from this page)\b/i
    // The earlier planned date is banned outright, even when worded as a plan. Nov 16 may appear only as the plan or as
    // Game 1's official clock ("Nov 16, 20:00 CET").
    // walk() already skips *.test.* files, so historical test comments are not scanned.
    const nov15 = /\bNov(?:ember)?\.? 15(?:th)?\b|2026-11-15/
    const nov16 = /\bNov(?:ember)?\.? 16(?:th)?\b(?!, 2026 \(planned|, 2026 \(a plan|, 20:00 CET)/i
    const dates = new RegExp(`${nov15.source}|${nov16.source}`, "i")
    const hits: string[] = []
    for (const [files, re] of [[surfaces, new RegExp(`${claims.source}|${dates.source}`, "i")], [docs, dates]] as const) {
      for (const f of files) {
        fs.readFileSync(f, "utf8").split("\n").forEach((line, i) => {
          if (re.test(line)) hits.push(`${f}:${i + 1}: ${line.trim().slice(0, 140)}`)
        })
      }
    }
    assert.deepEqual(hits, [])
  })
})

describe("Arena is LIVE (per @normiesART's 2026-11-14 post; sources in lib/official-status.ts)", () => {
  it("the status line says live, since when, where to enter, and that CredHub is not where", () => {
    assert.equal(
      ARENA_STATUS_LINE,
      'Arena = LIVE since 2026-11-14 (official: @normiesART, "Normies Arena is live now", https://x.com/normiesART/status/2121679594294030459; opt-in and the line are open at https://arena.normies.art/world/enter; games run in rounds and Game 1 starts Mon Nov 16, 20:00 CET); a fully autonomous agent game, entered at https://arena.normies.art, never on CredHub',
    )
    assert.equal(isArenaOfficiallyLive(), true)
    assert.equal(SURFACE_TAGS.arena, "LIVE")
  })
  it("every source is named: the official live post first, then the entry page, the official API, the verified contract and the launch-plan post", () => {
    // Exact text, built from the same constants the module exports (no substring search on URLs).
    assert.equal(ARENA_LIVE_SOURCE, "https://x.com/normiesART/status/2121679594294030459")
    assert.equal(OFFICIAL_STATUS.arena.liveSource, ARENA_LIVE_SOURCE)
    assert.equal(OFFICIAL_STATUS.arena.liveSourcePostedAt, "2026-11-14T19:00:00Z")
    // The live post comes first: it is what the LIVE status rests on.
    assert.deepEqual([...OFFICIAL_STATUS.arena.sources], [
      `@normiesART, 2026-11-14 19:00 UTC (${ARENA_LIVE_SOURCE}): "Normies Arena is live now", linking arena.normies.art`,
      `Official Arena entry page (${ARENA_ENTER_SOURCE}): opt in any time before Monday 20:00 CET (during a game, it's for next week); games run Monday 20:00 CET to Saturday 20:00 CET`,
      `Official API (${ARENA_API_STATUS}): indexed, with Normies in the line and round 1 upcoming (read at block 26416887)`,
      `NormiesArenaStorage ${ARENA_STORAGE_CONTRACT} (verified contract, same deployer as the Pixel Market and Canvas contracts)`,
      `@normiesART, Nov 11, 2026 (${OFFICIAL_STATUS.arena.source}): "launching on Monday. Registration starts on Saturday."`,
    ])
    assert.equal(new URL(ARENA_API_STATUS).hostname, "api.normies.art")
    assert.equal(new URL(ARENA_API_STATUS).pathname, "/arena/status")
    assert.equal(OFFICIAL_STATUS.arena.site, ARENA_SITE)
    assert.equal(ARENA_SITE, "https://arena.normies.art")
  })
  it("no prize, pool, payout, winnings or earnings claim in the status line or its sources", () => {
    for (const text of [ARENA_STATUS_LINE, ...OFFICIAL_STATUS.arena.sources]) {
      assert.doesNotMatch(text, /prize|pool\b|payout|winnings|earn|reward|\bbet\b/i, text.slice(0, 60))
    }
  })
  it("the pinned official response agrees: indexed, the same storage contract, round 1 upcoming and Normies in line", () => {
    const status = JSON.parse(fs.readFileSync("lib/record-card/fixtures/arena-status.json", "utf8"))
    assert.equal(status.indexed, true)
    assert.equal(status.storage, ARENA_STORAGE_CONTRACT)
    assert.equal(status.upcoming[0].round, 1)
    assert.ok(Number(status.line.waiting) > 0)
  })
  it("the homepage and the track read the tag from the module, so they show LIVE with no edit", () => {
    assert.match(fs.readFileSync("app/page.tsx", "utf8"), /name: "Arena", status: SURFACE_TAGS\.arena/)
    assert.match(fs.readFileSync("components/evolution-track.tsx", "utf8"), /SURFACE_TAGS\.arena === "LIVE"/)
  })
})

describe("PR-5: the last pre-launch Arena copy matches the official status", () => {
  const read = (f: string) => fs.readFileSync(f, "utf8")
  it("thesis-lock carries the status line and the registration line word for word, citing the live post", () => {
    const lock = read("docs/zulo/thesis-lock.md")
    assert.ok(lock.includes(`- ${ARENA_STATUS_LINE}. ${ARENA_REGISTRATION_LINE}.`))
    assert.ok(lock.includes(ARENA_LIVE_SOURCE))
    assert.doesNotMatch(lock, /Arena = Coming Soon/)
    assert.match(lock, /No "enter Arena" nextStep on NCH: opt-in happens at arena\.normies\.art only/)
  })
  it("the Agents Canvas plan no longer says Arena stays Coming Soon, and keeps Agents Canvas not live", () => {
    const plan = read("docs/zulo/agent-canvas-votes-plan.md")
    assert.doesNotMatch(plan, /Arena stays "Coming Soon"/)
    assert.ok(plan.includes(ARENA_LIVE_SOURCE))
    assert.match(plan, /Agents Canvas itself stays announced, not live/)
    assert.equal(OFFICIAL_STATUS.agentsCanvas.status, "ANNOUNCED")
  })
  it("no current doc in docs/zulo still calls Arena Coming Soon or not live", () => {
    const stale = /\bArena\s*(?:=|:|is|stays)\s*(?:still\s+)?["“]?\**\s*(?:Coming Soon|not live|not open)\b/i
    const hits: string[] = []
    for (const f of walk("docs/zulo").filter((x) => !x.includes("/archive/"))) {
      read(f).split("\n").forEach((line, i) => { if (stale.test(line)) hits.push(`${f}:${i + 1}: ${line.trim().slice(0, 120)}`) })
    }
    assert.deepEqual(hits, [])
  })
  it("Zulo's self-awareness and operator blocks point at the entry page and say NCH can't enter anyone", () => {
    const self = buildSelfAwarenessPromptBlock()
    assert.ok(self.includes(`${ARENA_STATUS_LINE}; its mechanics, fee and schedule are on the official entry page`))
    assert.match(self, /I can't enter anyone, and being entered and in line is not a record/)
    assert.doesNotMatch(self, /X posts, not the docs/)
    const tandem = buildOperatorTandemPromptBlock()
    assert.ok(tandem.includes(`${ARENA_STATUS_LINE}; its current mechanics are on the official entry page, and CredHub can't enter anyone.`))
    for (const block of [self, tandem]) {
      assert.ok(block.includes(AGENTS_CANVAS_STATUS_LINE), "Agents Canvas stays announced, not live")
      assert.doesNotMatch(block.replace(/Never[^.]*\./g, ""), /prize|prize pool|payout|winnings/i)
    }
  })
  it("the growth track and the homepage say Arena is live with the live post as source, and trading stays not launched", () => {
    const track = read("components/evolution-track.tsx")
    assert.match(track, /Live; the record card reads official Arena data\. Being entered and in line is not a record/)
    assert.match(track, /href=\{ARENA_LIVE_SOURCE\}/)
    assert.equal((track.match(/once it is connected/g) ?? []).length, 1, "only the Agents Canvas branch still waits for a connection")
    assert.match(track, /Not launched; needs an official record of trades/)
    const home = read("components/home-future-plans.tsx")
    assert.match(home, /"Arena is live"/)
    assert.match(home, /SURFACE_TAGS\.arena === "LIVE" \? ARENA_LIVE_SOURCE : ARENA_LAUNCH_SOURCE/)
    assert.match(home, /title="Trading record" subtitle="Not launched"/)
    for (const src of [track, home]) assert.doesNotMatch(src, /prize|payout|winnings|pixelsWon/i)
  })
})

describe("surface tags fail closed", () => {
  it("Arena shows LIVE only for an explicit LIVE status, never as the fallback", () => {
    const src = fs.readFileSync("lib/official-status.ts", "utf8")
    assert.match(src, /arena: \(String\(OFFICIAL_STATUS\.arena\.status\) === "LIVE" \? "LIVE" : "COMING SOON"\)/)
    assert.doesNotMatch(src, /: "COMING SOON" : "LIVE"\)/)
    assert.equal(SURFACE_TAGS.arena, "LIVE")
    // The fallback word is still COMING SOON: a status that is not exactly "LIVE" never shows as live.
    assert.match(src, /=== "LIVE" \? "LIVE" : "COMING SOON"/)
  })
})

describe("the earlier planned Arena calendar date stays out of copy and tests", () => {
  it("no user-facing file or test spells that day in words", () => {
    const month = "Nov"
    const needles = [`${month}ember 15`, `${month} 15`]
    const files = [
      ...walk("lib"),
      ...walk("app"),
      ...walk("components"),
      ...walk("public"),
      ...walk("docs/zulo").filter((f) => !f.includes("/archive/")),
      "README.md",
      "AGENTS.md",
    ]
    // Also scan tests (walk() skips *.test.*).
    const tests: string[] = []
    const walkTests = (dir: string) => {
      if (!fs.existsSync(dir)) return
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (["node_modules", ".next", ".git", "archive"].includes(e.name)) continue
        const p = path.join(dir, e.name)
        if (e.isDirectory()) walkTests(p)
        else if (/\.test\.(ts|tsx)$/.test(e.name)) tests.push(p)
      }
    }
    for (const d of ["lib", "app", "components"]) walkTests(d)
    const hits: string[] = []
    for (const f of [...files, ...tests]) {
      fs.readFileSync(f, "utf8").split("\n").forEach((line, i) => {
        for (const s of needles) if (line.includes(s)) hits.push(`${f}:${i + 1}: ${line.trim().slice(0, 140)}`)
      })
    }
    assert.deepEqual(hits, [])
  })
})
