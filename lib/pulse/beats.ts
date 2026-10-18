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

/**
 * SVG path for the heartbeat trace: one 100-unit segment per beat in a 0..500 × 0..100 box, baseline at y=60.
 * Lit beats spike; unlit beats stay flat. Returned per segment so each can be styled on its own.
 */
export function beatSegmentPath(index: number, lit: boolean): string {
  const x = index * 100
  if (!lit) return `M${x} 60 L${x + 100} 60`
  return [
    `M${x} 60`,
    `L${x + 30} 60`,
    `L${x + 38} 52`,
    `L${x + 44} 66`,
    `L${x + 50} 8`,
    `L${x + 57} 88`,
    `L${x + 63} 60`,
    `L${x + 72} 54`,
    `L${x + 80} 60`,
    `L${x + 100} 60`,
  ].join(" ")
}
