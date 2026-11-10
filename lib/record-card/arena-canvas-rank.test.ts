// Arena Canvas rank (2026-11-10, Ryan): rank name only, source-linked; neutral top label; next rank on /burn only;
// on the record card page, JSON and Ask's record-card line, never on the share image.
import assert from "node:assert/strict"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"

import {
  ARENA_CANVAS_RANKS,
  ARENA_CANVAS_RANKS_SOURCE,
  arenaCanvasRankNote,
  nextArenaCanvasRankText,
  nextRankLevel,
  rankForLevel,
} from "@/lib/normies-canon"

import { recordCardLine } from "./ask-line"
import { loadArenaSector } from "./arena"
import { arenaCanvasRankField, buildRecordCard, GATE_CLEAN_OWNERSHIP, GATE_REGISTERED } from "./build"

const ROOT = join(__dirname, "../..")
const read = (f: string) => readFileSync(join(ROOT, f), "utf8")
const TOP = "Level 150+ (top Arena rank)"
const ORIGIN = "https://normiescredhub.vercel.app"

describe("rankForLevel / nextRankLevel boundaries", () => {
  const cases: Array<[number, string, number | null]> = [
    [1, "Blank", 2],
    [2, "Sketched", 10],
    [9, "Sketched", 10],
    [10, "Inked", 25],
    [24, "Inked", 25],
    [25, "Painted", 50],
    [49, "Painted", 50],
    [50, "Gilded", 100],
    [99, "Gilded", 100],
    [100, "Masterwork", 150],
    [149, "Masterwork", 150],
    [150, TOP, null],
    [151, TOP, null],
    [1_000, TOP, null],
  ]
  for (const [level, name, next] of cases) {
    it(`Level ${level} → ${name}, next ${next ?? "none"}`, () => {
      assert.equal(rankForLevel(level)?.name, name)
      assert.equal(nextRankLevel(level), next)
    })
  }
  it("rank uses min(level, 150); #1 at Level 151 stays in the top band", () => {
    assert.equal(rankForLevel(151)?.fromLevel, 150)
    assert.deepEqual(rankForLevel(151), rankForLevel(150))
  })
  it("missing or invalid Levels have no rank", () => {
    for (const bad of [null, undefined, 0, -3, Number.NaN, Number.POSITIVE_INFINITY]) {
      assert.equal(rankForLevel(bad), null)
      assert.equal(nextRankLevel(bad), null)
      assert.equal(nextArenaCanvasRankText(bad), null)
    }
  })
  it("next-rank text is a plain fact, and nothing at the top rank", () => {
    assert.equal(nextArenaCanvasRankText(14), "Next Arena Canvas rank at Level 25")
    assert.equal(nextArenaCanvasRankText(150), null)
    assert.equal(nextArenaCanvasRankText(151), null)
  })
})

describe("the rank table matches normiesART's Arena article (drift)", () => {
  it("names and start Levels", () => {
    assert.deepEqual(
      ARENA_CANVAS_RANKS.map((r) => [r.name, r.fromLevel]),
      [["Blank", 1], ["Sketched", 2], ["Inked", 10], ["Painted", 25], ["Gilded", 50], ["Masterwork", 100], [TOP, 150]],
    )
  })
  it("source is the official article", () => {
    assert.equal(ARENA_CANVAS_RANKS_SOURCE.url, "https://x.com/normiesART/status/2113323053304238383")
    assert.equal(ARENA_CANVAS_RANKS_SOURCE.published, "2026-10-23")
  })
  it("note copy is exact", () => {
    assert.equal(
      arenaCanvasRankNote(50),
      "From Level 50 (official API). Rank names per normiesART's Arena article (Oct 23, 2026). Arena is Coming Soon and the article says game data may change. A label, not a score; it does not count toward any rank here.",
    )
  })
})

describe("record card JSON", () => {
  const NOW = "2026-11-10T12:00:00.000Z"
  async function card(level: number | null) {
    return buildRecordCard({
      tokenId: 7141,
      now: NOW,
      binding: { agentId: "32626", timestamp: "1778887079", blockNumber: "25103790" },
      identity: { name: "Zulo", type: "Human" },
      canvas: { actionPoints: 12, level, customized: false, delegate: null, gridSize: 40 },
      owner: { owner: "0xfafd8fb6b4e43ace0e365553f1b9242384591031" },
      zombie: { info: { isZombie: false } },
      pulse: { pulse_level: 4, max_level: 5, status: "Strong", breakdown: [GATE_REGISTERED, GATE_CLEAN_OWNERSHIP] },
      chatRatings: null,
      arena: await loadArenaSector(7141, NOW, { status: "COMING_SOON" }),
    })
  }
  it("identity.arena_canvas_rank: name, source url, as_of, never counted", async () => {
    const r = (await card(2)).identity.arena_canvas_rank!
    assert.equal(r.value, "Sketched")
    assert.equal(r.label, "verified")
    assert.equal(r.counts_toward_rank, false)
    assert.equal(r.from_level, 2)
    assert.equal(r.source_url, ARENA_CANVAS_RANKS_SOURCE.url)
    assert.equal(r.as_of, NOW)
    assert.equal(r.source.kind, "nch_computed")
    assert.match(r.note!, /^From Level 2 \(official API\)/)
    assert.equal("next" in r || "next_rank" in r || "next_rank_level" in r, false)
  })
  it("unavailable without a Level", async () => {
    const r = (await card(null)).identity.arena_canvas_rank!
    assert.equal(r.value, null)
    assert.equal(r.label, "unavailable")
    assert.equal(r.note, null)
    assert.equal(r.counts_toward_rank, false)
  })
  it("the card keeps the real Level past 150", () => {
    const r = arenaCanvasRankField(1, 151, NOW)
    assert.equal(r.value, TOP)
    assert.equal(r.from_level, 151)
  })
})

describe("Ask's record-card line", () => {
  it("names the rank with its source, never the next rank", () => {
    const line = recordCardLine(7141, [GATE_REGISTERED, GATE_CLEAN_OWNERSHIP], ORIGIN, "COMING_SOON", 14)
    assert.match(line, /Arena Canvas rank: Inked \(from Level 14, official API; rank names per normiesART's Arena article, Oct 23, 2026/)
    assert.ok(line.includes(ARENA_CANVAS_RANKS_SOURCE.url))
    assert.match(line, /a label, not a score/)
    assert.doesNotMatch(line, /next|Level 25/i)
  })
  it("no Level → no rank clause (line unchanged)", () => {
    const line = recordCardLine(7141, [], ORIGIN, "COMING_SOON")
    assert.doesNotMatch(line, /Canvas rank/)
  })
  it("top band uses the neutral label", () => {
    assert.match(recordCardLine(1, [], ORIGIN, "COMING_SOON", 151), /Arena Canvas rank: Level 150\+ \(top Arena rank\) \(from Level 151/)
  })
})

// All new copy: rank names, note, next-rank text, Ask line and prompt rule, and the page snippets that render them.
function newCopy(): string[] {
  const out: string[] = [
    ...ARENA_CANVAS_RANKS.map((r) => r.name),
    ...[1, 2, 10, 25, 50, 100, 150, 151].map((l) => arenaCanvasRankNote(l)),
    ...[1, 2, 10, 25, 50, 100, 149].map((l) => nextArenaCanvasRankText(l)!),
    ...[1, 14, 151].map((l) => recordCardLine(7141, [], ORIGIN, "COMING_SOON", l)),
  ]
  const prompt = read("lib/agent-recommendations/composePrompt.ts").split("\n").filter((l) => l.includes("Arena Canvas rank"))
  assert.equal(prompt.length, 1, "the Ask prompt rule")
  const burn = read("app/burn/page.tsx")
  const burnSnippet = burn.slice(burn.indexOf("function NextCanvasRank"), burn.indexOf("function GoalNotes"))
  const rec = read("app/record/[tokenId]/page.tsx")
  const recSnippet = rec.split("\n").filter((l) => /canvasRank|Arena Canvas rank/.test(l))
  return [...out, ...prompt, burnSnippet, ...recSnippet]
}

describe("lock: new copy stays a label", () => {
  const banned: Array<[string, RegExp]> = [
    ["head start", /head start/i],
    ["boost", /boost/i],
    ["laser", /laser/i],
    ["sword", /sword/i],
    ["prize", /prize/i],
    ["pool", /\bpool/i],
    ["edge to win", /edge to win/i],
    ["level up by", /level up by/i],
    ["level up / upgrade prompts", /level(ing)? up|upgrade/i],
    ["Nov 15", /Nov(ember)?\.? 15/i],
    ["Legendary Canvas (the award contract's name)", /Legendary Canvas/i],
    ["earn", /\bearn/i],
    ["profit", /profit/i],
    ["ETH", /\bETH\b/],
    ["price or cost", /\bprice|\bcost/i],
    ["#PIXEL amounts", /#?PIXEL\b/],
    ["buy or burn prompts (CSS class names aside)", /\b(buy|burn)\b(?!-)/i],
    ["Arena called live or open", /Arena (is )?(live|open)/i],
  ]
  const copy = newCopy()
  it("is scanning the new copy", () => assert.ok(copy.length > 20))
  for (const [what, re] of banned) {
    it(`no ${what}`, () => assert.deepEqual(copy.filter((t) => re.test(t)), []))
  }
  it('"Legendary Canvas" never appears in UI code', () => {
    const ui = ["app", "components", "lib/record-card"].flatMap((d) => walk(join(ROOT, d)))
    const hits = ui.filter((f) => /Legendary Canvas/.test(readFileSync(f, "utf8"))).map((f) => f.slice(ROOT.length + 1))
    assert.deepEqual(hits, [])
  })
})

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (name === "node_modules" || name.startsWith(".")) continue
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.ts$/.test(name)) out.push(p)
  }
  return out
}

describe("where the rank shows", () => {
  it("never on the share image", () => {
    for (const f of [
      "app/record/[tokenId]/opengraph-image.tsx",
      "app/record/[tokenId]/twitter-image.tsx",
      "lib/record-card/share-image.ts",
      "lib/record-card/og-art.ts",
      "components/record-share.tsx",
    ]) {
      assert.doesNotMatch(read(f), /arena_canvas_rank|Canvas rank|rankForLevel|ARENA_CANVAS|nextRankLevel/, f)
    }
  })
  it("the next rank shows on /burn only", () => {
    const files = ["app", "components", "lib"].flatMap((d) => walk(join(ROOT, d))).map((f) => f.slice(ROOT.length + 1))
    const users = files.filter((f) => /nextArenaCanvasRankText|nextRankLevel|Next Arena Canvas rank/.test(read(f)))
    assert.deepEqual(users.sort(), ["app/burn/page.tsx", "lib/normies-canon.ts"])
  })
  it("/burn shows it in Arena mode only, with the Not financial advice label kept", () => {
    const burn = read("app/burn/page.tsx")
    assert.match(burn, /model\.goal === "arena" && <NextCanvasRank level=\{r\.level\} \/>/)
    assert.match(burn, /<li>Not financial advice<\/li>/)
  })
  it("the record card page shows the rank and its source link", () => {
    const rec = read("app/record/[tokenId]/page.tsx")
    assert.match(rec, /label="Arena Canvas rank"/)
    assert.match(rec, /href=\{canvasRank\.source_url\}/)
  })
})
