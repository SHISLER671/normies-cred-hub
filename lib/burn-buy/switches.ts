import { promoWindowState } from "./promo-window"
import type { MarketState, YieldMode } from "./score"

/**
 * How a burn pays. BURN_YIELD_MODE=promo or =normal PINS it (the site owner decides, for example if the 4% window is extended).
 * Anything else (unset, empty, a typo) lets the CLOCK decide: "promo" until the earliest the announced 4% window could have closed
 * (16:00 UTC on Oct 5, see promo-window.ts), "normal" from then on. That keeps the page honest through the night without anyone awake.
 */
export function resolveYieldMode(value: string | null | undefined, now: Date = new Date()): { mode: YieldMode; pinned: boolean } {
  const v = value?.trim().toLowerCase()
  if (v === "normal") return { mode: "normal", pinned: true }
  if (v === "promo") return { mode: "promo", pinned: true }
  return { mode: promoWindowState(now) === "open" ? "promo" : "normal", pinned: false }
}

/** Only the exact word "live" says Pixel Market is open. Unset, empty or a typo stays on "pending" (today's behavior). */
export function parseMarket(value: string | null | undefined): MarketState {
  return value?.trim().toLowerCase() === "live" ? "live" : "pending"
}

/**
 * The site owner's pin for the market, or null when nobody pinned it. PIXEL_MARKET=live or =pending pins it; anything else (unset, empty,
 * a typo) lets the contract decide (see resolveMarketState). Before 2026-10-05 the flip was manual only; the market's own status now exists.
 */
export function parseMarketPin(value: string | null | undefined): MarketState | null {
  const v = value?.trim().toLowerCase()
  return v === "live" ? "live" : v === "pending" ? "pending" : null
}

/**
 * Is the Pixel Market open? Pin first, then the contract (/canvas/status carries a pixelMarket block only once the market stack is configured),
 * else the fallback (what the switch alone says). Returns where the answer came from, so the page can say how sure it is.
 */
export function resolveMarketState(
  pin: MarketState | null,
  contract: { pixelMarket?: unknown } | null,
  fallback: MarketState = "pending",
): { state: MarketState; source: "pinned" | "contract" | "default" } {
  if (pin) return { state: pin, source: "pinned" }
  if (contract?.pixelMarket) return { state: "live", source: "contract" }
  return { state: fallback, source: "default" }
}

/**
 * THE TWO SWITCHES. They are independent on purpose: Serc said the fixed 4% ends Monday, which may not be the same moment the
 * marketplace opens (audits).
 *   BURN_YIELD_MODE=normal  ->  pins burns to a roll inside the tier range (the 4% promo is over); =promo pins the fixed 4%;
 *                               unset = the clock decides (see resolveYieldMode)
 *   PIXEL_MARKET=live       ->  Pixel Market is open (wording, and later the Jev second opinion). =pending pins it closed. Unset = the contract decides.
 * Set in Vercel, then Redeploy (about a minute). Delete the variable and redeploy to roll back. Read on every request.
 */
export const currentYieldMode = (now: Date = new Date()): YieldMode => resolveYieldMode(process.env.BURN_YIELD_MODE, now).mode
export const currentYieldPinned = (now: Date = new Date()): boolean => resolveYieldMode(process.env.BURN_YIELD_MODE, now).pinned
export const currentMarket = (): MarketState => parseMarket(process.env.PIXEL_MARKET)
export const marketPin = (): MarketState | null => parseMarketPin(process.env.PIXEL_MARKET)
