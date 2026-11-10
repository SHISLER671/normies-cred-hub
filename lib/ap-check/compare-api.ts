// /api/burn/ap-check: the market-or-burn compare as JSON. Pure request → response pieces, so the route stays thin and the
// "moved" answer for the old /api/ap-check?calc= is shared and tested.

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
 * 410 body for /api/ap-check?calc=…: the compare moved under /burn (AGENTS.md: buy-vs-burn views are fenced to /burn).
 * Same JSON error shape the ERC-8257 manifest documents ({error, code, retryable}), plus where to go.
 */
export function movedCompareBody(sp: URLSearchParams) {
  return {
    error: "The Pixel Market vs burning compare moved under /burn. Call movedTo instead (same calc and amount).",
    code: "moved",
    retryable: false,
    movedTo: movedCompareUrl(sp),
    page: "/burn#compare",
  }
}

/** Labels shipped with every compare answer, so an agent cannot quote the numbers without them. */
export const COMPARE_API_NOTES = {
  notFinancialAdvice: true,
  notes: [...COMPARE_FINE_PRINT],
  sources: COMPARE_SOURCES,
  framing: "Two routes, two costs. lowerCost is a plain label of which route costs less right now, not a recommendation.",
} as const
