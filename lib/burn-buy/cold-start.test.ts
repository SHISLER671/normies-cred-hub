import { describe, it } from "node:test"
import assert from "node:assert/strict"

import { fetchIndexRows, INDEX_CHUNK, INDEX_TOKEN_SPAN, loadListings, snapshotFromRows, type IndexRow } from "./data"
import { buildBurnBuy, SourceError, type Deps, type MarketSnapshot } from "./service"

const row = (token_id: number, over: Partial<IndexRow> = {}): IndexRow => ({ token_id, owner: "0xA", action_points: 0, on_pixels: 500, indexed_at: "2026-10-04T00:00:00Z", ...over })

describe("snapshotFromRows (pure)", () => {
  it("builds supply, wallets, census and the oldest row", () => {
    const s = snapshotFromRows([
      row(1, { owner: "0xAAA", on_pixels: 500, action_points: 10, indexed_at: "2026-10-03T10:00:00Z" }),
      row(2, { owner: "0xAAA", on_pixels: 500, indexed_at: "2026-10-01T10:00:00Z" }),
      row(3, { owner: "0xBBB", on_pixels: 300 }),
    ])
    assert.equal(s.livingSupply, 3)
    assert.equal(s.wallets, 2)
    assert.equal(s.pixelSupply.get(500), 2)
    assert.equal(s.originalPixels.get(3), 300)
    assert.equal(s.oldestIndexedAt, "2026-10-01T10:00:00Z")
    assert.ok(s.walletScores.has("0xaaa"), "wallet keys are lowercased")
    assert.ok(s.censusTotal > 0)
  })

  it("skips rows with no original pixel count; throws when nothing is usable", () => {
    assert.equal(snapshotFromRows([row(1), row(2, { on_pixels: null })]).livingSupply, 1)
    assert.throws(() => snapshotFromRows([row(1, { on_pixels: null })]), /no living tokens/)
    assert.throws(() => snapshotFromRows([]), /no living tokens/)
  })
})

function fakeDb(rowsFor: (from: number) => IndexRow[], opts: { failAt?: number } = {}) {
  const log = { started: [] as number[], finished: 0, maxInflight: 0, inflight: 0, ranges: [] as Array<[number, number]> }
  const make = () => {
    const q: Record<string, unknown> = {}
    let lo = -1, hi = -1
    const chain = () => q
    q.select = chain; q.eq = chain; q.order = chain
    q.gte = (_c: string, v: number) => { lo = v; return q }
    q.lt = (_c: string, v: number) => { hi = v; return q }
    q.then = (resolve: (v: unknown) => unknown) => {
      log.started.push(lo); log.ranges.push([lo, hi]); log.inflight++; log.maxInflight = Math.max(log.maxInflight, log.inflight)
      return new Promise((r) => setTimeout(r, 5)).then(() => {
        log.inflight--; log.finished++
        return resolve(opts.failAt === lo ? { data: null, error: { message: "boom" } } : { data: rowsFor(lo), error: null })
      })
    }
    return q
  }
  return { db: { from: () => make() } as never, log }
}

describe("fetchIndexRows (parallel id-ranges)", () => {
  it("asks for exactly 10 contiguous ranges covering ids 0..9999, all in flight together", async () => {
    const { db, log } = fakeDb((from) => [row(from), row(from + 1)])
    const rows = await fetchIndexRows(db)
    assert.equal(log.ranges.length, INDEX_TOKEN_SPAN / INDEX_CHUNK)
    assert.deepEqual(log.ranges.map(([a]) => a), [0, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000])
    assert.ok(log.ranges.every(([a, b]) => b - a === INDEX_CHUNK), "each range spans 1000 ids, so it can never exceed the 1000-row cap")
    assert.equal(log.maxInflight, 10, "all ten were running at the same time")
    assert.equal(rows.length, 20)
    assert.deepEqual(rows.map((r) => r.token_id).slice(0, 4), [0, 1, 1000, 1001], "chunk order is preserved")
  })

  it("one failing chunk fails the whole read (never a silently partial census)", async () => {
    const { db } = fakeDb((from) => [row(from)], { failAt: 4000 })
    await assert.rejects(fetchIndexRows(db), /boom/)
  })
})

describe("loadListings (pages in parallel, order kept)", () => {
  const item = (id: number, price: number) => ({ id, attributes: [], listing: { priceEth: price, url: `https://x/${id}` } })
  it("fetches page 1, then pages 2..N together, and keeps cheapest-first order", async () => {
    let inflight = 0, max = 0
    const getPage = async (p: number) => {
      inflight++; max = Math.max(max, inflight)
      await new Promise((r) => setTimeout(r, 5)); inflight--
      return { items: [item(p * 10, p), item(p * 10 + 1, p + 0.5)], total: 600, totalPages: 4, floorPrice: 0.286 }
    }
    const r = await loadListings(getPage)
    assert.deepEqual(r.items.map((x) => x.id), [10, 11, 20, 21, 30, 31, 40, 41])
    assert.equal(max, 3, "pages 2,3,4 ran together (page 1 ran first, alone)")
    assert.equal(r.total, 600)
    assert.equal(r.floorEth, 0.286)
  })

  it("never asks for more than 8 pages, and a single page needs only one request", async () => {
    const asked: number[] = []
    await loadListings(async (p) => { asked.push(p); return { items: [], totalPages: 50 } })
    assert.deepEqual(asked.sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8])
    const one: number[] = []
    await loadListings(async (p) => { one.push(p); return { items: [] } })
    assert.deepEqual(one, [1])
  })

  it("drops listings with no usable price", async () => {
    const r = await loadListings(async () => ({ items: [item(1, 0.3), { id: 2, attributes: [], listing: { priceEth: 0 } }, { id: 3, attributes: [], listing: null }], totalPages: 1 }))
    assert.deepEqual(r.items.map((x) => x.id), [1])
  })
})

const snap = (): MarketSnapshot => ({
  livingSupply: 7226, wallets: 1723, censusTotal: 25873, oldestIndexedAt: "2026-10-04T20:00:00Z", walletScores: new Map(),
  originalPixels: new Map([[1, 600], [2, 700]]), pixelSupply: new Map([[600, 400], [700, 400]]),
})
const baseDeps = (over: Partial<Deps> = {}): Deps => ({
  resolveHolder: async () => ({ address: "0xabc", ens: null, tokenIds: [] }),
  fetchTokens: async () => [],
  fetchListings: async () => ({ items: [], floorEth: 0.286, total: 0 }),
  loadSnapshot: async () => snap(),
  now: () => new Date("2026-10-05T00:00:00Z"),
  ...over,
})

describe("buildBurnBuy overlaps its independent lookups without changing behaviour", () => {
  it("snapshot, listings and holder run at the same time", async () => {
    let inflight = 0, max = 0
    const slow = <T,>(v: T) => async () => { inflight++; max = Math.max(max, inflight); await new Promise((r) => setTimeout(r, 15)); inflight--; return v }
    await buildBurnBuy({ wallet: "0xabc" }, baseDeps({
      loadSnapshot: slow(snap()),
      fetchListings: slow({ items: [], floorEth: 0.286, total: 0 }),
      resolveHolder: slow({ address: "0xabc", ens: null, tokenIds: [] }),
    }))
    assert.equal(max, 3)
  })

  it("no wallet: the holder lookup is never started", async () => {
    let holder = 0
    await buildBurnBuy({}, baseDeps({ resolveHolder: async () => { holder++; return { address: "x", ens: null, tokenIds: [] } } }))
    assert.equal(holder, 0)
  })

  it("error precedence is unchanged: if the index AND the holder fail, the index error wins", async () => {
    await assert.rejects(
      buildBurnBuy({ wallet: "0xabc" }, baseDeps({ loadSnapshot: async () => { throw new Error("db down") }, resolveHolder: async () => { throw new SourceError("holder", "bad", "invalid-input") } })),
      (e: unknown) => e instanceof SourceError && e.source === "index",
    )
  })

  it("an invalid wallet still reports as invalid input when everything else is fine", async () => {
    await assert.rejects(
      buildBurnBuy({ wallet: "nope" }, baseDeps({ resolveHolder: async () => { throw new SourceError("holder", "That is not a valid wallet", "invalid-input") } })),
      (e: unknown) => e instanceof SourceError && e.source === "holder" && e.kind === "invalid-input",
    )
  })

  it("a failing listings call is still only a caveat while the answer comes back", async () => {
    const r = await buildBurnBuy({ wallet: "0xabc" }, baseDeps({ fetchListings: async () => { throw new Error("listings down") } }))
    assert.equal(r.sources.listings.ok, false)
    assert.ok(r.wallet)
  })

  it("rejections that are awaited later are not reported as unhandled", async () => {
    const seen: unknown[] = []
    const on = (e: unknown) => seen.push(e)
    process.on("unhandledRejection", on)
    try {
      await assert.rejects(buildBurnBuy({ wallet: "0xabc" }, baseDeps({
        loadSnapshot: async () => { throw new Error("db down") },
        fetchListings: async () => { throw new Error("listings down") },
        resolveHolder: async () => { throw new Error("holder down") },
      })))
      await new Promise((r) => setTimeout(r, 30))
    } finally { process.off("unhandledRejection", on) }
    assert.equal(seen.length, 0)
  })
})
