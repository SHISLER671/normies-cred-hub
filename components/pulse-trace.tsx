import { beatPixels, PIXEL_BASELINE, PIXEL_COLS, PIXEL_ROWS, pixelPath, type LitBeat } from "@/lib/pulse/beats"

/**
 * The Pulse heartbeat, drawn in pixels like a Normie: one beat per Pulse check on a 100 × 24 grid.
 * Earned beats spike in ink, missing ones are a dotted baseline.
 * Shared by the homepage, the Pulse page and the record card. `drawKey` restarts the sweep when the reading changes.
 * `blip` adds the one blinking cyan pixel at the end of the line (homepage only).
 */
export function PulseTrace({
  beats,
  drawKey,
  hasReading,
  blip = false,
  className,
}: {
  beats: LitBeat[]
  drawKey: string
  hasReading: boolean
  blip?: boolean
  className?: string
}) {
  const earned = beats.filter((b) => b.lit).length
  return (
    <figure className={className ? `ph-trace ${className}` : "ph-trace"}>
      <div className="ph-trace-wrap">
        <svg
          key={drawKey}
          className="ph-trace-svg"
          viewBox={`0 0 ${PIXEL_COLS} ${PIXEL_ROWS}`}
          shapeRendering="crispEdges"
          role="img"
          aria-label={hasReading ? `Pulse trace: ${earned} of 5 checks earned` : "Pulse trace: no reading"}
        >
          {beats.map((b, i) => (
            <path key={b.signal} d={pixelPath(beatPixels(i, b.lit))} className={b.lit ? "ph-px is-lit" : "ph-px"} />
          ))}
          {blip && hasReading && (
            <rect key={`blip-${drawKey}`} className="ph-blip" x={PIXEL_COLS - 1} y={PIXEL_BASELINE} width={1} height={1} />
          )}
        </svg>
      </div>
      <ol className="ph-beats">
        {beats.map((b) => (
          <li key={b.signal} data-lit={b.lit} data-gate={b.gate} title={b.meaning}>
            <span className="ph-beat-label">{b.label}</span>
            <span className="sr-only">{b.lit ? ": earned. " : ": not yet. "}{b.meaning}</span>
            {b.gate && <span className="ph-beat-gate" aria-hidden>gate</span>}
          </li>
        ))}
      </ol>
    </figure>
  )
}
