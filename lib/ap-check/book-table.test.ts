import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { bookRows, PIXEL_MARKET_URL } from "./book-table"

const BOOK = [
  { priceEth: 0.0175, remaining: 143, partialRemaining: 143 },
  { priceEth: 0.0169, remaining: 5, partialRemaining: 5 },
  { priceEth: 0.017, remaining: 2, partialRemaining: 0 },
]

describe("Pixel Market book table", () => {
  it("cheapest first, with running pixels and running cost", () => {
    const r = bookRows(BOOK)
    assert.deepEqual(r.map((x) => x.priceEth), [0.0169, 0.017, 0.0175])
    assert.deepEqual(r.map((x) => x.runningPixels), [5, 7, 150])
    assert.equal(r[1].runningCostEth, 0.1185) // 5 × 0.0169 + 2 × 0.017
    assert.equal(r[2].runningCostEth, 2.621) // + 143 × 0.0175
  })

  it("marks the levels you would buy through to get what you asked for", () => {
    assert.deepEqual(bookRows(BOOK, 3).map((x) => x.needed), [true, false, false])
    assert.deepEqual(bookRows(BOOK, 6).map((x) => x.needed), [true, true, false])
    assert.deepEqual(bookRows(BOOK, 7).map((x) => x.needed), [true, true, false])
    assert.deepEqual(bookRows(BOOK, 8).map((x) => x.needed), [true, true, true])
    assert.deepEqual(bookRows(BOOK, 9999).map((x) => x.needed), [true, true, true])
    assert.deepEqual(bookRows(BOOK).map((x) => x.needed), [false, false, false])
    assert.deepEqual(bookRows(BOOK, 0).map((x) => x.needed), [false, false, false])
  })

  it("shows how many pixels at a price must be bought as a whole listing", () => {
    assert.deepEqual(bookRows(BOOK).map((x) => x.wholeOnly), [0, 2, 0])
  })

  it("skips junk levels and handles an empty or missing book", () => {
    assert.deepEqual(bookRows(null), [])
    assert.deepEqual(bookRows([]), [])
    const r = bookRows([{ priceEth: 0, remaining: 5, partialRemaining: 5 }, { priceEth: NaN, remaining: 1, partialRemaining: 1 }, { priceEth: 0.02, remaining: 0, partialRemaining: 0 }, { priceEth: 0.02, remaining: 4, partialRemaining: 4 }])
    assert.equal(r.length, 1)
    assert.equal(r[0].pixels, 4)
  })

  it("links to the official Pixel Market, never to a buy flow on NCH", () => {
    assert.equal(PIXEL_MARKET_URL, "https://www.normies.art/lab/pixel-market")
  })
})
