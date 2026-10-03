import type { MarketState, YieldMode } from "./score"

/** Only the exact word "normal" turns the normal burn rates on. Unset, empty or a typo stays on "promo" (today's behavior). */
export function parseYieldMode(value: string | null | undefined): YieldMode {
  return value?.trim().toLowerCase() === "normal" ? "normal" : "promo"
}

/** Only the exact word "live" says Pixel Market is open. Unset, empty or a typo stays on "pending" (today's behavior). */
export function parseMarket(value: string | null | undefined): MarketState {
  return value?.trim().toLowerCase() === "live" ? "live" : "pending"
}

/**
 * THE TWO SWITCHES. They are independent on purpose: Serc said the fixed 4% ends Monday, which may not be the same moment the
 * marketplace opens (audits).
 *   BURN_YIELD_MODE=normal  ->  burns pay a roll inside the tier range (the 4% promo is over)
 *   PIXEL_MARKET=live       ->  Pixel Market is open (wording, and later the Jev second opinion)
 * Set in Vercel, then Redeploy (about a minute). Delete the variable and redeploy to roll back. Read on every request.
 */
export const currentYieldMode = (): YieldMode => parseYieldMode(process.env.BURN_YIELD_MODE)
export const currentMarket = (): MarketState => parseMarket(process.env.PIXEL_MARKET)
