import { describe, it } from "node:test"
import assert from "node:assert/strict"

import {
  bracketMultiplier,
  boostFor,
  walletScore,
  shareIfAdded,
  promoBurnYield,
} from "./score"

const close = (a: number, b: number, eps = 0.051) => assert.ok(Math.abs(a - b) <= eps, `${a} vs ${b}`)

describe("bracket multiplier", () => {
  it("matches the article's table at every edge", () => {
    const cases: Array<[number, number]> = [
      [0, 0], [1, 1.0], [2, 1.15], [4, 1.15], [5, 1.3], [9, 1.3],
      [10, 1.45], [24, 1.45], [25, 1.6], [49, 1.6], [50, 1.75], [200, 1.75],
    ]
    for (const [held, mult] of cases) assert.equal(bracketMultiplier(held), mult, `held ${held}`)
  })
})

describe("boost cliffs", () => {
  it("jumps exactly at 15 / 100 / 500 / 1500", () => {
    const cases: Array<[number, number]> = [
      [0, 0], [14, 0], [15, 0.15], [99, 0.15], [100, 0.35], [499, 0.35],
      [500, 0.6], [1499, 0.6], [1500, 1.0], [99999, 1.0],
    ]
    for (const [px, boost] of cases) assert.equal(boostFor(px), boost, `#PIXEL ${px}`)
  })
})

describe("walletScore reproduces the article's published table", () => {
  const rows: Array<[number, number, number]> = [
    [0, 1000, 0], // no Normie => no share
    [1, 0, 1.0],
    [1, 15, 4.6],
    [5, 0, 6.5],
    [5, 100, 35.8],
    [10, 0, 14.5],
    [10, 500, 183.2],
    [25, 0, 40.0],
    [25, 1500, 680.0],
    [50, 0, 87.5],
    [50, 1500, 775.0],
    [100, 5000, 2350.0],
  ]
  for (const [held, px, expected] of rows) {
    it(`${held} Normies + ${px} #PIXEL = ${expected}`, () => close(walletScore(held, px), expected))
  }
  it("10 Normies + 500 #PIXEL is 0.717% of a 25,359-point census", () => {
    close(shareIfAdded(walletScore(10, 500), 25359) * 100, 0.717, 0.0006)
  })
  it("the 10th Normie adds 2.8 points, not 1 (bracket lifts the whole stack)", () => {
    close(walletScore(10, 0) - walletScore(9, 0), 2.8, 0.001)
  })
  it("splitting 10 Normies as 5+5 scores 13, not 14.5", () => {
    close(walletScore(5, 0) + walletScore(5, 0), 13, 0.001)
    close(walletScore(10, 0), 14.5, 0.001)
  })
})

describe("promoBurnYield matches real on-chain burns", () => {
  // [commit, original pixels, burned token's AP, AP the chain actually awarded]
  const chain: Array<[number, number, number, number]> = [
    [997, 588, 0, 23],
    [994, 525, 0, 21], // 525 * 4% = 21.0 exactly: float math is the classic trap here
    [993, 779, 0, 31],
    [990, 719, 22, 50], // 28 from pixels + 22 transferred
    [983, 501, 294, 314], // 20 + 294
  ]
  for (const [commit, px, ap, awarded] of chain) {
    it(`commit ${commit}: ${px} px + ${ap} AP => ${awarded}`, () => {
      assert.equal(promoBurnYield(px, ap).total, awarded)
    })
  }
  it("400 px pays 16, 600 px pays 24, 1000 px pays 40 (the article's promo table)", () => {
    assert.equal(promoBurnYield(400, 0).total, 16)
    assert.equal(promoBurnYield(600, 0).total, 24)
    assert.equal(promoBurnYield(1000, 0).total, 40)
  })
  it("burned token's whole AP balance moves (token #9309: 1,498 transferred)", () => {
    assert.equal(promoBurnYield(310, 1498).transferred, 1498)
  })
})
