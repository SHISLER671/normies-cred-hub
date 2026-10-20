// Pixel Symphony: the mycelium view. Pure (no DOM, no network), so it is testable in Node.
// Every Normie in a room is a node; a thread joins two Normies that share traits (the hive mind under the forest), and
// it lights up while both are singing. Threads come ONLY from the Normies' fixed, public traits: no wallets, owners or
// delegates, so the view never links a wallet to anyone and a pinned link always draws the same web.

import type { NoteEvent } from "./timeline"
import type { NormieTrait, VoiceScore } from "./types"

/** Traits that make a thread. The same 8 for every Normie (official GET /normie/{id}/metadata attributes; a Zombie's differ from its mint traits, see lib/normie-traits.ts). */
export const THREAD_TRAITS = ["Type", "Gender", "Age", "Hair Style", "Facial Feature", "Eyes", "Expression", "Accessory"] as const

/** A pair must share at least this many traits to be joined; one shared trait (e.g. both Human) joins almost everyone. */
export const MIN_SHARED = 2

export type MyceliumVoice = { tokenId: number; traits: NormieTrait[] }

export interface MyceliumLink {
  /** Indexes into the room (0 = the lead). */
  a: number
  b: number
  /** The trait names the pair shares, in THREAD_TRAITS order. */
  shared: string[]
}

function traitMap(traits: NormieTrait[]): Map<string, string> {
  const m = new Map<string, string>()
  for (const t of traits) m.set(t.trait_type.toLowerCase(), String(t.value).toLowerCase())
  return m
}

/** Threads between every pair that shares at least MIN_SHARED traits. Deterministic, in room order. */
export function myceliumLinks(voices: MyceliumVoice[]): MyceliumLink[] {
  const maps = voices.map((v) => traitMap(v.traits))
  const out: MyceliumLink[] = []
  for (let a = 0; a < voices.length; a++) {
    for (let b = a + 1; b < voices.length; b++) {
      const shared = THREAD_TRAITS.filter((t) => {
        const x = maps[a].get(t.toLowerCase())
        return x !== undefined && x !== "" && x === maps[b].get(t.toLowerCase())
      })
      if (shared.length >= MIN_SHARED) out.push({ a, b, shared: [...shared] })
    }
  }
  return out
}

export interface Point {
  x: number
  y: number
}

/**
 * Node positions on a w×h pixel canvas: the lead in the centre, the others on a ring around it (whole pixels).
 * One Normie: just the centre.
 */
export function nodeLayout(count: number, w: number, h: number): Point[] {
  const cx = Math.floor(w / 2)
  const cy = Math.floor(h / 2)
  if (count <= 0) return []
  const pts: Point[] = [{ x: cx, y: cy }]
  const ring = count - 1
  const rx = Math.floor(w / 2) - 6
  const ry = Math.floor(h / 2) - 6
  for (let i = 0; i < ring; i++) {
    const ang = -Math.PI / 2 + (i / ring) * Math.PI * 2
    pts.push({ x: Math.round(cx + Math.cos(ang) * rx), y: Math.round(cy + Math.sin(ang) * ry) })
  }
  return pts
}

/** The pixels of a 1-pixel line from p to q (Bresenham), both ends included. */
export function pixelLine(p: Point, q: Point): Point[] {
  const out: Point[] = []
  let x = p.x
  let y = p.y
  const dx = Math.abs(q.x - x)
  const dy = -Math.abs(q.y - y)
  const sx = x < q.x ? 1 : -1
  const sy = y < q.y ? 1 : -1
  let err = dx + dy
  for (;;) {
    out.push({ x, y })
    if (x === q.x && y === q.y) break
    const e2 = 2 * err
    if (e2 >= dy) {
      err += dy
      x += sx
    }
    if (e2 <= dx) {
      err += dx
      y += sy
    }
  }
  return out
}

/**
 * Which room members are singing at `t` seconds into the loop: a member sings when any of its parts has a note
 * sounding then. Returns room indexes. `events` from scoreEvents(score).
 */
export function singingAt(score: VoiceScore, events: NoteEvent[], roomTokenIds: number[], t: number): Set<number> {
  const out = new Set<number>()
  for (const e of events) {
    if (e.time > t) break
    if (t < e.time + e.duration) {
      const idx = roomTokenIds.indexOf(score.parts[e.part]?.tokenId ?? -1)
      if (idx >= 0) out.add(idx)
    }
  }
  return out
}

/** One-line description of the web for screen readers. */
export function myceliumSummary(count: number, links: MyceliumLink[]): string {
  if (count < 2) return "One Normie: no threads."
  if (!links.length) return `${count} Normies, no two share ${MIN_SHARED} or more traits.`
  return `${count} Normies, ${links.length} thread${links.length === 1 ? "" : "s"} between Normies that share ${MIN_SHARED} or more traits. A thread lights up while both are singing.`
}
