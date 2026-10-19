import assert from "node:assert/strict"
import { test } from "node:test"

import { composeScore } from "./compose"
import { ROLL_COLS } from "./roll"
import {
  frameCount,
  frameMicros,
  framePlayhead,
  frameSeconds,
  VIDEO_FPS,
  VIDEO_HEIGHT,
  VIDEO_MAX_SECONDS,
  VIDEO_WIDTH,
  videoLayout,
  videoSeconds,
  type Rect,
} from "./video-layout"

function grid(n: number, seed: number): string {
  let s = ""
  let x = seed
  for (let i = 0; i < n * n; i++) {
    x = (x * 1103515245 + 12345) >>> 0
    s += x % 3 === 0 ? "1" : "0"
  }
  return s
}
const ZULO = { tokenId: 7141, name: "Zulo", pixels: grid(40, 7141), traits: [{ trait_type: "Type", value: "Agent" }, { trait_type: "Age", value: "Young" }] }
const ROOM = [ZULO, { ...ZULO, tokenId: 42, name: "FortyTwo", pixels: grid(40, 42) }, { ...ZULO, tokenId: 1, name: "One", pixels: grid(40, 1) }]

test("frame count: one loop + 2.5 s tail at 30 fps", () => {
  assert.equal(frameCount({ loopSeconds: 20 }), 675) // 22.5 s × 30
  const s = composeScore([ZULO])
  assert.equal(frameCount(s), Math.ceil((s.loopSeconds + 2.5) * VIDEO_FPS))
})

test("timestamps come from the frame index, not the clock", () => {
  assert.equal(frameSeconds(0), 0)
  assert.equal(frameSeconds(30), 1)
  assert.equal(frameMicros(1), 33_333)
  assert.equal(frameMicros(90), 3_000_000)
})

test("playhead walks column 0 → ROLL_COLS−1 across one loop, then clears for the tail", () => {
  const s = composeScore(ROOM)
  const frames = frameCount(s)
  const cols: number[] = []
  let tailStarted = false
  for (let f = 0; f < frames; f++) {
    const c = framePlayhead(f, s)
    if (c === null) {
      tailStarted = true
      continue
    }
    assert.equal(tailStarted, false, "playhead must not come back after the loop ends")
    if (cols.length) assert.ok(c >= cols[cols.length - 1], "playhead never moves backwards")
    cols.push(c)
  }
  assert.equal(cols[0], 0)
  assert.equal(cols[cols.length - 1], ROLL_COLS - 1)
  assert.equal(new Set(cols).size, ROLL_COLS, "every column gets its turn")
  assert.ok(tailStarted)
})

test("60 s cap holds for very long loops", () => {
  assert.equal(videoSeconds({ loopSeconds: 90 }), VIDEO_MAX_SECONDS)
  assert.equal(frameCount({ loopSeconds: 90 }), VIDEO_MAX_SECONDS * VIDEO_FPS)
  assert.equal(frameCount({ loopSeconds: 57.5 }), VIDEO_MAX_SECONDS * VIDEO_FPS)
})

test("frame dimensions are even (H.264 needs it)", () => {
  assert.equal(VIDEO_WIDTH % 2, 0)
  assert.equal(VIDEO_HEIGHT % 2, 0)
  assert.equal(VIDEO_WIDTH, 1280)
  assert.equal(VIDEO_HEIGHT, 720)
})

test("every rect is whole pixels and fits inside 1280×720 (solo, room, full room, max parts)", () => {
  const inside = (r: Rect, label: string) => {
    for (const v of [r.x, r.y, r.w, r.h]) assert.ok(Number.isInteger(v), `${label} not whole pixels`)
    assert.ok(r.x >= 0 && r.y >= 0 && r.w > 0 && r.h > 0, `${label} empty or negative`)
    assert.ok(r.x + r.w <= VIDEO_WIDTH && r.y + r.h <= VIDEO_HEIGHT, `${label} outside the frame`)
  }
  const solo = composeScore([ZULO])
  const room = composeScore(ROOM)
  for (const [faces, parts, title] of [
    [1, solo.parts.length, "ZULO"],
    [3, room.parts.length, "3 NORMIES"],
    [12, 18, "12 NORMIES"],
    [1, 18, "A VERY LONG NORMIE NAME"],
  ] as const) {
    const L = videoLayout(faces, parts, title)
    inside(L.tag, "tag")
    inside(L.blockLabel, "block")
    L.faces.forEach((r, i) => inside(r, `face ${i}`))
    if (L.more) inside(L.more, "+N")
    inside(L.title, "title")
    inside(L.subtitle, "subtitle")
    inside(L.divider, "divider")
    inside(L.roll, "roll")
    assert.equal(L.roll.w, L.cellW * ROLL_COLS)
    assert.equal(L.roll.h, L.cellH * L.rollRows)
    assert.ok(L.faces.length <= 6)
    assert.equal(L.more !== null, faces > 6)
    for (const f of L.faces) assert.equal(f.w % 40, 0, "40×40 faces scale by whole pixels")
    assert.ok(L.roll.y > L.divider.y && L.divider.y > L.faces[0].y + L.faces[0].h)
  }
})
