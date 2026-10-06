// Ask's live Pixel Market status, driven by the SAME switch as /burn (PIXEL_MARKET=live in Vercel, then Redeploy) plus the announced launch
// clock (lib/burn-buy/market-launch.ts, wording only: only the switch can say "open"). Everything else Ask knows about the market is static
// text; this block is the one place that changes, and it says that it overrides any older "not open yet" / "Coming Soon" / "not tradable" wording.
import { launchTimePassed, PIXEL_MARKET_LAUNCH_TEXT } from "../burn-buy/market-launch"
import type { MarketState } from "../burn-buy/score"

/** What @serc1n said on launch day (2026-10-05): official, dated, and free of numbers that go stale (no volumes, no burn counts). */
/** Official (Normies Discord #normies-announcements, 2026-10-05, relayed by Ryan as a screenshot) and confirmed by the contract's own status. */
const BURN_AND_CARD = `BURN YIELD AND HOLDER CARD (official):
- The fixed 4% burn promo has ENDED. The official Normies Discord said it ends at 2:00 AM Guam time = 16:00 UTC on October 5, with a 1-hour pause on canvas/burn before the market launch; the Normies contract showed the normal tiers from about 16:23 UTC. Burns now pay a roll by original pixel count: under 490 px 1-4%, 490-889 px 2-4%, 890+ px 3-4%. Any older text calling the 4% "community-sourced", "ongoing" or "until about 8 PM CET" is out of date.
- The official Holder Card is a page on the new site, in its main navigation: https://www.normies.art/holder . Its fields are not documented to you: say only that it is an official normies.art page and never describe what it shows.`

const ANNOUNCEMENT = `OFFICIAL ANNOUNCEMENT (@serc1n, 2026-10-05):
- The Pixel Market launches at 8 PM CET / 2 PM EST (18:00 UTC) on Monday, October 5, 2026, together with a new official Normies website with more features for holders.
- #PIXEL is the new name for Action Points. It is free to trade on the Pixel Market and to spend on more on-chain interactions. There is NO separate coin: only Normies (fully on-chain NFTs) and #PIXEL. Older text that says "not tradable" describes the time before the market; once the market is open, #PIXEL is tradable there.
- Next month (official): NormiesHIVE (agentic swarm) and Arena (a fully autonomous agentic game). Arena rules are still not published.
- The official website is new, so some normies.art deep links in older notes may have moved. If a link fails, send people to the normies.art home page instead of guessing a path.`

export function buildMarketStatusBlock(state: MarketState, now: Date = new Date()): string {
  if (state === "live") {
    return `=== LIVE STATUS: PIXEL MARKET (overrides any older "not open yet", "Coming Soon" or "not tradable" wording below) ===
- The Pixel Market is OPEN (confirmed by the Normies contract status or the site owner). Say so plainly. Older notes that call it "not open yet", "Coming Soon" or "planned" are out of date.
- You have NO live market data: never quote #PIXEL prices, listings, volume, fees collected or order-book depth. For live numbers point to the official Pixel Market page (https://www.normies.art/lab/pixel-market); for a wallet's own moves point to https://normiescredhub.vercel.app/burn.
- The revenue-share rules in the Pixel Market economics section now apply for real. Payouts are monthly and depend on real volume, so any figure is an estimate, never a promise.
- Everything else stays as written: never invent prices, thresholds or mechanics; burns are permanent; no financial advice.
${BURN_AND_CARD}
${ANNOUNCEMENT}`
  }
  const timing = launchTimePassed(now)
    ? `- The Pixel Market was SCHEDULED to launch at ${PIXEL_MARKET_LAUNCH_TEXT} (@serc1n, official). That time has passed, and this app has NOT been told it is open. Say: "the scheduled launch time has passed; check @normiesART or the official Pixel Market page for whether it is open right now". Never claim it is open, and never claim it is delayed.`
    : `- The Pixel Market is scheduled to launch at ${PIXEL_MARKET_LAUNCH_TEXT} (@serc1n, official). This app has NOT been told it is open yet, so before that time say it is scheduled for 18:00 UTC today. Never say it is open or live, and never invent another time.`
  return `=== LIVE STATUS: PIXEL MARKET (overrides any older wording below) ===
${timing}
- The revenue-share rules in the Pixel Market economics section are official whether or not the market is open.
- You have no live market data either way: never quote #PIXEL prices, listings, volume or order-book depth.
${BURN_AND_CARD}
${ANNOUNCEMENT}`
}
