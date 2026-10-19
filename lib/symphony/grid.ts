// Pixel grids of any size. Pure (no DOM), testable in Node.
// Normies are 40×40 at mint and 50–80 once enlarged; announced canvases can be much bigger (serc's agent-made canvas is
// 256×256). The music always reads every pixel. Only DRAWING is scaled down, so a big grid stays legible on a phone
// and the playhead sweeps a readable number of columns.

import { gridSide } from "./compose"

/** Largest grid Symphony accepts (one 256×256 canvas). Bigger strings are refused rather than slowing the browser. */
export const MAX_GRID_SIDE = 256

/** Largest grid drawn 1:1 in the player (an enlarged Normie). Anything bigger is sampled down to fit. */
export const VIEW_MAX_SIDE = 80

/** A block lights when at least this share of its pixels is ink: thin lines survive, noise doesn't turn solid. */
const INK_SHARE = 0.25

export interface ViewGrid {
  /** Row-major "0"/"1", side × side. */
  pixels: string
  side: number
  /** How many source pixels each view pixel covers along one edge (1 = drawn as is). */
  scale: number
}

/** True when `pixels` is a square grid Symphony can play (1×1 up to MAX_GRID_SIDE). */
export function isPlayableGrid(pixels: string): boolean {
  try {
    return gridSide(pixels) <= MAX_GRID_SIDE
  } catch {
    return false
  }
}

/**
 * The grid to DRAW: unchanged when its side is ≤ `maxSide`, otherwise sampled down by the smallest whole factor that
 * fits (256 → 64 at maxSide 80). Never used for the music. Throws RangeError on a non-square string.
 */
export function viewGrid(pixels: string, maxSide = VIEW_MAX_SIDE): ViewGrid {
  const n = gridSide(pixels)
  const limit = Math.max(1, Math.floor(maxSide))
  if (n <= limit) return { pixels, side: n, scale: 1 }
  const k = Math.ceil(n / limit)
  const side = Math.ceil(n / k)
  let out = ""
  for (let vy = 0; vy < side; vy++) {
    for (let vx = 0; vx < side; vx++) {
      let ink = 0
      let total = 0
      for (let y = vy * k; y < Math.min(n, vy * k + k); y++) {
        for (let x = vx * k; x < Math.min(n, vx * k + k); x++) {
          total++
          if (pixels[y * n + x] === "1") ink++
        }
      }
      out += total && ink / total >= INK_SHARE ? "1" : "0"
    }
  }
  return { pixels: out, side, scale: k }
}
