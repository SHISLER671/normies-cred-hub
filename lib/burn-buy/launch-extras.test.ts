import { describe, it } from "node:test"
import assert from "node:assert/strict"

import { adviseWallet, type HeldToken, type Listing } from "./advise"
import { keyedTtl } from "./data"

const ctx = { livingSupply: 7226, censusTotal: 25873 }
const tok = (over: Partial<HeldToken> & { tokenId: number }): HeldToken => ({
  originalPixels: 600, actionPoints: 0, rank: 4000, type: "Human", awakenedAgent: false, pixelSupply: 100, forgoneValueEth: 0.29, ...over,
})
const listing = (over: Partial<Listing> & { tokenId: number }): Listing => ({
  priceEth: 0.3, actionPoints: 0, originalPixels: 900, rank: 4000, type: "Human", awakenedAgent: false, pixelSupply: 100, ...over,
})
const anchor = (tokenId: number) => tok({ tokenId, awakenedAgent: true })

describe("ranking: free is best, unknown is last (they are not the same thing)", () => {
  it("an own burn that is KNOWN to cost nothing is still ranked first", () => {
    const w = adviseWallet([tok({ tokenId: 1, forgoneValueEth: 0 }), anchor(3)], [listing({ tokenId: 10 })], ctx)
    assert.equal(w.moves[0].kind, "burn-own")
    assert.equal(w.moves[0].costKnown, true)
    assert.equal(w.moves[0].costEth, 0)
  })
  it("an own burn with an UNKNOWN cost is ranked after every priced move", () => {
    const w = adviseWallet([tok({ tokenId: 1, forgoneValueEth: null }), anchor(3)], [listing({ tokenId: 10 })], ctx)
    const unknownAt = w.moves.findIndex((m) => m.costKnown === false)
    assert.ok(unknownAt > 0, "the unknown-cost burn must not lead")
    assert.ok(w.moves.slice(0, unknownAt).every((m) => m.costKnown !== false))
  })
})

describe("keyedTtl", () => {
  it("shares one load between concurrent callers and reuses it within the window", async () => {
    let loads = 0
    let t = 0
    const get = keyedTtl(1000, 10, async () => { loads++; return "v" }, () => t)
    await Promise.all([get("a"), get("a"), get("a")])
    t = 999
    await get("a")
    assert.equal(loads, 1)
  })
  it("loads again once the window has passed, and keeps keys apart", async () => {
    let loads = 0
    let t = 0
    const get = keyedTtl(1000, 10, async (k) => { loads++; return k }, () => t)
    await get("a"); await get("b")
    assert.equal(loads, 2)
    t = 1001
    await get("a")
    assert.equal(loads, 3)
  })
  it("never keeps a FAILED load: the next caller tries again", async () => {
    let loads = 0
    const get = keyedTtl(60_000, 10, async () => { loads++; if (loads === 1) throw new Error("rpc down"); return "ok" })
    await assert.rejects(get("a"), /rpc down/)
    await new Promise((r) => setImmediate(r))
    assert.equal(await get("a"), "ok")
    assert.equal(loads, 2)
  })
  it("empties itself at the size cap instead of growing forever", async () => {
    let loads = 0
    const get = keyedTtl(60_000, 2, async () => { loads++; return 1 })
    await get("a"); await get("b"); await get("c")
    await get("a")
    assert.equal(loads, 4)
  })
})
