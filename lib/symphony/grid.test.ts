import assert from "node:assert/strict"
import { test } from "node:test"

import { composeScore } from "./compose"
import { isPlayableGrid, MAX_GRID_SIDE, VIEW_MAX_SIDE, viewGrid } from "./grid"
import { rollCells } from "./roll"

function grid(n: number, seed: number): string {
  let s = ""
  let x = seed
  for (let i = 0; i < n * n; i++) {
    x = (x * 1103515245 + 12345) >>> 0
    s += x % 3 === 0 ? "1" : "0"
  }
  return s
}

test("Normie-sized grids (40–80) are drawn as they are", () => {
  for (const n of [40, 50, 60, 70, 80]) {
    const g = grid(n, n)
    assert.deepEqual(viewGrid(g), { pixels: g, side: n, scale: 1 })
  }
  assert.equal(VIEW_MAX_SIDE, 80)
})

test("a 256×256 canvas is sampled down by a whole factor to fit (256 → 64)", () => {
  const v = viewGrid(grid(256, 7))
  assert.equal(v.side, 64)
  assert.equal(v.scale, 4)
  assert.equal(v.pixels.length, 64 * 64)
  assert.match(v.pixels, /^[01]+$/)
  // Odd sizes round up so nothing is cut off: 100 → factor 2 → 50.
  assert.equal(viewGrid(grid(100, 1)).side, 50)
  // A face box smaller than the grid (e.g. 80 px tile, 256 grid) fits inside it.
  assert.ok(viewGrid(grid(256, 3), 80).side <= 80)
})

test("thin one-pixel lines survive the downsample; an empty canvas stays empty", () => {
  const n = 256
  let g = ""
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) g += y === 130 ? "1" : "0"
  const v = viewGrid(g)
  const row = Math.floor(130 / v.scale)
  assert.equal(v.pixels.slice(row * v.side, row * v.side + v.side), "1".repeat(v.side))
  assert.equal(v.pixels.replace(/0/g, "").length, v.side)
  assert.equal(viewGrid("0".repeat(n * n)).pixels, "0".repeat(64 * 64))
})

test("Symphony plays square grids up to 256×256 and refuses anything else", () => {
  assert.equal(MAX_GRID_SIDE, 256)
  assert.ok(isPlayableGrid(grid(40, 1)))
  assert.ok(isPlayableGrid(grid(256, 1)))
  assert.ok(!isPlayableGrid("0".repeat(257 * 257)))
  assert.ok(!isPlayableGrid("0101010"))
  assert.ok(!isPlayableGrid(""))
  assert.throws(() => viewGrid("0101010"), RangeError)
})

test("the composer reads every pixel of a 256×256 canvas: deterministic, full song, and quick", () => {
  const big = { tokenId: 1, name: "Canvas", pixels: grid(256, 256), traits: [{ trait_type: "Type", value: "Human" }] }
  const t0 = Date.now()
  const s = composeScore([big])
  assert.ok(Date.now() - t0 < 1000, "composing a 256×256 grid should take well under a second")
  assert.deepEqual(s, composeScore([big]))
  assert.equal(s.parts.length, 5)
  assert.ok(rollCells(s).length > 50)
  // Flipping ONE pixel near the bottom-right still changes the song: the whole canvas seeds it, not just a corner.
  const i = 250 * 256 + 250
  const flipped = big.pixels.slice(0, i) + (big.pixels[i] === "1" ? "0" : "1") + big.pixels.slice(i + 1)
  assert.notDeepEqual(composeScore([{ ...big, pixels: flipped }]).parts.map((p) => p.notes), s.parts.map((p) => p.notes))
})

test("Normie-sized songs did not change: same key, tempo and parts as before big-grid support", async () => {
  const { hashString } = await import("./compose")
  const zulo = { tokenId: 7141, name: "Zulo", pixels: grid(40, 7141), traits: [{ trait_type: "Type", value: "Agent" }, { trait_type: "Age", value: "Young" }] }
  const one = { tokenId: 1, name: "One", pixels: grid(80, 1), traits: [{ trait_type: "Type", value: "Human" }] }
  // Values recorded from main before this change (b7667f6). If these move, every shared link would sound different.
  const solo = composeScore([zulo])
  assert.deepEqual([solo.root, solo.scale, solo.bpm, hashString(JSON.stringify(solo.parts))], ["G#", "phrygian", 97, 3311029886])
  const room = composeScore([zulo, one])
  assert.deepEqual([room.root, room.scale, room.bpm, hashString(JSON.stringify(room.parts))], ["D#", "phrygian", 97, 3797235664])
})
