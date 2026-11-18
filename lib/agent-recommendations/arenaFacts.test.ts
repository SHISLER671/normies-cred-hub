// Ask Zulo's Arena facts, built from the real official responses pinned in lib/record-card/fixtures/ (read 2026-11-17):
// /arena/normie/7141, /arena/status (round 1 open) and /arena/normie/7141/rounds. Cases with changed fields are synthetic.
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"

import { getCollabRailsContextSummary } from "./loadKnowledge"
import { loadArenaSector, officialArenaSource } from "@/lib/record-card/arena"
import type { ArenaSector } from "@/lib/record-card/types"

import { buildArenaLive } from "@/lib/arena-live/core"

import {
  ASK_ARENA_BLOCK_TITLE,
  ASK_ARENA_COULD_NOT_READ,
  ASK_ARENA_LIVE_COULD_NOT_READ,
  ASK_ARENA_MAX_NORMIES,
  ASK_ARENA_MAX_ROUNDS,
  askArenaBlock,
  askArenaLines,
  askArenaTokenIds,
  loadAskArenaReads,
  type AskArenaRead,
} from "./arenaFacts"
import { composeZuloMessages } from "./composePrompt"
import type { ZuloRecommendationContext } from "./types"

const NOW = "2026-11-17T03:00:00.000Z"
const ORIGIN = "https://nch.example"
const fixture = (name: string): unknown => JSON.parse(readFileSync(`lib/record-card/fixtures/${name}.json`, "utf8"))
const ZULO = fixture("arena-normie-7141") as Record<string, unknown>
const STATUS_OPEN = fixture("arena-status-round1-open")
const ROUNDS = fixture("arena-normie-7141-rounds") as { rounds: Record<string, unknown>[] }

type Reply = { status: number; body: unknown }
const ok = (body: unknown): Reply => ({ status: 200, body })
/** The Arena sector exactly as the record card builds it, from stubbed official responses. */
function sectorFrom(tokenId: number, replies: Record<string, Reply>): Promise<ArenaSector> {
  const get = async (path: string) => {
    const r = replies[path]
    if (!r) throw new Error("connection refused")
    return r
  }
  return loadArenaSector(tokenId, NOW, { status: "LIVE", sources: [officialArenaSource(get)] })
}
const zuloSector = () =>
  sectorFrom(7141, { "/arena/normie/7141": ok(ZULO), "/arena/status": ok(STATUS_OPEN), "/arena/normie/7141/rounds": ok(ROUNDS) })
const read = (tokenId: number, sector: ArenaSector | null): AskArenaRead => ({ tokenId, asOf: NOW, sector })

/** Wording Ask must never get from the Arena data: amounts and the words around them. */
const MONEY = /prize|pool|payout|refund|winnings|sponsor|charged|deposit|withdraw|balance|#?PIXEL|\bpixels?\b|\bPX\b|\bETH\b|\$/i

function context(mentioned: number[], arenaReads?: AskArenaRead[]): ZuloRecommendationContext {
  return {
    user: { walletAddress: "" },
    normie: { id: mentioned[0] ?? 7141, name: "Normie", traits: {}, agent: { id: 32626, name: "Zulo", status: "awakened" } },
    session: { history: [], currentGoal: "general Normies guidance" },
    platformContext: {
      currentTime: NOW,
      subjectScope: {
        mode: mentioned.length ? "mentioned_ids" : "general",
        walletConnected: false,
        activeNormieId: null,
        mentionedTokenIds: mentioned,
        normieIsSpeakerIdentityOnly: mentioned.length === 0,
        userOwnsFocus: false,
      },
      mentionedNormies: [],
      ...(arenaReads ? { arenaReads } : {}),
      collabRails: getCollabRailsContextSummary(),
    },
  }
}

describe("which named Normies get Arena facts", () => {
  it("the cap is a named constant: the first 2 named, in order, no repeats", () => {
    assert.equal(ASK_ARENA_MAX_NORMIES, 2)
    assert.deepEqual(askArenaTokenIds([7141, 42, 9, 3]), [7141, 42])
    assert.deepEqual(askArenaTokenIds([7141, 7141, 42]), [7141, 42])
    assert.deepEqual(askArenaTokenIds([]), [])
    assert.deepEqual(askArenaTokenIds([10000, -1, 1.5, 5]), [5])
  })
  it("only those are read; the others are never asked for", async () => {
    const asked: number[] = []
    const reads = await loadAskArenaReads([7141, 42, 9, 3], {
      load: async (id) => {
        asked.push(id)
        return zuloSector()
      },
      now: () => new Date(NOW),
    })
    assert.deepEqual(asked.sort(), [42, 7141])
    assert.deepEqual(reads.map((r) => r.tokenId), [7141, 42])
    assert.equal(reads[0].asOf, NOW)
  })
  it("no Normie named: nothing is read", async () => {
    let calls = 0
    const reads = await loadAskArenaReads([], { load: async () => (calls++, zuloSector()) })
    assert.deepEqual(reads, [])
    assert.equal(calls, 0)
  })
})

describe("Zulo (#7141) from the three real responses", () => {
  it("states entry, the status line copied, rounds played, wins marked round in progress, and the round list", async () => {
    const sector = await zuloSector()
    const text = askArenaLines(read(7141, sector), ORIGIN)
    assert.ok(text.includes(`status line (copy exactly): "${sector.status_text}"`))
    assert.ok(text.includes('"Playing Round 1 now: 1 round counted so far"'))
    assert.match(text, /in Arena: Entered · Arena state: Active/)
    assert.match(text, /rounds played: 1 · wins: 0 \(round in progress: this count can still change\) \(GET \/arena\/normie\/7141\)/)
    assert.match(text, /round list, newest first \(GET \/arena\/normie\/7141\/rounds\):\n\s+Round 1 · 2026-11-16 · Round in progress/)
    assert.match(text, /raw counts: 1 listed · 1 in progress · 0 finished \(0 played, 0 did not play\)/)
  })
  it("every fact carries its source and as-of time, and the record card link", async () => {
    const text = askArenaLines(read(7141, await zuloSector()), ORIGIN)
    assert.ok(text.includes("source: Official Arena data (api.normies.art)"))
    assert.ok(text.includes(`as of ${NOW}`))
    assert.ok(text.includes(`${ORIGIN}/record/7141`))
  })
  it("the block has no prize, pool, payout or #PIXEL amount wording, and none of the API's amounts", async () => {
    const block = askArenaBlock([read(7141, await zuloSector())], [7141], ORIGIN)
    assert.doesNotMatch(block, MONEY)
    assert.doesNotMatch(block, /\b200\b/, "the round's pool figure from the real response never reaches the prompt")
  })
  it("synthetic: amounts on every official response still never reach the block", async () => {
    const rich = { ...ZULO, balance: "777", pixelsWon: "888", pixelsCharged: "999", pixelsRefunded: "666", deposited: "555" }
    const round = { ...ROUNDS.rounds[0], status: "ended", prize: "444", refund: "333", charged: "222", pool: "1111", payoutOrder: 1 }
    const sector = await sectorFrom(7141, {
      "/arena/normie/7141": ok(rich),
      "/arena/status": ok(STATUS_OPEN),
      "/arena/normie/7141/rounds": ok({ tokenId: "7141", rounds: [round], hasMore: false }),
    })
    const block = askArenaBlock([read(7141, sector)], [7141], ORIGIN)
    assert.doesNotMatch(block, MONEY)
    assert.doesNotMatch(block, /777|888|999|666|555|444|333|222|1111/)
    assert.match(block, /Round 1 · 2026-11-16 · Played/)
    assert.doesNotMatch(block.split("Rules for this block:")[0], /\bwon\b|\bwinner/i, "no per-round win in the facts")
  })
})

describe("couldn't read is its own answer", () => {
  it("a read that ran out of time or threw (sector null)", () => {
    const text = askArenaLines(read(42, null), ORIGIN)
    assert.match(text, /^- #42: COULD NOT READ the Arena right now/)
    assert.ok(text.includes(ASK_ARENA_COULD_NOT_READ))
    assert.match(text, /not "not entered", not zero and not missing data/)
    assert.doesNotMatch(text, /rounds played|wins:|status line/)
  })
  it("the official read failed inside the card's reader: same answer", async () => {
    const sector = await sectorFrom(7141, {})
    assert.equal(sector.status, "source_pending")
    assert.match(askArenaLines(read(7141, sector), ORIGIN), /^- #7141: COULD NOT READ the Arena right now/)
  })
  it("404 from the official API is 'not available', not 'couldn't read': the card's own line is copied", async () => {
    const sector = await sectorFrom(7141, { "/arena/normie/7141": { status: 404, body: null } })
    const text = askArenaLines(read(7141, sector), ORIGIN)
    assert.doesNotMatch(text, /COULD NOT READ/)
    assert.ok(text.includes(`"${sector.status_text}"`))
    assert.doesNotMatch(text, /rounds played|wins:/)
  })
  it("the Normie was read but its round list wasn't: the counts stand and the list says couldn't read", async () => {
    const sector = await sectorFrom(7141, { "/arena/normie/7141": ok(ZULO), "/arena/status": ok(STATUS_OPEN) })
    const text = askArenaLines(read(7141, sector), ORIGIN)
    assert.match(text, /rounds played: 1 · wins: 0/)
    assert.match(text, /round list: COULD NOT READ right now \(GET \/arena\/normie\/7141\/rounds\)/)
    assert.doesNotMatch(text, /raw counts/)
  })
  it("synthetic: not entered is a fact, not a failed read", async () => {
    const notEntered = { ...ZULO, tokenId: "4242", state: "unregistered", registered: false, agentId: null, skins: 0, roundsPlayed: 0, lastRound: null, wins: 0, inCurrentRound: false }
    const sector = await sectorFrom(4242, { "/arena/normie/4242": ok(notEntered), "/arena/status": ok(STATUS_OPEN) })
    const text = askArenaLines(read(4242, sector), ORIGIN)
    assert.ok(text.includes('status line (copy exactly): "Not entered in Arena"'))
    assert.match(text, /in Arena: Not entered/)
    assert.doesNotMatch(text, /COULD NOT READ|rounds played|wins:/)
  })
})

describe("the round list in the prompt", () => {
  it(`synthetic: lists at most ${ASK_ARENA_MAX_ROUNDS} rounds and says how many more are on the card`, async () => {
    const rounds = Array.from({ length: 14 }, (_, i) => ({ ...ROUNDS.rounds[0], round: i + 1, status: i === 13 ? "open" : "ended" }))
    const sector = await sectorFrom(7141, {
      "/arena/normie/7141": ok({ ...ZULO, roundsPlayed: 14, lastRound: 14 }),
      "/arena/status": ok(STATUS_OPEN),
      "/arena/normie/7141/rounds": ok({ tokenId: "7141", rounds, hasMore: false }),
    })
    const text = askArenaLines(read(7141, sector), ORIGIN)
    assert.equal((text.match(/^\s+Round \d+ ·/gm) ?? []).length, ASK_ARENA_MAX_ROUNDS)
    assert.match(text, /Round 14 · 2026-11-16 · Round in progress/)
    assert.match(text, /\(4 more on the record card\)/)
    assert.match(text, /raw counts: 14 listed · 1 in progress · 13 finished \(13 played, 0 did not play\)/)
  })
})

describe("the block's rules, and Normies past the cap", () => {
  it("no reads, no block", () => {
    assert.equal(askArenaBlock([], [], ORIGIN), "")
  })
  it("says facts only: no forecast, play advice, burn/keep/buy call, ranking or amounts", async () => {
    const block = askArenaBlock([read(7141, await zuloSector())], [7141], ORIGIN)
    assert.match(block, /no forecast, no advice on how a Normie should play, no burn, keep or buy call, no ranking of one Normie over another, and no amounts of any kind/)
    assert.match(block, /A round in progress has no result yet\. Never call it a win or a loss/)
    assert.match(block, /Never describe Arena results, wins or rankings that are not in this block or on the record card/)
  })
  it("Normies named after the first 2 get no Arena facts, only their record card links", async () => {
    const block = askArenaBlock([read(7141, await zuloSector()), read(42, null)], [7141, 42, 9, 3], ORIGIN)
    assert.match(block, /No Arena read this turn for #9, #3 \(Arena facts are read for the first 2 Normies named\)/)
    assert.ok(block.includes(`${ORIGIN}/record/9`) && block.includes(`${ORIGIN}/record/3`))
    assert.doesNotMatch(block, /^- #9\b|^- #3\b/m)
  })
})

describe("in the composed prompt", () => {
  it("the block is in the user message for a named Normie, and absent without reads", async () => {
    const reads = [read(7141, await zuloSector())]
    const withReads = composeZuloMessages(context([7141], reads), "how is #7141 doing in the Arena?")
    const without = composeZuloMessages(context([7141]), "how is #7141 doing in the Arena?")
    assert.ok(withReads.user.includes(`=== ${ASK_ARENA_BLOCK_TITLE} ===`))
    assert.ok(withReads.user.includes('"Playing Round 1 now: 1 round counted so far"'))
    assert.ok(!without.user.includes(ASK_ARENA_BLOCK_TITLE))
    assert.equal(withReads.system, without.system, "the Arena data changes only the per-turn facts, never the doctrine")
  })
  it("the Arena data adds no prize, pool, payout or #PIXEL amount wording to the prompt", async () => {
    const reads = [read(7141, await zuloSector()), read(42, null)]
    const q = "compare #7141 and #42 in the Arena"
    const withReads = composeZuloMessages(context([7141, 42], reads), q).user
    const without = composeZuloMessages(context([7141, 42]), q).user
    const start = withReads.indexOf(`=== ${ASK_ARENA_BLOCK_TITLE} ===`)
    assert.ok(start >= 0)
    const end = withReads.indexOf("\n=== ", start + 4)
    const added = withReads.slice(start, end === -1 ? undefined : end)
    assert.doesNotMatch(added, MONEY)
    assert.equal(withReads.replace(added, "").replace(/\n{2,}/g, "\n"), without.replace(/\n{2,}/g, "\n"), "nothing else in the prompt changed")
  })
  it("the raw Arena reads are not dumped into the context JSON", async () => {
    const user = composeZuloMessages(context([7141], [read(7141, await zuloSector())]), "how is #7141 doing?").user
    assert.doesNotMatch(user, /"arenaReads"|"round_history"|"pending_reason"/)
  })
  it("the doctrine keeps the old guard and tells Zulo what to say when the read fails", () => {
    const { system } = composeZuloMessages(context([]), "how is my Normie doing in the Arena?")
    assert.match(system, /Never describe Arena results, wins or rankings that the card does not show/)
    assert.ok(system.includes(ASK_ARENA_COULD_NOT_READ))
    assert.doesNotMatch(system, /stays "pending" until Arena opens/)
  })
})

describe("the Arena site's live standing (real responses in lib/arena-live/fixtures/, read 2026-11-18)", () => {
  const LIVE_RAW = {
    standing: fixture("../../arena-live/fixtures/standing-7141"),
    normie: fixture("../../arena-live/fixtures/normie-7141"),
    week: fixture("../../arena-live/fixtures/arena-week"),
  }
  const withLive = async (raw = LIVE_RAW): Promise<ArenaSector> => ({ ...(await zuloSector()), live: buildArenaLive(7141, raw, NOW) })
  /** Words Zulo must never get next to a live standing. */
  const FORBIDDEN = /prize|pool|payout|refund|winnings|sponsor|\bETH\b|\bUSD\b|\$|worth|if it ended|projected|estimated|on track|will finish|NCH rank:|NCH ranks/i

  it("is stated as 'the Arena currently reports #N of M, as of <time>; it can change until the round ends'", async () => {
    const text = askArenaLines(read(7141, await withLive()), ORIGIN)
    assert.ok(text.includes(`the Arena currently reports #280 of 748, as of ${NOW}; it can change until the round ends`))
    assert.ok(text.includes("source: Arena site live data (arena.normies.art)"))
    assert.match(text, /Arena score: 56452 Arena PX \(the game's own score\) · right now: Resting/)
    assert.match(text, /kills: 93 · deaths: 91 · duels won: 73/)
    assert.match(text, /round: Game 1 · phase as reported: live · ends 2026-11-21T19:00:00\.000Z \(UTC\) · 748 players/)
  })
  it("the official facts are still there, unchanged, beside it", async () => {
    const text = askArenaLines(read(7141, await withLive()), ORIGIN)
    assert.ok(text.includes('"Playing Round 1 now: 1 round counted so far"'))
    assert.match(text, /rounds played: 1 · wins: 0/)
  })
  it("the block tells Zulo: never predict a finish, never set it beside a prize, never call it an NCH rank", async () => {
    const block = askArenaBlock([read(7141, await withLive())], [7141], ORIGIN)
    assert.match(block, /say it only as "the Arena currently reports #N of M, as of <time>; it can change until the round ends"/)
    assert.match(block, /It is the Arena's own standing, never an NCH rank/)
    assert.match(block, /Never say where a Normie will finish, never set it beside what a place might bring, and never turn its score into anything else/)
  })
  it("the facts carry no prize, pool, payout, projection or conversion wording, and none of the response's money figures", async () => {
    const facts = askArenaLines(read(7141, await withLive()), ORIGIN)
    assert.doesNotMatch(facts, FORBIDDEN)
    assert.doesNotMatch(facts, /5241|2\.878|1821|\b200\b|\b75\b/, "worth, pool and winner-count figures never reach the prompt")
    assert.doesNotMatch(facts, /Elus|Whiskerwood|Liar|Brave|Generous/, "no names, titles or story text from the Arena response")
    assert.doesNotMatch(facts, /#PIXEL/)
  })
  it("the live rule is added only when a Normie has a live block", async () => {
    assert.doesNotMatch(askArenaBlock([read(7141, await zuloSector())], [7141], ORIGIN), /Live standing:/)
  })
  it("live data that couldn't be read: Zulo says so and states no live rank; the official facts stand", async () => {
    const sector = await withLive({ ...LIVE_RAW, week: null })
    assert.equal(sector.live?.status, "unavailable")
    const text = askArenaLines(read(7141, sector), ORIGIN)
    assert.match(text, /live standing: COULD NOT READ right now/)
    assert.ok(text.includes(ASK_ARENA_LIVE_COULD_NOT_READ))
    assert.doesNotMatch(text, /currently reports|#280|56452|Arena PX/)
    assert.match(text, /rounds played: 1 · wins: 0/)
  })
  it("in the composed prompt the live standing is in the per-turn facts only, never in the doctrine", async () => {
    const reads = [read(7141, await withLive())]
    const withReads = composeZuloMessages(context([7141], reads), "where is #7141 in the Arena right now?")
    const without = composeZuloMessages(context([7141]), "where is #7141 in the Arena right now?")
    assert.ok(withReads.user.includes("the Arena currently reports #280 of 748"))
    assert.equal(withReads.system, without.system)
    assert.doesNotMatch(withReads.user, /"live_rank"|"live_score_px"/, "the raw block is not dumped into the context JSON")
  })
})
