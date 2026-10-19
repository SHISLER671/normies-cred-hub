// "Pixel score": the song drawn as 1-bit sheet music. Pure. Each part gets a band of rows; every note is a run of
// square pixels (time → x, pitch → y within its band). Used by the share card / PNG download.

import { scoreEvents } from "./timeline"
import type { VoiceScore } from "./types"

export const ROLL_COLS = 120
export const ROLL_ROWS_PER_PART = 8

/** Pixel cells [x, y] for the whole score on a ROLL_COLS × (parts × ROLL_ROWS_PER_PART) grid. */
export function rollCells(score: VoiceScore): Array<[number, number]> {
  const events = scoreEvents(score)
  const cells = new Set<string>()
  score.parts.forEach((_, part) => {
    const mine = events.filter((e) => e.part === part)
    if (!mine.length) return
    const lo = Math.log2(Math.min(...mine.map((e) => e.freq)))
    const hi = Math.log2(Math.max(...mine.map((e) => e.freq)))
    for (const e of mine) {
      const x0 = Math.floor((e.time / score.loopSeconds) * ROLL_COLS)
      const x1 = Math.max(x0, Math.min(ROLL_COLS - 1, Math.floor(((e.time + e.duration) / score.loopSeconds) * ROLL_COLS) - 1))
      const rel = hi > lo ? (Math.log2(e.freq) - lo) / (hi - lo) : 0.5
      const y = part * ROLL_ROWS_PER_PART + (ROLL_ROWS_PER_PART - 2) - Math.round(rel * (ROLL_ROWS_PER_PART - 2))
      for (let x = x0; x <= x1; x++) cells.add(`${x},${y}`)
    }
  })
  return [...cells].map((k) => k.split(",").map(Number) as [number, number])
}

/** The pixel score as an SVG string (ink pixels on transparent, faint lane lines between parts). */
export function rollSvg(score: VoiceScore, ink = "#e3e5e4", lane = "#38393a"): string {
  const rows = Math.max(1, score.parts.length) * ROLL_ROWS_PER_PART
  const d = rollCells(score).map(([x, y]) => `M${x} ${y}h1v1h-1z`).join("")
  let lanes = ""
  for (let p = 1; p < score.parts.length; p++) lanes += `M0 ${p * ROLL_ROWS_PER_PART - 0.5}h${ROLL_COLS}`
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ROLL_COLS} ${rows}" preserveAspectRatio="none" shape-rendering="crispEdges">` +
    `<path d="${lanes}" stroke="${lane}" stroke-width="0.12" fill="none"/><path d="${d}" fill="${ink}"/></svg>`
  )
}
