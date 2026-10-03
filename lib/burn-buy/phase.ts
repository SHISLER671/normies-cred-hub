import type { Phase } from "./score"

/** Only the exact word "launched" turns the launch phase on. Unset, empty or a typo stays on "promo" (today's behavior). */
export function parsePhase(value: string | null | undefined): Phase {
  return value?.trim().toLowerCase() === "launched" ? "launched" : "promo"
}

/**
 * THE launch switch. Set PIXEL_MARKET_PHASE=launched in Vercel and redeploy to flip the page and the API.
 * Set it back (or delete it) and redeploy to roll back. Read on every request, so no code change is needed.
 */
export function currentPhase(): Phase {
  return parsePhase(process.env.PIXEL_MARKET_PHASE)
}
