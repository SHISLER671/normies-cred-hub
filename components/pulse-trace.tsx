import { beatSegmentPath, type LitBeat } from "@/lib/pulse/beats"

/**
 * The Pulse heartbeat: one beat per Pulse check, earned beats spike in cyan, missing ones stay flat.
 * Shared by the homepage, the Pulse page and the record card. `drawKey` restarts the sweep when the reading changes.
 * `blip` adds the live dot at the end of the line (homepage only).
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
          viewBox="0 0 500 100"
          preserveAspectRatio="none"
          role="img"
          aria-label={hasReading ? `Pulse trace: ${earned} of 5 checks earned` : "Pulse trace: no reading"}
        >
          {beats.map((b, i) => (
            <path
              key={b.signal}
              d={beatSegmentPath(i, b.lit)}
              className={b.lit ? "ph-seg is-lit" : "ph-seg"}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
        {blip && hasReading && <span key={`blip-${drawKey}`} className="ph-blip" aria-hidden />}
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
