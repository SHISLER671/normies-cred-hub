// The five Pulse checks as "beats" for the Pulse page trace. Pure and client-safe (no server imports).
// The signal strings must match lib/api/agent-pulse.ts exactly; lib/pulse/beats.test.ts fails if they drift.

export type PulseBeat = {
  /** Exact breakdown string from the Pulse response. */
  signal: string
  /** Short label under the beat. */
  label: string
  /** One plain sentence: what this check means. */
  meaning: string
  /** Part of the trust gate (the two checks that open sector ranks). */
  gate: boolean
}

export const PULSE_BEATS: readonly PulseBeat[] = [
  {
    signal: "ERC-8004 registered",
    label: "Registered",
    meaning: "Registered as an agent on Ethereum (ERC-8004).",
    gate: true,
  },
  {
    signal: "Has active agent card",
    label: "Agent card",
    meaning: "Has a public agent card: name, tagline, prompts.",
    gate: false,
  },
  {
    signal: "Canvas activity detected",
    label: "Canvas",
    meaning: "Its canvas on normies.art has been painted.",
    gate: false,
  },
  {
    signal: "Clean ownership & delegation",
    label: "Ownership",
    meaning: "Owner and delegate check out with nothing odd.",
    gate: true,
  },
  {
    signal: "Recent agent usage / interaction signal",
    label: "Recent use",
    meaning: "Other agents and holders checked it recently (earns Luminous).",
    gate: false,
  },
] as const

export type LitBeat = PulseBeat & { lit: boolean }

/** Which beats this agent has earned. Unknown signals in the breakdown are ignored, never invented. */
export function pulseBeats(breakdown: readonly string[] | null | undefined): LitBeat[] {
  const have = new Set(breakdown ?? [])
  return PULSE_BEATS.map((b) => ({ ...b, lit: have.has(b.signal) }))
}

/** Pixel grid for the trace: 20 columns per beat, 24 rows, baseline on row 14 (0 = top). Pixels stay square. */
export const PIXEL_COLS_PER_BEAT = 20
export const PIXEL_ROWS = 24
export const PIXEL_BASELINE = 14
export const PIXEL_COLS = PIXEL_COLS_PER_BEAT * 5

/** One earned beat, as the row the line sits on in each of its 20 columns (a stepped ECG: P wave, QRS spike, T wave). */
const LIT_ROWS: readonly number[] = [14, 14, 14, 14, 14, 14, 13, 12, 13, 16, 2, 22, 14, 13, 12, 12, 13, 14, 14, 14]

/**
 * The pixels for one beat as [column, row] pairs in the 100 × 24 grid. Earned beats are a connected stepped line
 * (each column fills the run from the previous row to its own); missing beats are a dotted baseline.
 */
export function beatPixels(index: number, lit: boolean): Array<[number, number]> {
  const x0 = index * PIXEL_COLS_PER_BEAT
  const out: Array<[number, number]> = []
  if (!lit) {
    for (let c = 0; c < PIXEL_COLS_PER_BEAT; c += 2) out.push([x0 + c, PIXEL_BASELINE])
    return out
  }
  let prev = PIXEL_BASELINE
  LIT_ROWS.forEach((row, c) => {
    const lo = Math.min(prev, row)
    const hi = Math.max(prev, row)
    for (let y = lo; y <= hi; y++) {
      // Skip the previous column's end pixel when the line moves, so steps read as one pixel wide.
      if (hi !== lo && y === prev) continue
      out.push([x0 + c, y])
    }
    prev = row
  })
  return out
}

/** Pixels → one SVG path of 1×1 squares (crisp at any size with shape-rendering="crispEdges"). */
export function pixelPath(pixels: Array<[number, number]>): string {
  return pixels.map(([x, y]) => `M${x} ${y}h1v1h-1z`).join("")
}
