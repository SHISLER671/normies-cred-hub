import { describe, it } from "node:test"
import assert from "node:assert/strict"

import { rankFodder, type Listing } from "./advise"
import { cliffSentences } from "./narrate"
import { boostFor, bracketMultiplier, cliffStatus } from "./score"

describe("cliffStatus", () => {
  it("reports the cushion above the boost line you stand on and what dropping costs", () => {
    const c = cliffStatus(3, 120)
    assert.deepEqual(c.pixel.floor, { at: 100, spare: 20, dropsTo: 0.15 })
    assert.deepEqual(c.pixel.next, { at: 500, needMore: 380, value: 0.6 })
    assert.equal(c.pixel.now, boostFor(120))
  })
  it("sits exactly on a line with no cushion", () => {
    const c = cliffStatus(5, 100)
    assert.equal(c.pixel.floor?.spare, 0)
    assert.deepEqual(c.normies.floor, { at: 5, spare: 0, dropsTo: 1.15 })
    assert.equal(c.normies.now, bracketMultiplier(5))
  })
  it("has no floor below the first boost and no next at the top", () => {
    assert.equal(cliffStatus(2, 10).pixel.floor, null)
    assert.deepEqual(cliffStatus(2, 10).pixel.next, { at: 15, needMore: 5, value: 0.15 })
    const top = cliffStatus(60, 2000)
    assert.equal(top.pixel.next, null)
    assert.equal(top.normies.next, null)
    assert.equal(top.pixel.floor?.at, 1500)
  })
  it("one Normie drops to zero (no membership), never to a lower bracket", () => {
    assert.deepEqual(cliffStatus(1, 0).normies.floor, { at: 1, spare: 0, dropsTo: 0 })
  })
  it("agrees with the score ladders at every edge", () => {
    for (const held of [1, 2, 4, 5, 9, 10, 24, 25, 49, 50, 80]) {
      const f = cliffStatus(held, 0).normies.floor!
      assert.equal(bracketMultiplier(f.at), bracketMultiplier(held))
      if (f.at > 1) assert.equal(bracketMultiplier(f.at - 1), f.dropsTo)
    }
    for (const px of [15, 99, 100, 499, 500, 1499, 1500, 4000]) {
      const f = cliffStatus(1, px).pixel.floor!
      assert.equal(boostFor(f.at), boostFor(px))
      assert.equal(boostFor(f.at - 1), f.dropsTo)
    }
  })
  it("survives nonsense input", () => {
    const c = cliffStatus(Number.NaN, -5)
    assert.equal(c.normies.have, 0)
    assert.equal(c.pixel.floor, null)
  })
})

describe("cliffSentences", () => {
  it("warns a seller exactly how much they can sell", () => {
    const text = cliffSentences(cliffStatus(3, 120)).join(" ")
    assert.match(text, /sell or move up to 20 #PIXEL and keep your \+35% boost/)
    assert.match(text, /drops you to \+15% boost/)
    assert.match(text, /still counts until it sells/)
  })
  it("says so when sitting on the line", () => {
    const text = cliffSentences(cliffStatus(5, 100)).join(" ")
    assert.match(text, /exactly on the \+35% boost line \(100 #PIXEL\)\. Selling or spending even 1 drops you to \+15% boost/)
    assert.match(text, /exactly 5 Normies.*drops your whole stack to 1\.15x/)
  })
  it("says nothing for a wallet with no Normies (it scores zero anyway)", () => {
    assert.deepEqual(cliffSentences(cliffStatus(0, 500)), [])
  })
  it("never gives a yes/no verdict or a price", () => {
    const text = cliffSentences(cliffStatus(3, 120)).join(" ")
    assert.doesNotMatch(text, /you should|worth it|ETH/i)
  })
})

describe("ETH per #PIXEL", () => {
  const l = (tokenId: number, priceEth: number, originalPixels: number): Listing => ({
    tokenId, priceEth, actionPoints: 0, originalPixels, rank: 5000, type: "Human", awakenedAgent: false, pixelSupply: 400,
  })
  it("is price divided by pays at the fixed rate", () => {
    const [f] = rankFodder([l(1, 0.29, 700)], { livingSupply: 7226, yieldMode: "promo" }, { withAp: false })
    assert.equal(f.yieldTotal, 28)
    assert.equal(f.ethPerPixel, Math.round((0.29 / 28) * 1e5) / 1e5)
    assert.equal(f.ethPerPixelLow, undefined)
  })
  it("gives a low-to-high range at normal tiers, cheapest = best roll", () => {
    const [f] = rankFodder([l(2, 0.3, 700)], { livingSupply: 7226, yieldMode: "normal" }, { withAp: false })
    assert.ok(f.ethPerPixelLow! < f.ethPerPixel && f.ethPerPixel < f.ethPerPixelHigh!, JSON.stringify(f))
    assert.equal(f.ethPerPixelLow, Math.round((0.3 / f.yieldMax!) * 1e5) / 1e5)
    assert.equal(f.ethPerPixelHigh, Math.round((0.3 / f.yieldMin!) * 1e5) / 1e5)
  })
})
