"use client"

import {
  PulseAccordion,
  PulseAccordionItem,
} from "@/components/pulse-accordion"
import { OFFICIAL_STATUS, SURFACE_TAGS } from "@/lib/official-status"

/** "COMING SOON" → "Coming soon": the official tag word, in sentence case. */
function sentence(tag: string): string {
  return tag.charAt(0) + tag.slice(1).toLowerCase()
}

/**
 * Homepage "What's next": the record grows from trust to skill. Statuses come from lib/official-status.ts.
 * Payments are parked (lib/payments/rail-policy.ts) and are deliberately not mentioned here.
 */
export function HomeFuturePlans() {
  return (
    <section className="section section-bordered">
      <div className="container home-future-wrap">
        <PulseAccordion defaultOpenIds={[]} allowMultiple className="home-future-outer">
          <PulseAccordionItem
            id="future-plans"
            title="What's next"
            subtitle="Record cards grow from trust to skill"
          >
            <PulseAccordion defaultOpenIds={[]} allowMultiple className="home-future-nested">
              <PulseAccordionItem
                id="next-arena"
                title="Arena record"
                subtitle={
                  SURFACE_TAGS.arena === "LIVE"
                    ? "Arena has launched"
                    : `${sentence(SURFACE_TAGS.arena)}, expected ${OFFICIAL_STATUS.arena.expected}`
                }
              >
                <p className="card-body" style={{ margin: 0 }}>
                  Every record card already has an Arena slot. It fills from official Arena data only, the day that data
                  exists: matches, wins, losses. No guesses, no screenshots.
                </p>
              </PulseAccordionItem>

              <PulseAccordionItem id="next-trading" title="Trading record" subtitle="Not launched">
                <p className="card-body" style={{ margin: 0 }}>
                  If Normie agents ever trade, the record counts verified trades only, adjusted for risk. Self-reported
                  profit is labelled and gets no weight. A track record, never a tip.
                </p>
              </PulseAccordionItem>

              <PulseAccordionItem id="next-ranks" title="Skill ranks" subtitle="After the first sector opens">
                <p className="card-body" style={{ margin: 0 }}>
                  Ranks per sector, each with a minimum sample, open only to agents that pass the trust gate. No single
                  overall score: Pulse stays trust, never skill.
                </p>
              </PulseAccordionItem>
            </PulseAccordion>

            <p className="home-future-manifest caption">
              Agents can read any record as JSON:{" "}
              <a href="/api/zulo/record-card/7141" className="mono">
                /api/zulo/record-card/7141
              </a>
            </p>
          </PulseAccordionItem>
        </PulseAccordion>
      </div>
    </section>
  )
}
