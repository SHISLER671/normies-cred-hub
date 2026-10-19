import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { test } from "node:test"

import { composeScore, gridSide } from "./compose"
import { noteToFreq, playheadColumn, scoreEvents } from "./timeline"
import { encodeWav } from "./wav"

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

test("same Normie in → same song out (deterministic)", () => {
  assert.deepEqual(composeScore([ZULO]), composeScore([ZULO]))
})

test("a different pixel grid changes the song", () => {
  const a = composeScore([ZULO])
  const b = composeScore([{ ...ZULO, pixels: grid(40, 1) }])
  assert.notDeepEqual(a.parts.map((p) => p.notes), b.parts.map((p) => p.notes))
})

test("solo is a full arrangement: pad, bass, lead, harmony, arp", () => {
  const s = composeScore([ZULO])
  assert.deepEqual(s.parts.map((p) => p.role), ["pad", "bass", "primary", "harmony", "arp"])
  assert.equal(s.scale, "phrygian")
  assert.ok(s.bpm >= 72 && s.bpm <= 108)
  assert.equal(s.source, "onchain")
})

test("enlarged grids work (40, 50 … 80); non-square strings are refused", () => {
  for (const n of [40, 50, 60, 70, 80]) {
    assert.equal(gridSide(grid(n, n)), n)
    assert.ok(composeScore([{ ...ZULO, pixels: grid(n, n) }]).parts.length === 5)
  }
  assert.throws(() => gridSide("0101010"), RangeError)
})

test("the score and its video never read Pulse or trust: only pixels, traits and token id shape them", () => {
  for (const file of ["compose.ts", "awakened.ts", "video.ts", "video-layout.ts"]) {
    const src = fs.readFileSync(path.join(__dirname, file), "utf8").replace(/\/\/.*$/gm, "")
    // ("arp-pulse" is a synth sound, not the Pulse score.)
    assert.doesNotMatch(src, /pulse_level|pulseGate|\btrust\b|record-card|agent-pulse|getAgentPulse/i, file)
  }
})

test("notes map to equal-tempered frequencies", () => {
  assert.equal(noteToFreq("A4"), 440)
  assert.ok(Math.abs((noteToFreq("C4") ?? 0) - 261.6256) < 0.001)
  assert.equal(noteToFreq("rest"), null)
})

test("events stay inside one loop and are time-ordered", () => {
  const s = composeScore([ZULO])
  const ev = scoreEvents(s)
  assert.ok(ev.length > 30)
  for (let i = 0; i < ev.length; i++) {
    assert.ok(ev[i].time >= 0 && ev[i].time < s.loopSeconds)
    if (i) assert.ok(ev[i].time >= ev[i - 1].time)
  }
})

test("playhead walks the columns left to right over one loop", () => {
  assert.equal(playheadColumn(0, 20, 40), 0)
  assert.equal(playheadColumn(10, 20, 40), 20)
  assert.equal(playheadColumn(19.99, 20, 40), 39)
  assert.equal(playheadColumn(20, 20, 40), 0)
})

test("WAV header is valid 16-bit stereo PCM", () => {
  const w = encodeWav([new Float32Array([0, 1, -1]), new Float32Array([0, 0.5, -0.5])], 44100)
  const v = new DataView(w.buffer)
  assert.equal(String.fromCharCode(...w.slice(0, 4)), "RIFF")
  assert.equal(String.fromCharCode(...w.slice(8, 12)), "WAVE")
  assert.equal(v.getUint16(22, true), 2)
  assert.equal(v.getUint32(24, true), 44100)
  assert.equal(v.getUint32(40, true), 3 * 4)
  assert.equal(v.getInt16(44 + 4, true), 0x7fff)
})

test("pixel score: every cell inside its part's band, deterministic", async () => {
  const { rollCells, ROLL_COLS, ROLL_ROWS_PER_PART } = await import("./roll")
  const s = composeScore([ZULO])
  const cells = rollCells(s)
  assert.ok(cells.length > 50)
  for (const [x, y] of cells) {
    assert.ok(x >= 0 && x < ROLL_COLS)
    assert.ok(y >= 0 && y < s.parts.length * ROLL_ROWS_PER_PART)
  }
  assert.deepEqual(rollCells(s), rollCells(composeScore([ZULO])))
})

test("a room layers several Normies: primary keeps its band, others answer", () => {
  const room = composeScore([ZULO, { ...ZULO, tokenId: 1, name: "One", pixels: grid(40, 1) }, { ...ZULO, tokenId: 42, name: "FortyTwo", pixels: grid(40, 42) }])
  assert.equal(room.parts[2].tokenId, 7141)
  assert.ok(room.parts.some((p) => p.tokenId === 1) && room.parts.some((p) => p.tokenId === 42))
  assert.match(room.synopsis, /3 Normies/)
})
