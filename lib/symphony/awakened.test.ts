import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { test } from "node:test"

import { AWAKENED_GAIN, parseBinding } from "./awakened"
import { composeScore } from "./compose"
import { scoreEvents } from "./timeline"
import type { NormieVoiceInput, VoicePart, VoiceScore } from "./types"
import { MAX_AUDIO_PARTS } from "./types"

function grid(n: number, seed: number): string {
  let s = ""
  let x = seed
  for (let i = 0; i < n * n; i++) {
    x = (x * 1103515245 + 12345) >>> 0
    s += x % 3 === 0 ? "1" : "0"
  }
  return s
}

const ZULO_BINDING = { agentId: "32626", blockNumber: 25103790, timestamp: 1778887079 }
const ZULO: NormieVoiceInput = {
  tokenId: 7141,
  name: "Zulo",
  pixels: grid(40, 7141),
  traits: [{ trait_type: "Type", value: "Agent" }, { trait_type: "Age", value: "Young" }],
}
const ONE: NormieVoiceInput = { tokenId: 1, name: "One", pixels: grid(40, 1), traits: [{ trait_type: "Type", value: "Human" }] }
const FORTY_TWO: NormieVoiceInput = { tokenId: 42, name: "FortyTwo", pixels: grid(40, 42), traits: [{ trait_type: "Type", value: "Cat" }] }

const awake = (v: NormieVoiceInput, b = ZULO_BINDING): NormieVoiceInput => ({ ...v, awakened: b })
const regular = (s: VoiceScore): VoicePart[] => s.parts.filter((p) => p.layer !== "awakened")
const layers = (s: VoiceScore): VoicePart[] => s.parts.filter((p) => p.layer === "awakened")

test("parseBinding reads the official shape and refuses everything else", () => {
  const raw = { binding: { agentId: "32626", blockNumber: "25103790", timestamp: "1778887079" } }
  assert.deepEqual(parseBinding(raw, null), ZULO_BINDING)
  assert.deepEqual(parseBinding(raw.binding, null), ZULO_BINDING)
  assert.equal(parseBinding({ binding: null }, null), null)
  assert.equal(parseBinding(null, null), null)
  assert.equal(parseBinding({ binding: { agentId: "0", blockNumber: "1", timestamp: "1" } }, null), null)
  assert.equal(parseBinding({ binding: { agentId: "abc", blockNumber: "1", timestamp: "1" } }, null), null)
  assert.equal(parseBinding({ binding: { agentId: "5", timestamp: "1" } }, null), null)
  assert.equal(parseBinding("<html>", null), null)
})

test("a pinned block before the awakening plays the Normie as it was then: no layers", () => {
  const raw = { binding: { agentId: "32626", blockNumber: "25103790", timestamp: "1778887079" } }
  assert.equal(parseBinding(raw, 25103789), null)
  assert.deepEqual(parseBinding(raw, 25103790), ZULO_BINDING)
})

test("awakening only adds: key, tempo and every regular part are identical with or without it (solo)", () => {
  const plain = composeScore([ZULO])
  const woke = composeScore([awake(ZULO)])
  assert.deepEqual(regular(woke), plain.parts)
  assert.equal(woke.bpm, plain.bpm)
  assert.equal(woke.root, plain.root)
  assert.equal(woke.scale, plain.scale)
  assert.equal(woke.loopSeconds, plain.loopSeconds)
  assert.equal(layers(plain).length, 0)
  assert.deepEqual(layers(woke).map((p) => p.role), ["harmony", "counter"])
})

test("in a room, one awakened Normie never changes anyone else's part, wherever it stands", () => {
  const room = [ZULO, ONE, FORTY_TWO]
  const plain = composeScore(room)
  for (let i = 0; i < room.length; i++) {
    const withOne = room.map((v, j) => (j === i ? awake(v) : v))
    const woke = composeScore(withOne)
    assert.deepEqual(regular(woke), plain.parts, `awake at position ${i}`)
    assert.ok(layers(woke).every((p) => p.tokenId === room[i].tokenId))
  }
})

test("a room of regular Normies gets no extra layers", () => {
  assert.equal(layers(composeScore([ZULO, ONE, FORTY_TWO])).length, 0)
})

test("every Normie awake: each gets a harmony layer, only one counter-melody (fills never stack)", () => {
  const woke = composeScore([awake(ZULO), awake(ONE, { ...ZULO_BINDING, agentId: "1" }), awake(FORTY_TWO, { ...ZULO_BINDING, agentId: "42" })])
  assert.equal(layers(woke).filter((p) => p.role === "harmony").length, 3)
  assert.equal(layers(woke).filter((p) => p.role === "counter").length, 1)
})

test("layers sit ~9 dB under the part they decorate", () => {
  const woke = composeScore([awake(ZULO)])
  const lead = woke.parts[2]
  for (const p of layers(woke)) assert.ok(p.gain <= lead.gain * AWAKENED_GAIN + 1e-9, `${p.role} gain ${p.gain}`)
})

test("a full room of 12 awakened Normies stays under the CPU cap and keeps every regular part", () => {
  const room = Array.from({ length: 12 }, (_, i) => ({ ...ONE, tokenId: 100 + i, pixels: grid(40, 100 + i) }))
  const plain = composeScore(room)
  const woke = composeScore(room.map((v) => awake(v, { ...ZULO_BINDING, agentId: String(v.tokenId) })))
  assert.ok(woke.parts.length <= MAX_AUDIO_PARTS)
  assert.deepEqual(regular(woke), plain.parts)
})

test("each binding field drives one thing: block → echo, agent id → counter, timestamp → fill bar", () => {
  const base = composeScore([awake(ZULO)])
  const [h0, c0] = layers(base)
  const otherBlock = layers(composeScore([awake(ZULO, { ...ZULO_BINDING, blockNumber: ZULO_BINDING.blockNumber + 1 })]))
  assert.notEqual(otherBlock[0].startOffset, h0.startOffset)
  assert.deepEqual(otherBlock[0].notes, h0.notes)
  assert.deepEqual(otherBlock[1], c0)

  const otherAgent = layers(composeScore([awake(ZULO, { ...ZULO_BINDING, agentId: "1" })]))
  assert.deepEqual(otherAgent[0], h0)
  assert.notDeepEqual(otherAgent[1].notes, c0.notes)

  // Some timestamp moves the fill bar (8 bars, so try a few).
  const moved = [1, 2, 3, 4, 5].some((d) => {
    const c = layers(composeScore([awake(ZULO, { ...ZULO_BINDING, timestamp: ZULO_BINDING.timestamp + d })]))[1]
    return JSON.stringify(c.notes) !== JSON.stringify(c0.notes)
  })
  assert.ok(moved)
})

test("awakened layers are valid music: in the song's scale, inside the loop, deterministic", () => {
  const a = composeScore([awake(ZULO)])
  assert.deepEqual(a, composeScore([awake(ZULO)]))
  const ev = scoreEvents(a).filter((e) => a.parts[e.part].layer === "awakened")
  assert.ok(ev.length > 20)
  for (const e of ev) assert.ok(e.time >= 0 && e.time < a.loopSeconds && e.freq > 50 && e.freq < 3000)
  for (const p of layers(a)) {
    const total = p.durations.reduce((x, y) => x + y, 0)
    assert.equal(p.notes.length, p.durations.length)
    assert.ok(total > a.loopSeconds * 0.8 && total < a.loopSeconds * 1.2, `${p.role} length ${total}`)
  }
})

test("awakened code never reads Pulse, persona, canvas progress or any ordering of agents", () => {
  const src = fs.readFileSync(path.join(__dirname, "awakened.ts"), "utf8").replace(/\/\/.*$/gm, "")
  assert.doesNotMatch(src, /agentOrder|agentTotal|\brank|\blevel\b|actionPoints|persona|pulse_level|pulseGate|\btrust\b|record-card|agent-pulse/i)
})
