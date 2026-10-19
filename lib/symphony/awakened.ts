// Pixel Symphony: Awakened voices. Awakened Normies make MORE music, not better music (Ryan, 2026-10-19).
// A regular Normie's part never changes; an awakened one adds quiet layers on top. Pure (no audio, no network).
//
// "Awakened" = an ERC-8004 binding from the official API (GET /agents/binding/{id}), the same source as the record
// card. Only three awakened-only fields are used, each for one musical choice:
//   binding.blockNumber → echo: the harmony line enters 1/8 or a dotted 1/8 behind (block parity)
//   binding.agentId     → counter-melody: which steps it plays and where it starts
//   binding.timestamp   → fill bar: the one bar per loop where the counter-melody plays a full run
// Nothing here may read Pulse, persona text, canvas progress or any ordering of agents: that would turn the music into
// a ladder, and every Normie already plays a full part.

import type { AwakenedBinding, VoicePart } from "./types"

/** Awakened layers sit about 9 dB under the part they decorate (10^(-9/20) ≈ 0.355). */
export const AWAKENED_GAIN = 0.355

const ROOTS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

function hash(input: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

function toInt(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN
  return Number.isFinite(n) && Number.isInteger(n) ? n : null
}

/**
 * Read an /agents/binding/{id} response ({ binding: {...} } or the binding itself). Returns null for a regular Normie,
 * for anything malformed, and, when `atBlock` is given, for a Normie that was awakened after that block (so a pinned
 * share link keeps sounding the way it did at its block).
 */
export function parseBinding(raw: unknown, atBlock: number | null): AwakenedBinding | null {
  const b = raw && typeof raw === "object" && "binding" in raw ? (raw as { binding: unknown }).binding : raw
  if (!b || typeof b !== "object") return null
  const r = b as Record<string, unknown>
  const agentId = toInt(r.agentId)
  const blockNumber = toInt(r.blockNumber)
  const timestamp = toInt(r.timestamp)
  if (agentId === null || agentId <= 0 || blockNumber === null || blockNumber <= 0 || timestamp === null || timestamp <= 0) return null
  if (atBlock !== null && blockNumber > atBlock) return null
  return { agentId: String(agentId), blockNumber, timestamp }
}

type Pitch = { pc: number; octave: number }

function parseNote(note: string): Pitch | null {
  const m = /^([A-G]#?)(-?\d)$/.exec(note)
  if (!m) return null
  return { pc: ROOTS.indexOf(m[1]), octave: Number(m[2]) }
}

function midi(p: Pitch): number {
  return (p.octave + 1) * 12 + p.pc
}

/** Move a note `steps` scale degrees up (or down), wrapping octaves. Off-scale notes come back unchanged. */
function shiftInScale(note: string, steps: number, rootIndex: number, degrees: number[]): string {
  const p = parseNote(note)
  if (!p) return note
  const rel = (p.pc - rootIndex + 12) % 12
  const idx = degrees.indexOf(rel)
  if (idx < 0) return note
  const len = degrees.length
  const total = idx + steps
  const wrapped = ((total % len) + len) % len
  const target = midi(p) - rel + 12 * Math.floor(total / len) + degrees[wrapped]
  return midiName(target)
}

function midiName(m: number): string {
  return `${ROOTS[((m % 12) + 12) % 12]}${Math.floor(m / 12) - 1}`
}

/** Pitch (midi) sounding at each eighth-note step of the loop, or null in a rest. */
function stepPitches(part: VoicePart, step: number, steps: number): Array<number | null> {
  const out: Array<number | null> = []
  for (let s = 0; s < steps; s++) {
    const t = s * step - part.startOffset
    let at = 0
    let found: number | null = null
    for (let i = 0; i < part.notes.length; i++) {
      const d = part.durations[i] ?? 0
      if (t >= at && t < at + d) {
        const p = parseNote(part.notes[i])
        found = p ? midi(p) : null
        break
      }
      at += d
    }
    out.push(found)
  }
  return out
}

export interface AwakenedContext {
  rootIndex: number
  /** Semitone offsets of the song's scale (e.g. phrygian [0, 1, 3, 5, 7, 8, 10]). */
  degrees: number[]
  bpm: number
  loopSeconds: number
}

/**
 * Layer A, every awakened Normie: its own part, two scale steps up (a third), quiet, entering a 1/8 (even binding
 * block) or dotted 1/8 (odd) behind, like an echo answering itself.
 */
export function awakenedHarmony(main: VoicePart, b: AwakenedBinding, ctx: AwakenedContext): VoicePart {
  const beat = 60 / ctx.bpm
  const echo = b.blockNumber % 2 === 0 ? beat / 2 : beat * 0.75
  return {
    ...main,
    role: "harmony",
    instrument: "glass-keys",
    notes: main.notes.map((n) => (n === "rest" ? n : shiftInScale(n, 2, ctx.rootIndex, ctx.degrees))),
    durations: [...main.durations],
    gain: main.gain * AWAKENED_GAIN,
    pan: Math.max(-0.7, Math.min(0.7, -main.pan * 0.8)),
    reverbSend: Math.min(0.65, main.reverbSend + 0.15),
    delaySend: Math.min(0.4, main.delaySend + 0.1),
    startOffset: main.startOffset + echo,
    layer: "awakened",
  }
}

/**
 * Layer B, one per room (the first awakened Normie, so fills never stack): a sparse counter-melody that moves the
 * opposite way to its part, bar by bar, plus one full-run fill bar per loop. agentId picks the steps and the starting
 * note; timestamp picks the fill bar.
 */
export function awakenedCounter(main: VoicePart, b: AwakenedBinding, ctx: AwakenedContext): VoicePart {
  const step = 60 / ctx.bpm / 2
  const steps = 64
  const pitches = stepPitches(main, step, steps)
  const barMean = (bar: number) => {
    const xs = pitches.slice(bar * 8, bar * 8 + 8).filter((x): x is number => x !== null)
    return xs.length ? xs.reduce((a, c) => a + c, 0) / xs.length : null
  }
  const pattern = hash(`agent:${b.agentId}`)
  const fillBar = hash(`awake:${b.timestamp}`) % 8
  const len = ctx.degrees.length
  let degree = pattern % len
  let octave = 3

  const notes: string[] = []
  const durations: number[] = []
  for (let s = 0; s < steps; s++) {
    const bar = Math.floor(s / 8)
    const inFill = bar === fillBar
    // Sparse: roughly one step in four, chosen by the agent id's bits; the fill bar plays every step.
    const plays = inFill || ((pattern >>> (s % 32)) & 1) === 1 && s % 2 === 0
    if (!plays) {
      notes.push("rest")
      durations.push(step)
      continue
    }
    const now = barMean(bar)
    const before = bar > 0 ? barMean(bar - 1) : null
    // Opposite direction to the part it decorates: it rose → step down, it fell → step up.
    const dir = now !== null && before !== null && now !== before ? (now > before ? -1 : 1) : s % 4 === 0 ? 1 : -1
    degree += dir
    if (degree >= len) {
      degree -= len
      octave = Math.min(4, octave + 1)
    } else if (degree < 0) {
      degree += len
      octave = Math.max(2, octave - 1)
    }
    const pc = (ctx.rootIndex + ctx.degrees[degree]) % 12
    const oct = octave + (ctx.rootIndex + ctx.degrees[degree] >= 12 ? 1 : 0)
    notes.push(`${ROOTS[pc]}${oct}`)
    durations.push(step * (inFill ? 0.9 : 1.6))
    if (!inFill) {
      // A held counter note takes two steps: 1.6 sounding + 0.4 rest.
      notes.push("rest")
      durations.push(step * 0.4)
      s++
    }
  }

  return {
    role: "counter",
    instrument: "alien-bell",
    notes,
    durations,
    filterHz: Math.min(2200, main.filterHz),
    gain: main.gain * AWAKENED_GAIN * 0.85,
    attack: 0.01,
    decay: 0.25,
    sustain: 0.15,
    release: 0.6,
    pan: Math.max(-0.7, Math.min(0.7, main.pan * -0.5 + 0.2)),
    reverbSend: 0.45,
    delaySend: 0.2,
    tokenId: main.tokenId,
    startOffset: main.startOffset,
    layer: "awakened",
  }
}
