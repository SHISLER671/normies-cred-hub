import { describe, it } from "node:test"
import assert from "node:assert/strict"

import { adviseWallet } from "./advise"
import { snapshotFromRows } from "./data"
import { loosePixelsOf, parseHoldersPage } from "./pixel-holders"
import { walletScore } from "./score"

// Shapes as api.normies.art returned them on 2026-10-06.
const ME = { address: "0xfafd8fb6b4e43ace0e365553f1b9242384591031", balance: "12", wallet: "0", listed: "0", attached: "12", normiesWithPixels: 1 }
const TRADER = { address: "0x1111111111111111111111111111111111111111", balance: "130", wallet: "40", listed: "60", attached: "30", updatedBlock: "0" }

describe("loose #PIXEL from /pixels/holders", () => {
  it("is wallet + listed (attached is read elsewhere)", () => {
    assert.deepEqual(loosePixelsOf(TRADER), { address: TRADER.address, loose: 100 })
    assert.deepEqual(loosePixelsOf(ME), { address: ME.address, loose: 0 })
  })
  it("refuses rows that are not the documented shape", () => {
    assert.equal(loosePixelsOf({ ...TRADER, wallet: "-1" }), null)
    assert.equal(loosePixelsOf({ ...TRADER, address: "nope" }), null)
    assert.equal(loosePixelsOf(null), null)
  })
  it("parses a page and its hasMore flag", () => {
    const p = parseHoldersPage({ holders: [ME, TRADER, { junk: true }], hasMore: true })
    assert.equal(p?.rows.length, 2)
    assert.equal(p?.hasMore, true)
    assert.equal(parseHoldersPage({ items: [] }), null)
  })
})

describe("every #PIXEL counts the same (normies.art revenue share rules)", () => {
  const ctx = { livingSupply: 7000, censusTotal: 10_000, yieldMode: "normal" as const }
  const tok = { tokenId: 1, originalPixels: 500, actionPoints: 30, rank: 100, type: "Human", awakenedAgent: false, pixelSupply: 10, forgoneValueEth: 0.3, customized: false }
  it("a wallet's score includes its loose pixels", () => {
    const withLoose = adviseWallet([tok], [], ctx, 100)
    assert.equal(withLoose.pixel, 130)
    assert.equal(withLoose.score, walletScore(1, 130))
    assert.equal(adviseWallet([tok], [], ctx).pixel, 30)
  })
  it("the census adds each holder's loose pixels", () => {
    const rows = [{ token_id: 1, owner: TRADER.address, action_points: 30, on_pixels: 500, indexed_at: "2026-10-06T00:00:00Z" }]
    const plain = snapshotFromRows(rows)
    const counted = snapshotFromRows(rows, undefined, new Map([[TRADER.address, 100]]))
    assert.equal(plain.censusTotal, walletScore(1, 30))
    assert.equal(counted.censusTotal, walletScore(1, 130))
  })
})
