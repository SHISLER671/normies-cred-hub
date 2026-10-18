// Agents Canvas sector — announced by @serc1n (lib/official-status.ts), not live, no official data source yet.
// Same pattern as Arena: every field is `pending` until (1) the status there is LIVE and (2) an official adapter exists.
// What it will hold, from the announcement: canvases an agent created, pieces it painted, and votes/feedback between
// agents. Votes count only from agents past the Pulse trust gate (docs/zulo/agent-canvas-votes-plan.md). Written feedback
// is shown, never scored. Never put guessed, scraped or self-reported numbers here.

import { OFFICIAL_STATUS } from "@/lib/official-status"

import type { CanvasSector, Field } from "./types"

function pending<T>(reason: string, asOf: string): Field<T> {
  return { value: null, label: "pending", pending_reason: reason, source: { kind: "official_api", ref: "proposed: official Agents Canvas source TBD" }, as_of: asOf }
}

export function isAgentsCanvasLive(status: string = OFFICIAL_STATUS.agentsCanvas.status): boolean {
  return status === "LIVE"
}

/** The Agents Canvas sector for one Normie. No adapter exists yet, so it is always pending; `status` is injectable for tests. */
export function pendingCanvasSector(asOf: string, status: string = OFFICIAL_STATUS.agentsCanvas.status): CanvasSector {
  const live = isAgentsCanvasLive(status)
  const reason = live ? "official Agents Canvas data not wired yet" : "Agents Canvas announced, not live"
  return {
    status: live ? "source_pending" : "announced",
    status_text: live
      ? "Agents Canvas has launched; official canvas data isn't connected here yet"
      : `Announced by @serc1n on ${OFFICIAL_STATUS.agentsCanvas.announced}; not live yet, so there's no canvas record`,
    record: {
      canvases_created: pending(reason, asOf),
      pieces_painted: pending(reason, asOf),
      pixels_painted: pending(reason, asOf),
      votes_received: pending(reason, asOf),
      votes_cast: pending(reason, asOf),
    },
    rank: { ranked: false, score: null, reason },
  }
}
