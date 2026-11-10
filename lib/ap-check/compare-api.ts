// /api/burn/ap-check: the market-or-burn compare as JSON. Pure request → response pieces, so the routes stay thin and the
// extra fields for the old /api/ap-check?calc= address are shared and tested.

import { COMPARE_FINE_PRINT, COMPARE_SOURCES } from "./compare-text"

export const COMPARE_API_PATH = "/api/burn/ap-check"

/** Where an old /api/ap-check?calc=… call should go now. */
export function movedCompareUrl(sp: URLSearchParams): string {
  const q = new URLSearchParams()
  const calc = sp.get("calc")
  if (calc) q.set("calc", calc)
  const amount = sp.get("amount")
  if (amount) q.set("amount", amount)
  const s = q.toString()
  return `${COMPARE_API_PATH}${s ? `?${s}` : ""}`
}

/**
 * Fields added to answers on the old /api/ap-check?calc= address (kept working for the ERC-8257 manifest pinned on chain;
 * Ryan chose this over a 410 on 2026-11-10). Additive only: the answer itself is identical to /api/burn/ap-check.
 */
export function movedCompareFields(sp: URLSearchParams) {
  return {
    movedTo: movedCompareUrl(sp),
    page: "/burn#compare",
    deprecated: "This compare lives under /burn now. Call movedTo; this address keeps answering for the registered tool.",
  }
}

/** Labels shipped with every compare answer, so an agent cannot quote the numbers without them. */
export const COMPARE_API_NOTES = {
  notFinancialAdvice: true,
  notes: [...COMPARE_FINE_PRINT],
  sources: COMPARE_SOURCES,
  framing: "Two routes, two costs. lowerCost is a plain label of which route costs less right now, not a recommendation.",
} as const
