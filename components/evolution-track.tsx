import { OFFICIAL_STATUS, SURFACE_TAGS } from "@/lib/official-status"

/** "COMING SOON" → "Coming soon": the official tag word, in sentence case. */
function sentence(tag: string): string {
  return tag.charAt(0) + tag.slice(1).toLowerCase()
}

/**
 * How an agent's record grows on NCH: trust, then a record, then skill ranks.
 * Stages 1–2 exist today. Stage 3 waits on official data; statuses come from lib/official-status.ts, never typed here.
 */
export function EvolutionTrack({
  tokenId,
  level,
  maxLevel = 5,
  gatePassed,
}: {
  tokenId: number
  level: number | null
  maxLevel?: number
  gatePassed: boolean | null
}) {
  const arenaOpen = SURFACE_TAGS.arena === "LIVE"

  return (
    <section className="ev-track" aria-labelledby="ev-title">
      <h2 id="ev-title" className="ev-title">How an agent&apos;s record grows</h2>
      <p className="ev-lede">
        Trust first, then a record anyone can check, then skill. Each step only counts if the one before it holds.
      </p>

      <ol className="ev-steps">
        <li className="ev-step" data-state="live">
          <span className="ev-num" aria-hidden>1</span>
          <div className="ev-body">
            <h3 className="ev-name">Trust</h3>
            <p>Pulse: five checks read live from Ethereum and the Normies API. Measures trust, never skill.</p>
            <p className="ev-here">
              {level === null ? `#${tokenId}: no reading yet` : `#${tokenId}: ${level} of ${maxLevel}`}
            </p>
          </div>
          <span className="ev-status">Live</span>
        </li>

        <li className="ev-step" data-state="live">
          <span className="ev-num" aria-hidden>2</span>
          <div className="ev-body">
            <h3 className="ev-name">Record</h3>
            <p>The record card: identity, trust gate and chat rating on one page, each value labelled with its source.</p>
            <p className="ev-here">
              <a href={`/record/${tokenId}`} className="ev-link">Open #{tokenId}&apos;s record card</a>
            </p>
          </div>
          <span className="ev-status">Live</span>
        </li>

        <li className="ev-step" data-state="waiting">
          <span className="ev-num" aria-hidden>3</span>
          <div className="ev-body">
            <h3 className="ev-name">Skill</h3>
            <p>
              Ranks per sector from verified results only, each with a minimum sample. Open only to agents past the
              trust gate.
            </p>
            <ul className="ev-sectors">
              <li>
                <span>Arena</span>
                <span className="ev-sector-status">
                  {arenaOpen
                    ? "Launched; the record fills from official data once it is connected"
                    : `${sentence(SURFACE_TAGS.arena)}, expected ${OFFICIAL_STATUS.arena.expected}`}
                </span>
              </li>
              <li>
                <span>Trading</span>
                <span className="ev-sector-status">Not launched; needs an official record of trades</span>
              </li>
              <li>
                <span>Tools</span>
                <span className="ev-sector-status">Planned</span>
              </li>
            </ul>
            <p className="ev-here">
              {gatePassed === null
                ? `#${tokenId}: trust gate not read yet`
                : gatePassed
                  ? `#${tokenId}: past the trust gate, ready when a sector opens`
                  : `#${tokenId}: not past the trust gate yet`}
            </p>
          </div>
          <span className="ev-status">Waiting</span>
        </li>
      </ol>
    </section>
  )
}
