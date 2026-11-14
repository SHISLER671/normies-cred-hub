// One-off owner_since backfill from Transfer logs (docs/zulo/pulse-trust-fixes-spec.md, 1.2).
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"

import {
  WINDOW_BLOCKS,
  latestTransferPerToken,
  parseCursor,
  runOwnerSinceBackfill,
  type BackfillDeps,
  type TransferEvent,
} from "./ownership-check-backfill"

const SECRET = "s3cret"
const AUTH = `Bearer ${SECRET}`
const NOW = new Date("2026-11-14T00:00:00.000Z")
const NOW_S = NOW.getTime() / 1000
const LATEST = 27_000_000
/** A chain with a block exactly every 12 seconds, ending at NOW. */
const timeOf = (block: number) => NOW_S - (LATEST - block) * 12
const iso = (block: number) => new Date(timeOf(block) * 1000).toISOString()

function fake(events: TransferEvent[] = [], over: Partial<BackfillDeps> = {}) {
  const writes: Array<[number, string]> = []
  const fills: string[] = []
  const scans: Array<[number, number]> = []
  const deps: BackfillDeps = {
    latestBlock: async () => LATEST,
    blockTime: async (b) => timeOf(b),
    transferLogs: async (from, to) => { scans.push([from, to]); return events.filter((e) => e.block >= from && e.block <= to) },
    raiseOwnerSince: async (id, t) => { writes.push([id, t]) },
    fillEmpty: async (t) => { fills.push(t); return 9000 },
    now: () => NOW,
    ...over,
  }
  return { deps, writes, fills, scans }
}
const run = (q: string, f: ReturnType<typeof fake>, auth: string | null = AUTH) =>
  runOwnerSinceBackfill(auth, SECRET, new URLSearchParams(q), () => f.deps)

describe("latestTransferPerToken", () => {
  it("keeps the newest transfer per token: later block, then later log index", () => {
    const m = latestTransferPerToken([
      { tokenId: 1, block: 10, logIndex: 5 },
      { tokenId: 1, block: 12, logIndex: 1 },
      { tokenId: 1, block: 12, logIndex: 7 },
      { tokenId: 1, block: 11, logIndex: 99 },
      { tokenId: 2, block: 3, logIndex: 0 },
    ])
    assert.deepEqual(m.get(1), { tokenId: 1, block: 12, logIndex: 7 })
    assert.deepEqual(m.get(2), { tokenId: 2, block: 3, logIndex: 0 })
  })
  it("skips token ids that aren't a Normie", () => {
    const m = latestTransferPerToken([
      { tokenId: 10_000, block: 1, logIndex: 0 },
      { tokenId: -1, block: 1, logIndex: 0 },
      { tokenId: 1.5, block: 1, logIndex: 0 },
    ])
    assert.equal(m.size, 0)
  })
})

describe("parseCursor", () => {
  const q = (s: string) => parseCursor(new URLSearchParams(s))
  it("no cursor on the first call", () => assert.equal(q("dry=1"), null))
  it("reads a full cursor", () => assert.deepEqual(q("from=100&to=900&next=400"), { from: 100, to: 900, next: 400 }))
  it("refuses a partial, non-numeric, out-of-order or oversized cursor", () => {
    for (const bad of ["from=1", "from=1&to=2", "from=a&to=2&next=1", "from=5&to=2&next=5", "from=1&to=9&next=0", "from=1&to=9&next=11", "from=-1&to=9&next=1", `from=0&to=${WINDOW_BLOCKS * 2 + 1}&next=0`]) {
      assert.equal(q(bad), "bad", bad)
    }
  })
})

describe("runOwnerSinceBackfill", () => {
  it("is operator-only: no bearer secret, nothing is built, read or written", async () => {
    const f = fake()
    let built = false
    for (const auth of [null, "", "Bearer wrong", SECRET]) {
      const r = await runOwnerSinceBackfill(auth, SECRET, new URLSearchParams(), () => { built = true; return f.deps })
      assert.equal(r.status, 401)
    }
    assert.equal((await runOwnerSinceBackfill(AUTH, undefined, new URLSearchParams(), () => f.deps)).status, 401)
    assert.equal(built, false)
    assert.equal(f.scans.length, 0)
  })
  it("the x-vercel-cron header is not looked at: the route passes only the authorization header", () => {
    const src = readFileSync("app/api/cron/owner-since-backfill/route.ts", "utf8")
    assert.match(src, /req\.headers\.get\("authorization"\)/)
    assert.doesNotMatch(src.replace(/^\/\/.*$/gm, ""), /x-vercel-cron/)
    assert.doesNotMatch(src, /export async function GET/)
  })
  it("503 without the database write key, and no upstream error text on a failed step", async () => {
    assert.equal((await runOwnerSinceBackfill(AUTH, SECRET, new URLSearchParams(), () => null)).status, 503)
    const r = await run("", fake([], { transferLogs: async () => { throw new Error("rpc said: secret-internal-detail") } }))
    assert.equal(r.status, 503)
    assert.doesNotMatch(JSON.stringify(r.body), /secret-internal-detail/)
  })
  it("first call: the window is the last 30 days in 1,000-block chunks, scanned oldest first", async () => {
    const f = fake()
    const r = await run("chunks=5", f)
    assert.equal(r.status, 200)
    assert.ok(r.status === 200)
    const from = LATEST - WINDOW_BLOCKS
    assert.equal(WINDOW_BLOCKS, 216_000)
    assert.deepEqual(r.body.window, { from_block: from, to_block: LATEST, start: iso(from) })
    assert.ok(NOW_S - timeOf(from) >= 30 * 86_400)
    assert.deepEqual(f.scans, Array.from({ length: 5 }, (_, i) => [from + i * 1000, from + i * 1000 + 999]))
    assert.equal(r.body.done, false)
    assert.equal(r.body.next, `from=${from}&to=${LATEST}&next=${from + 5000}`)
    assert.equal(r.body.filled_with_window_start, null)
    assert.equal(f.fills.length, 0)
  })
  it("steps the window back when blocks came slower than 12 seconds, so it always covers 30 days", async () => {
    // Missed slots: this chain averages 12.1 seconds a block, so 216,000 blocks would be MORE than 30 days. Make it faster instead
    // (11.9 s) so the default start is too recent and the window has to step back.
    const t = (b: number) => NOW_S - (LATEST - b) * 11.9
    const f = fake([], { blockTime: async (b) => t(b) })
    const r = await run("chunks=1", f)
    assert.ok(r.status === 200)
    assert.ok(r.body.window.from_block < LATEST - WINDOW_BLOCKS)
    assert.ok(NOW_S - t(r.body.window.from_block) >= 30 * 86_400)
  })
  it("sets each transferred token to the block time of its latest transfer in the slice", async () => {
    const from = LATEST - WINDOW_BLOCKS
    const f = fake([
      { tokenId: 7, block: from + 10, logIndex: 0 },
      { tokenId: 7, block: from + 1500, logIndex: 3 },
      { tokenId: 8, block: from + 20, logIndex: 1 },
      { tokenId: 9, block: from + 9000, logIndex: 0 }, // outside this slice
    ])
    const r = await run("chunks=2", f)
    assert.ok(r.status === 200)
    assert.deepEqual(f.writes.sort((a, b) => a[0] - b[0]), [[7, iso(from + 1500)], [8, iso(from + 20)]])
    assert.equal(r.body.transfers_seen, 3)
    assert.equal(r.body.tokens_set, 2)
  })
  it("the last call fills every token with no transfer in the window with the window start", async () => {
    const from = LATEST - WINDOW_BLOCKS
    const f = fake([{ tokenId: 3, block: LATEST - 5, logIndex: 0 }])
    const r = await run(`from=${from}&to=${LATEST}&next=${LATEST - 1500}`, f)
    assert.ok(r.status === 200)
    assert.equal(r.body.done, true)
    assert.equal(r.body.next, null)
    assert.deepEqual(f.writes, [[3, iso(LATEST - 5)]])
    assert.deepEqual(f.fills, [iso(from)])
    assert.equal(r.body.filled_with_window_start, 9000)
    assert.deepEqual(f.scans, [[LATEST - 1500, LATEST - 501], [LATEST - 500, LATEST]])
  })
  it("walking the cursor covers the whole window exactly once, in about 216 scans (not per token)", async () => {
    const f = fake()
    let q = "chunks=60"
    for (let i = 0; i < 10; i++) {
      const r = await run(q, f)
      assert.ok(r.status === 200)
      if (r.body.done) break
      q = `${r.body.next}&chunks=60`
    }
    // 216,001 blocks (both ends included) in 1,000-block chunks: 216 full ones and a one-block tail.
    assert.equal(f.scans.length, 217)
    assert.equal(f.scans[0][0], LATEST - WINDOW_BLOCKS)
    assert.equal(f.scans[216][1], LATEST)
    for (let i = 1; i < f.scans.length; i++) assert.equal(f.scans[i][0], f.scans[i - 1][1] + 1)
    assert.ok(f.scans.every(([a, b]) => b - a + 1 <= 1000))
    assert.equal(f.fills.length, 1)
  })
  it("dry=1 scans and counts but writes nothing, and keeps dry on the next cursor", async () => {
    const from = LATEST - WINDOW_BLOCKS
    const f = fake([{ tokenId: 7, block: from + 10, logIndex: 0 }])
    const r = await run("dry=1&chunks=1", f)
    assert.ok(r.status === 200)
    assert.equal(r.body.dry, true)
    assert.equal(r.body.transfers_seen, 1)
    assert.equal(r.body.tokens_set, 0)
    assert.equal(f.writes.length, 0)
    assert.match(r.body.next ?? "", /&dry=1$/)
    const last = await run(`from=${from}&to=${LATEST}&next=${LATEST}&dry=1`, f)
    assert.ok(last.status === 200)
    assert.equal(last.body.done, true)
    assert.equal(f.fills.length, 0)
  })
  it("refuses a bad cursor or a window past the latest block", async () => {
    assert.equal((await run("from=5&to=2&next=5", fake())).status, 400)
    assert.equal((await run(`from=${LATEST}&to=${LATEST + 10}&next=${LATEST}`, fake())).status, 400)
  })
  it("a failed write stops the step before the cursor moves on", async () => {
    const from = LATEST - WINDOW_BLOCKS
    const f = fake([{ tokenId: 7, block: from + 10, logIndex: 0 }], { raiseOwnerSince: async () => { throw new Error("db down") } })
    assert.equal((await run("chunks=1", f)).status, 503)
  })
})

describe("the real writes only ever raise owner_since, and the code stays read-only on-chain", () => {
  const src = readFileSync("lib/ownership-check-backfill.ts", "utf8")
  it("writes owner_since only where it is empty or older", () => {
    assert.match(src, /\.is\("owner_since", null\)/)
    assert.match(src, /\.lt\("owner_since", iso\)/)
    const updates = src.match(/\.update\(\{[^}]*\}/g) ?? []
    assert.equal(updates.length, 3)
    for (const u of updates) assert.equal(u, ".update({ owner_since: iso }")
  })
  it("no on-chain write or signature of any kind", () => {
    for (const f of ["lib/ownership-check-backfill.ts", "lib/ownership-check-load.ts", "lib/ownership-check.ts", "app/api/cron/owner-since-backfill/route.ts"]) {
      assert.doesNotMatch(readFileSync(f, "utf8"), /writeContract|sendTransaction|signTypedData|signMessage|walletClient/, f)
    }
  })
})
