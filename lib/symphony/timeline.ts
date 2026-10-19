// Score → timed note events. Pure, so the same Normie at the same block always yields the same events.

import type { InstrumentId, VoiceScore } from "./types"

const SEMITONE: Record<string, number> = { C: 0, "C#": 1, D: 2, "D#": 3, E: 4, F: 5, "F#": 6, G: 7, "G#": 8, A: 9, "A#": 10, B: 11 }

/** "A4" → 440, "C#3" → 138.59… Equal temperament, A4 = 440 Hz. Returns null for "rest" or bad input. */
export function noteToFreq(note: string): number | null {
  const m = /^([A-G]#?)(-?\d)$/.exec(note)
  if (!m) return null
  const midi = (Number(m[2]) + 1) * 12 + SEMITONE[m[1]]
  return 440 * Math.pow(2, (midi - 69) / 12)
}

export interface NoteEvent {
  part: number
  instrument: InstrumentId
  /** Seconds from the start of the loop. */
  time: number
  /** Seconds the note is held (before release). */
  duration: number
  freq: number
}

/** Every sounding note in one loop, in time order. Rests advance time but make no event. Clipped to the loop length. */
export function scoreEvents(score: VoiceScore): NoteEvent[] {
  const out: NoteEvent[] = []
  score.parts.forEach((p, part) => {
    let t = p.startOffset
    for (let i = 0; i < p.notes.length; i++) {
      const d = p.durations[i] ?? 0
      const f = noteToFreq(p.notes[i])
      if (f !== null && t < score.loopSeconds) {
        out.push({ part, instrument: p.instrument, time: t, duration: Math.max(0.03, Math.min(d, score.loopSeconds - t)), freq: f })
      }
      t += d
    }
  })
  return out.sort((a, b) => a.time - b.time || a.part - b.part)
}

/**
 * Which pixel column is "playing" at a moment of the loop, for the visualizer playhead.
 * The grid is read left to right over one loop (n columns = n slices of time).
 */
export function playheadColumn(secondsIntoLoop: number, loopSeconds: number, side: number): number {
  if (loopSeconds <= 0 || side <= 0) return 0
  const phase = ((secondsIntoLoop % loopSeconds) + loopSeconds) % loopSeconds
  return Math.min(side - 1, Math.floor((phase / loopSeconds) * side))
}
