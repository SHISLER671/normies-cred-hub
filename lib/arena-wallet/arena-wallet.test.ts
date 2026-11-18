// Arena wallet check, against two real official responses pinned in lib/arena-wallet/fixtures/ (GET /arena/holder/{address},
// read 2026-11-17, wallet addresses replaced with placeholders): a wallet with one Normie (#7141) and a wallet with no
// Normies in the Arena. Cases built from them with changed fields are synthetic and say so.
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"

import sitemap from "@/app/sitemap"
import { resolveArenaPath } from "@/lib/arena-api"
import { ARENA_STATUS_LINE } from "@/lib/official-status"
import { loadArenaSector, officialArenaSource } from "@/lib/record-card/arena"

import {
  ARENA_WALLET_EMPTY_TEXT,
  arenaWalletCacheControl,
  arenaWalletResponse,
  arenaWalletText,
  holderStatusLine,
  parseArenaHolder,
  parseWalletQuery,
  walletLabel,
  type ArenaWalletResult,
} from "./core"
import { loadArenaWallet, type ArenaWalletDeps } from "./load"

const NOW = "2026-11-17T04:00:00.000Z"
const json = (path: string): unknown => JSON.parse(readFileSync(path, "utf8"))
const HOLDER = json("lib/arena-wallet/fixtures/arena-holder-one-normie.json") as Record<string, unknown> & { normies: Record<string, unknown>[] }
const EMPTY = json("lib/arena-wallet/fixtures/arena-holder-empty.json") as Record<string, unknown>
const STATUS_OPEN = json("lib/record-card/fixtures/arena-status-round1-open.json")
const ZULO = json("lib/record-card/fixtures/arena-normie-7141.json")
const ZULO_ROUNDS = json("lib/record-card/fixtures/arena-normie-7141-rounds.json")
const WALLET = "0x1111111111111111111111111111111111111111"
const EMPTY_WALLET = "0x2222222222222222222222222222222222222222"

type Reply = { status: number; body: unknown } | "throws"
/** Stubs for the three reads, recording what was asked. */
function deps(arena: Record<string, Reply>, ens: { forward?: Record<string, string | null | "throws">; reverse?: Record<string, string | null> } = {}) {
  const asked: string[] = []
  const names: string[] = []
  const d: ArenaWalletDeps = {
    get: async (path) => {
      asked.push(path)
      const r = arena[path]
      if (!r || r === "throws") throw new Error("connection refused: upstream-secret-detail")
      return r
    },
    resolveEns: async (name) => {
      names.push(name)
      const r = ens.forward?.[name]
      if (r === undefined || r === "throws") throw new Error("rpc down")
      return r
    },
    reverseEns: async (address) => ens.reverse?.[address] ?? null,
    now: () => new Date(NOW),
  }
  return { d, asked, names }
}
const ok = (body: unknown): Reply => ({ status: 200, body })
const HOLDER_PATH = `/arena/holder/${WALLET}`
const EMPTY_PATH = `/arena/holder/${EMPTY_WALLET}`
const arena = { [HOLDER_PATH]: ok(HOLDER), [EMPTY_PATH]: ok(EMPTY), "/arena/status": ok(STATUS_OPEN) }

/** Amount field names from the official responses, and money words. None may appear in what NCH gives out. */
const AMOUNTS = /balance|pixelsWon|pixelsRefunded|pixelsCharged|deposited|withdrawn|migrated|prize|pool|payout|refund|#?PIXEL|\bPX\b/i

describe("the pinned real responses are what the code expects (field names seen, not guessed)", () => {
  it("a wallet with one Normie: address, three counts, and a list", () => {
    for (const key of ["address", "registered", "active", "short", "normies"]) assert.ok(key in HOLDER, key)
    for (const key of ["tokenId", "state", "registered", "registeredRound", "roundsPlayed", "lastRound", "wins", "owner"]) assert.ok(key in HOLDER.normies[0], key)
    assert.ok(!("inCurrentRound" in HOLDER.normies[0]), "holder rows have no inCurrentRound")
  })
  it("the real empty-wallet shape: 200, zero counts, an empty list", () => {
    assert.deepEqual(EMPTY, { address: EMPTY_WALLET, balance: "0", pixelsWon: "0", registered: 0, active: 0, short: 0, normies: [] })
  })
  it("the fixtures hold no real wallet address", () => {
    for (const hex of JSON.stringify([HOLDER, EMPTY]).match(/0x[0-9a-fA-F]{40}/g) ?? []) assert.match(hex, /^0x(.)\1{39}$/, hex)
  })
})

describe("input: a wallet address or an ENS name, nothing else", () => {
  it("accepts a 0x address (lower-cased) and a .eth name (lower-cased), and cleans a paste", () => {
    assert.deepEqual(parseWalletQuery("0xFAFD8FB6B4E43ACE0E365553F1B9242384591031"), { kind: "address", address: "0xfafd8fb6b4e43ace0e365553f1b9242384591031" })
    assert.deepEqual(parseWalletQuery(`  "${WALLET}".  `), { kind: "address", address: WALLET })
    assert.deepEqual(parseWalletQuery("Zulo.ETH"), { kind: "ens", name: "zulo.eth" })
    assert.deepEqual(parseWalletQuery("sub.name.eth"), { kind: "ens", name: "sub.name.eth" })
  })
  it("nothing typed is 'missing', not 'bad'", () => {
    for (const v of [null, undefined, "", "   "]) assert.deepEqual(parseWalletQuery(v), { kind: "missing" })
  })
  it("refuses X, Farcaster, Discord and email handles, other domains, hashes and free text", () => {
    const bad = [
      "@zulo", "zulo", "zulo#1234", "zulo@example.com", "zulo@name.eth", "zulo.fc", "zulo.lens", "zulo.base.eth.xyz", "zulo.com", "name.eth/../x",
      "https://x.com/zulo", "https://warpcast.com/zulo", "discord:zulo", "0x1234", `${WALLET}00`, `0x${"a".repeat(64)}`, "0xZZZZ111111111111111111111111111111111111",
      "na me.et h x", "名前.eth", "name_.eth", ".eth", "x".repeat(400) + ".eth",
    ]
    for (const v of bad) assert.deepEqual(parseWalletQuery(v), { kind: "bad" }, v)
  })
  it("a handle is never looked up: no ENS read and no Arena read", async () => {
    for (const v of ["@zulo", "zulo@example.com", "https://x.com/zulo", "zulo#1234"]) {
      const s = deps(arena, { forward: {} })
      assert.deepEqual(await loadArenaWallet(v, s.d), { kind: "bad_input" })
      assert.deepEqual([s.asked, s.names], [[], []], v)
    }
  })
})

describe("parseArenaHolder is strict", () => {
  it("the real holder: one Normie, counts only", () => {
    assert.deepEqual(parseArenaHolder(HOLDER, WALLET), {
      address: WALLET,
      counts: { registered: 1, active: 1, short: 0 },
      countsMatch: true,
      normies: [{ tokenId: 7141, state: "active", registered: true, registeredRound: 0, roundsPlayed: 1, wins: 0, lastRound: 1 }],
    })
  })
  it("the real empty wallet: no Normies", () => {
    assert.deepEqual(parseArenaHolder(EMPTY, EMPTY_WALLET), { address: EMPTY_WALLET, counts: { registered: 0, active: 0, short: 0 }, countsMatch: true, normies: [] })
  })
  it("the wallet asked for may be mixed case; the answer must be for that wallet", () => {
    assert.ok(parseArenaHolder({ ...EMPTY, address: "0x000000000000000000000000000000000000dead" }, "0x000000000000000000000000000000000000dEaD"))
    assert.equal(parseArenaHolder(HOLDER, EMPTY_WALLET), null)
  })
  const row = (over: Record<string, unknown>) => ({ ...HOLDER, normies: [{ ...HOLDER.normies[0], ...over }] })
  it("refuses a malformed body", () => {
    for (const bad of [null, [], "x", { ...HOLDER, normies: {} }, { ...HOLDER, normies: undefined }, { ...HOLDER, registered: true }, { ...HOLDER, active: "one" }, { ...HOLDER, short: -1 }, { ...HOLDER, address: 5 }]) {
      assert.equal(parseArenaHolder(bad, WALLET), null, JSON.stringify(bad))
    }
  })
  it("refuses a malformed Normie row", () => {
    for (const over of [{ tokenId: "x" }, { tokenId: 10000 }, { tokenId: 1.5 }, { state: "winning" }, { state: null }, { registered: "true" }, { owner: EMPTY_WALLET }, { owner: null }, { roundsPlayed: "1.0" }, { wins: 2 }, { wins: -1 }, { lastRound: null }, { lastRound: "one" }]) {
      assert.equal(parseArenaHolder(row(over), WALLET), null, JSON.stringify(over))
    }
  })
  it("refuses a Normie listed twice", () => {
    assert.equal(parseArenaHolder({ ...HOLDER, registered: 2, active: 2, normies: [HOLDER.normies[0], HOLDER.normies[0]] }, WALLET), null)
  })
  it("counts that don't match the list are not refused: the list stands and the mismatch is flagged", () => {
    for (const over of [{ registered: 2 }, { active: 0 }, { short: 1 }]) {
      const parsed = parseArenaHolder({ ...HOLDER, ...over }, WALLET)
      assert.equal(parsed?.countsMatch, false, JSON.stringify(over))
      assert.deepEqual(parsed?.normies.map((n) => n.tokenId), [7141])
    }
    assert.equal(parseArenaHolder({ ...EMPTY, registered: 1 }, EMPTY_WALLET)?.countsMatch, false)
  })
  it("numbers may be whole numbers or digit strings; the list is sorted by Normie number", () => {
    const two = { ...HOLDER, registered: "2", active: "2", normies: [HOLDER.normies[0], { ...HOLDER.normies[0], tokenId: 42, roundsPlayed: "1", wins: "0", lastRound: "1" }] }
    assert.deepEqual(parseArenaHolder(two, WALLET)?.normies.map((n) => n.tokenId), [42, 7141])
  })
  it("amounts never change the answer", () => {
    const rich = { ...HOLDER, balance: "777", pixelsWon: "888", normies: [{ ...HOLDER.normies[0], balance: "999", pixelsWon: "666", deposited: "555" }] }
    assert.deepEqual(parseArenaHolder(rich, WALLET), parseArenaHolder(HOLDER, WALLET))
  })
})

describe("five different answers, and only 'couldn't read' is uncached", () => {
  const run = async () => ({
    empty: await loadArenaWallet(EMPTY_WALLET, deps(arena).d),
    holder: await loadArenaWallet(WALLET, deps(arena).d),
    bad: await loadArenaWallet("0x1234", deps(arena).d),
    noName: await loadArenaWallet("nobody.eth", deps(arena, { forward: { "nobody.eth": null } }).d),
    ensDown: await loadArenaWallet("zulo.eth", deps(arena, { forward: { "zulo.eth": "throws" } }).d),
  })
  it("empty wallet, real holder, bad address, name that doesn't resolve, ENS that couldn't be read", async () => {
    const r = await run()
    assert.deepEqual(r.empty, { kind: "empty", wallet: { address: EMPTY_WALLET, ens: null }, as_of: NOW, counts_match: true })
    assert.equal(r.holder.kind, "ok")
    assert.deepEqual(r.bad, { kind: "bad_input" })
    assert.deepEqual(r.noName, { kind: "ens_not_found" })
    assert.deepEqual(r.ensDown, { kind: "unavailable", what: "ens" })
    const all = Object.values(r)
    assert.equal(new Set(all.map((x) => x.kind)).size, 5, "five different kinds")
    assert.equal(new Set(all.map(arenaWalletText)).size, 5, "five different texts")
    assert.equal(new Set(all.map((x) => arenaWalletResponse(x).status)).size, 4, "200 (empty and ok), 400, 404, 503")
    assert.equal(new Set(all.map((x) => JSON.stringify(arenaWalletResponse(x).body))).size, 5, "five different API bodies")
  })
  it("the empty wallet reads exactly 'No Normies from this wallet in the Arena'", async () => {
    const r = await run()
    assert.equal(arenaWalletText(r.empty), "No Normies from this wallet in the Arena")
    assert.equal(ARENA_WALLET_EMPTY_TEXT, "No Normies from this wallet in the Arena")
    assert.deepEqual(arenaWalletResponse(r.empty).body.normies, [])
  })
  it("only 'couldn't read' is uncached", async () => {
    const r = await run()
    for (const [name, result] of Object.entries(r)) {
      const cache = arenaWalletCacheControl(result)
      if (name === "ensDown") assert.equal(cache, "no-store")
      else assert.match(cache, /^public, s-maxage=60, /, name)
      assert.equal(arenaWalletResponse(result).cacheControl, cache)
    }
  })
  it("the Arena couldn't be read: also its own answer, also uncached, never 'empty'", async () => {
    for (const reply of ["throws", { status: 500, body: null }, { status: 429, body: null }, ok({ normies: "nope" }), ok({ ...HOLDER, normies: [{ ...HOLDER.normies[0], state: "winning" }] })] as Reply[]) {
      const r = await loadArenaWallet(WALLET, deps({ [HOLDER_PATH]: reply, "/arena/status": ok(STATUS_OPEN) }).d)
      assert.deepEqual(r, { kind: "unavailable", what: "arena" })
      assert.equal(arenaWalletCacheControl(r), "no-store")
      assert.equal(arenaWalletResponse(r).status, 503)
    }
  })
  it("404 from the official API is 'no entry', not empty and not couldn't read", async () => {
    const r = await loadArenaWallet(WALLET, deps({ [HOLDER_PATH]: { status: 404, body: null } }).d)
    assert.equal(r.kind, "not_found")
    assert.notEqual(arenaWalletText(r), ARENA_WALLET_EMPTY_TEXT)
    assert.match(arenaWalletCacheControl(r), /s-maxage=60/)
  })
})

describe("the real holder's answer", () => {
  it("lists #7141 with its state, status line and record card path, and the raw counts", async () => {
    const r = await loadArenaWallet(WALLET, deps(arena).d)
    assert.ok(r.kind === "ok")
    assert.deepEqual(r.normies, [
      { token_id: 7141, state: "active", state_text: "Active: plays every free round, and paid rounds while topped up", status_text: "Playing Round 1 now: 1 round counted so far", record_path: "/record/7141" },
    ])
    assert.deepEqual(r.counts, { listed: 1, registered: 1, active: 1, short: 0 })
    assert.equal(arenaWalletText(r), "1 Normie from this wallet in the Arena")
  })
  it("its status line is the record card's own, word for word (from the same real responses)", async () => {
    const get = async (path: string) => {
      const body = { "/arena/normie/7141": ZULO, "/arena/status": STATUS_OPEN, "/arena/normie/7141/rounds": ZULO_ROUNDS }[path]
      if (!body) throw new Error("no")
      return { status: 200, body }
    }
    const card = await loadArenaSector(7141, NOW, { status: "LIVE", sources: [officialArenaSource(get)] })
    const r = await loadArenaWallet(WALLET, deps(arena).d)
    assert.ok(r.kind === "ok")
    assert.equal(r.normies[0].status_text, card.status_text)
  })
  it("a failed /arena/status read doesn't fail the list; the round is just unknown", async () => {
    const r = await loadArenaWallet(WALLET, deps({ [HOLDER_PATH]: ok(HOLDER) }).d)
    assert.ok(r.kind === "ok")
    assert.equal(r.normies[0].status_text, "Building a record: 1 round played")
  })
  it("synthetic: the other status lines match the card's wording", () => {
    const base = { tokenId: 1, state: "active" as const, registered: true, registeredRound: 3, roundsPlayed: 0, wins: 0, lastRound: null }
    const none = { live: null, anyRoundStarted: null }
    assert.equal(holderStatusLine(base, none), "Registered. It plays from Round 4. It hasn't played a round yet, so there's no record")
    assert.equal(holderStatusLine(base, { live: null, anyRoundStarted: false }), "Registered. It plays from Round 4. No Arena round has started yet, so there's no record")
    assert.equal(holderStatusLine({ ...base, registered: false, state: "unregistered" }, none), "Not entered in Arena")
    assert.equal(holderStatusLine({ ...base, roundsPlayed: 3, lastRound: 3 }, { live: { current: 4, open: true }, anyRoundStarted: true }), "Building a record: 3 rounds played")
    assert.equal(holderStatusLine({ ...base, roundsPlayed: 3, lastRound: 4 }, { live: { current: 4, open: false }, anyRoundStarted: true }), "Building a record: 3 rounds played")
  })
  it("makes two Arena reads for the wallet, never one per Normie, and both paths are on the allowlist", async () => {
    const s = deps(arena)
    await loadArenaWallet(WALLET, s.d)
    assert.deepEqual(s.asked.sort(), [HOLDER_PATH, "/arena/status"].sort())
    for (const p of s.asked) assert.ok(resolveArenaPath(p), p)
  })
})

describe("official totals that don't match the list", () => {
  /** Synthetic: the real holder plus a second Normie that is short, with one total (active) that doesn't match. */
  const SHORT_ROW = { ...HOLDER.normies[0], tokenId: "42", state: "short", stateCode: 2, roundsPlayed: 2, lastRound: 2, wins: 1 }
  const two = (over: Record<string, unknown>) => ({ ...HOLDER, registered: 2, active: 1, short: 1, normies: [HOLDER.normies[0], SHORT_ROW], ...over })
  it("matching totals with a short Normie: no caption", async () => {
    const r = await loadArenaWallet(WALLET, deps({ ...arena, [HOLDER_PATH]: ok(two({})) }).d)
    assert.ok(r.kind === "ok")
    assert.equal(r.counts_match, true)
    assert.deepEqual(r.counts, { listed: 2, registered: 2, active: 1, short: 1 })
    assert.deepEqual(r.normies.map((n) => [n.token_id, n.state, n.state_text]), [
      [42, "short", "Short: sat out a paid round; plays free rounds until topped up"],
      [7141, "active", "Active: plays every free round, and paid rounds while topped up"],
    ])
    assert.ok(!("note" in arenaWalletResponse(r).body))
  })
  it("one mismatched total: the list is shown anyway, with the caption, and it is still a cached ok", async () => {
    const r = await loadArenaWallet(WALLET, deps({ ...arena, [HOLDER_PATH]: ok(two({ active: 2 })) }).d)
    assert.ok(r.kind === "ok")
    assert.equal(r.counts_match, false)
    assert.deepEqual(r.normies.map((n) => n.token_id), [42, 7141])
    assert.deepEqual(r.counts, { listed: 2, registered: 2, active: 2, short: 1 }, "the official totals are shown as given")
    const res = arenaWalletResponse(r)
    assert.equal(res.status, 200)
    assert.equal(res.body.counts_match, false)
    assert.equal(res.body.note, "The official totals for this wallet don't match the list; showing the list.")
    assert.match(res.cacheControl, /s-maxage=60/)
  })
  it("the other strict checks still refuse the response", async () => {
    for (const bad of [two({ normies: [HOLDER.normies[0], { ...SHORT_ROW, tokenId: "7141" }] }), two({ normies: [HOLDER.normies[0], { ...SHORT_ROW, state: "paused" }] }), two({ normies: [HOLDER.normies[0], { ...SHORT_ROW, tokenId: 10000 }] })]) {
      assert.deepEqual(await loadArenaWallet(WALLET, deps({ ...arena, [HOLDER_PATH]: ok(bad) }).d), { kind: "unavailable", what: "arena" })
    }
  })
  it("the page shows the caption only on a mismatch", () => {
    const page = readFileSync("app/arena/page.tsx", "utf8")
    assert.ok(page.includes('{result.counts_match ? "" : ` ${ARENA_WALLET_COUNTS_NOTE}`}'))
  })
})

describe("ENS", () => {
  it("a name that resolves: the Arena is read for its address, and the name is kept", async () => {
    const s = deps(arena, { forward: { "zulo.eth": "0x1111111111111111111111111111111111111111" } })
    const r = await loadArenaWallet("Zulo.eth", s.d)
    assert.ok(r.kind === "ok")
    assert.deepEqual(r.wallet, { address: WALLET, ens: "zulo.eth" })
    assert.deepEqual(s.names, ["zulo.eth"])
    assert.ok(s.asked.includes(HOLDER_PATH))
  })
  it("an address with a primary name shows the name; without one, or when the reverse read fails, the short address", async () => {
    const named = await loadArenaWallet(WALLET, deps(arena, { reverse: { [WALLET]: "zulo.eth" } }).d)
    assert.ok(named.kind === "ok")
    assert.equal(walletLabel(named.wallet), "zulo.eth")
    const plain = await loadArenaWallet(WALLET, deps(arena).d)
    assert.ok(plain.kind === "ok")
    assert.equal(walletLabel(plain.wallet), "0x1111…1111")
    const failing = deps(arena)
    failing.d.reverseEns = async () => {
      throw new Error("rpc down")
    }
    const stillOk = await loadArenaWallet(WALLET, failing.d)
    assert.ok(stillOk.kind === "ok" && stillOk.wallet.ens === null)
  })
  it("a name that doesn't resolve never reaches the Arena", async () => {
    const s = deps(arena, { forward: { "nobody.eth": null } })
    assert.deepEqual(await loadArenaWallet("nobody.eth", s.d), { kind: "ens_not_found" })
    assert.deepEqual(s.asked, [])
  })
  it("a resolver answer that isn't an address never reaches the URL", async () => {
    for (const odd of ["0x1234", "../status", `${WALLET}/../../status`, ""]) {
      const s = deps(arena, { forward: { "odd.eth": odd } })
      assert.deepEqual(await loadArenaWallet("odd.eth", s.d), { kind: "unavailable", what: "ens" })
      assert.deepEqual(s.asked, [])
    }
  })
})

describe("no amounts anywhere", () => {
  it("the API response for the real holder and the real empty wallet has no balance, pixelsWon or other amount", async () => {
    for (const w of [WALLET, EMPTY_WALLET]) {
      const { body } = arenaWalletResponse(await loadArenaWallet(w, deps(arena).d))
      assert.doesNotMatch(JSON.stringify(body), AMOUNTS)
    }
  })
  it("synthetic: amounts on every official field still never reach the API response", async () => {
    const rich = { ...HOLDER, balance: "777123", pixelsWon: "888123", normies: [{ ...HOLDER.normies[0], balance: "999123", pixelsWon: "666123", pixelsCharged: "555123", deposited: "444123" }] }
    const { body } = arenaWalletResponse(await loadArenaWallet(WALLET, deps({ ...arena, [HOLDER_PATH]: ok(rich) }).d))
    const text = JSON.stringify(body)
    assert.doesNotMatch(text, AMOUNTS)
    assert.doesNotMatch(text, /777123|888123|999123|666123|555123|444123/)
  })
  it("the API body has exactly the fields it is meant to have", async () => {
    const { body } = arenaWalletResponse(await loadArenaWallet(WALLET, deps(arena).d))
    assert.deepEqual(Object.keys(body).sort(), ["as_of", "counts", "normies", "result", "source", "text", "wallet"])
    assert.deepEqual(Object.keys((body.normies as object[])[0]).sort(), ["record_path", "state", "state_text", "status_text", "token_id"])
    assert.deepEqual(body.source, { kind: "official_api", label: "Official Arena data (api.normies.art)", ref: "GET /arena/holder/{address}" })
    assert.equal(body.as_of, NOW)
  })
  it("the page, the API route and the library never name an amount field", () => {
    for (const file of ["app/arena/page.tsx", "app/api/arena-wallet/route.ts", "lib/arena-wallet/load.ts"]) {
      assert.doesNotMatch(readFileSync(file, "utf8"), /balance|pixelsWon|pixelsRefunded|pixelsCharged|deposited|withdrawn|prize|payout/i, file)
    }
    // core.ts names `balance` and `pixelsWon` only in comments that say they are never read.
    const code = readFileSync("lib/arena-wallet/core.ts", "utf8").split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n")
    assert.doesNotMatch(code, /balance|pixelsWon|pixelsRefunded|pixelsCharged|deposited|withdrawn|prize|payout/i)
  })
  it("no pool, prize or winnings on the wallet check, by rule: they would add up to wallet-level winnings (AGENTS.md)", async () => {
    const MONEY_WORDS = /pool|prize|payout|winnings|\bwon\b|earn|balance|pixelsWon|round_pool|#PIXEL|\bPX\b/i
    for (const w of [WALLET, EMPTY_WALLET]) {
      const result = await loadArenaWallet(w, deps(arena).d)
      assert.doesNotMatch(JSON.stringify(arenaWalletResponse(result).body), MONEY_WORDS)
      assert.doesNotMatch(arenaWalletText(result), MONEY_WORDS)
    }
    const page = readFileSync("app/arena/page.tsx", "utf8")
    const jsx = page.slice(page.indexOf("return ("))
    assert.doesNotMatch(jsx.replace("{ARENA_STATUS_LINE}", ""), MONEY_WORDS, "the wallet page renders no money wording")
    for (const file of ["app/api/arena-wallet/route.ts", "lib/arena-wallet/load.ts"]) {
      assert.doesNotMatch(readFileSync(file, "utf8"), /round_pool|parseArenaRoundPool|pool|prize|winnings/i, file)
    }
  })
  it("the llms.txt entries name no amount", () => {
    const txt = readFileSync("public/llms.txt", "utf8")
    const start = txt.indexOf("Arena wallet check")
    assert.ok(start >= 0)
    const block = txt.slice(start, txt.indexOf("\n\n", start))
    assert.ok(block.includes("GET /api/arena-wallet?wallet=<0x address or name.eth>"))
    assert.ok(block.includes("Human page: /arena"))
    assert.doesNotMatch(block, AMOUNTS)
  })
})

describe("input that failed the check is never echoed back", () => {
  const typed = ["@zulo_handle_xyz", "zulo_handle_xyz@example.com", "<script>alert('xyz')</script>", "0xNOTANADDRESSxyz", "nobody-xyz.eth"]
  it("the API body and text never contain what was typed", async () => {
    for (const v of typed) {
      const r = await loadArenaWallet(v, deps(arena, { forward: { "nobody-xyz.eth": null } }).d)
      assert.ok(r.kind === "bad_input" || r.kind === "ens_not_found", v)
      const out = JSON.stringify(arenaWalletResponse(r)) + arenaWalletText(r)
      assert.ok(!out.includes(v) && !/xyz/i.test(out), v)
      assert.ok(!("wallet" in r), "no wallet field to show")
    }
  })
  it("a name whose ENS read failed isn't echoed either, and upstream error text never gets out", async () => {
    const r = await loadArenaWallet("down-xyz.eth", deps(arena, { forward: { "down-xyz.eth": "throws" } }).d)
    const failedArena = await loadArenaWallet(WALLET, deps({ [HOLDER_PATH]: "throws" }).d)
    for (const x of [r, failedArena]) {
      const out = JSON.stringify(arenaWalletResponse(x)) + arenaWalletText(x)
      assert.doesNotMatch(out, /xyz|rpc down|connection refused|upstream-secret-detail/i)
    }
  })
  it("the page refills the box only with the ENS name of a wallet that passed the check, never with what was typed", () => {
    const page = readFileSync("app/arena/page.tsx", "utf8")
    assert.ok(page.includes('defaultValue={known?.wallet.ens ?? ""}'))
    const jsx = page.slice(page.indexOf("return ("))
    assert.doesNotMatch(jsx, /\btyped\b|sp\.wallet/, "what was typed is never rendered")
  })
})

describe("the page, the record card link, the sitemap", () => {
  const page = readFileSync("app/arena/page.tsx", "utf8")
  it("is titled 'Arena wallet check' and says it is NCH's read-only view, not the Arena itself, linking arena.normies.art", () => {
    assert.ok(page.includes('<h1 className="burn-title">Arena wallet check</h1>'))
    assert.ok(page.includes("NCH&apos;s read-only view of official Arena data (api.normies.art). It is not the Arena itself"))
    assert.ok(page.includes("href={ARENA_SITE}"))
    assert.ok(page.includes("{ARENA_STATUS_LINE}"), "the status line is copied from lib/official-status.ts")
    assert.ok(ARENA_STATUS_LINE.startsWith("Arena = LIVE"))
  })
  it("has no share card and no contact, notify or message feature", () => {
    assert.doesNotMatch(page, /share|opengraph-image|mailto:|notify|subscribe|message|contact|textarea|method="post"/i)
  })
  it("never prints a full address: the wallet is shown through walletLabel", () => {
    assert.ok(page.includes("walletLabel(known.wallet)"))
    const jsx = page.slice(page.indexOf("return ("))
    assert.doesNotMatch(jsx, /wallet\.address/)
  })
  it("is rate-limited, and the API route uses enforceDualRateLimit before anything else", () => {
    assert.ok(page.includes("checkRateLimitById("))
    const route = readFileSync("app/api/arena-wallet/route.ts", "utf8")
    assert.ok(route.indexOf("enforceDualRateLimit(") > 0 && route.indexOf("enforceDualRateLimit(") < route.indexOf("loadArenaWallet("))
  })
  it("the record card links here only when its owner field is verified, showing the ENS name or the short address", () => {
    const record = readFileSync("app/record/[tokenId]/page.tsx", "utf8")
    assert.ok(record.includes('{context.owner.label === "verified" && context.owner.value && ('))
    assert.ok(record.includes("<a href={`/arena?wallet=${context.owner.value}`}>This wallet&apos;s Normies in the Arena</a>"))
    assert.ok(record.includes("{ownerEns ?? shortenAddress(context.owner.value, 4)}"))
  })
  it("/arena is in the sitemap", () => {
    assert.ok(sitemap().some((e) => e.url.endsWith("/arena")))
  })
})
