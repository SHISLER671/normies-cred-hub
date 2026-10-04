// The 4% promo's announced end.
//
// Serc, in the Normies group chat (relayed by Ryan 2026-10-04, NOT independently verified):
//   "4% max yield ends on Monday ... until 8PM CET (probably we close it 1-2 hours before launch)".
// Central Europe is on summer time on Oct 5 (UTC+2), so 8 PM is 18:00 UTC; "1-2 hours before" puts the earliest close at 16:00 UTC.
// (If "CET" were meant literally, UTC+1, 8 PM would be 19:00 UTC; we use the earlier, more cautious reading.)
//
// Why this exists: the exact moment is not published and it falls in the small hours in Guam. After the EARLIEST possible close this
// page stops asserting 4% by itself (see resolveYieldMode in switches.ts), because a burn is permanent: showing 4% after it ended
// costs a holder yield they cannot get back, while showing the normal roll early only makes them look twice.

export const PROMO_EARLIEST_END_UTC = "2026-10-05T16:00:00Z"
export const PROMO_LATEST_END_UTC = "2026-10-05T18:00:00Z"
/** After the latest end, keep telling people it has ended for this long, then stop mentioning it. */
export const PROMO_ENDED_NOTICE_HOURS = 72

export type PromoWindowState = "open" | "may-have-closed" | "closed"

export interface PromoWindow {
  state: PromoWindowState
  earliestEnd: string
  latestEnd: string
  /** The site owner has pinned the yield mode with BURN_YIELD_MODE, so the clock does not decide it. */
  pinned: boolean
}

export function promoWindowState(now: Date): PromoWindowState {
  const t = now.getTime()
  if (t < Date.parse(PROMO_EARLIEST_END_UTC)) return "open"
  if (t < Date.parse(PROMO_LATEST_END_UTC)) return "may-have-closed"
  return "closed"
}

export function promoWindow(now: Date, pinned = false): PromoWindow {
  return { state: promoWindowState(now), earliestEnd: PROMO_EARLIEST_END_UTC, latestEnd: PROMO_LATEST_END_UTC, pinned }
}
