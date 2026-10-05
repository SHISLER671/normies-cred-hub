// Ask's live Pixel Market status, driven by the SAME switch as /burn (PIXEL_MARKET=live in Vercel, then Redeploy).
// Everything else Ask knows about the market is static text; this block is the one place that changes when the market opens, and it says
// that it overrides any older "not open yet" / "Coming Soon" wording. Read on every request, so flipping the switch flips both.
import type { MarketState } from "../burn-buy/score"

export function buildMarketStatusBlock(state: MarketState): string {
  if (state === "live") {
    return `=== LIVE STATUS: PIXEL MARKET (overrides any older "not open yet" or "Coming Soon" wording below) ===
- The Pixel Market is OPEN (confirmed by the site owner). Say so plainly. Older notes that call it "not open yet", "Coming Soon" or "planned" are out of date.
- You have NO live market data: never quote #PIXEL prices, listings, volume, fees collected or order-book depth. For live numbers point to the official Pixel Market page; for score-based moves point to https://normiescredhub.vercel.app/burn (it ranks by score, not by price).
- The revenue-share rules in the Pixel Market economics section now apply for real. Payouts are monthly and depend on real volume, so any figure is an estimate, never a promise.
- Everything else stays as written: never invent prices, thresholds or mechanics; burns are permanent; no financial advice.`
  }
  return `=== LIVE STATUS: PIXEL MARKET (overrides any older wording below) ===
- @normiesART (official) announced that the Pixel Market launches on Monday, October 5, 2026. This app has NOT been told it is open yet, so say: "announced for October 5; check @normiesART or the official Pixel Market page for whether it is open right now". Never say it is open or live, and never invent a time.
- The revenue-share rules in the Pixel Market economics section are official whether or not the market is open.
- You have no live market data either way: never quote #PIXEL prices, listings, volume or order-book depth.`
}
