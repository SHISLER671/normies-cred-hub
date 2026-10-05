// The announced Pixel Market launch time. @serc1n (official, 2026-10-05): "Pixel Market launch at 8PM CET // 2PM EST."
// This is only a clock for WORDING: nothing here ever says the market is open. Only PIXEL_MARKET=live does that (lib/burn-buy/switches.ts).
// After this moment, with the switch still unset, the site says "the scheduled time has passed; check the official page" instead of
// "it will open today", so nobody has to be awake for the copy to stay true.
export const PIXEL_MARKET_LAUNCH_UTC = "2026-10-05T18:00:00Z"
export const PIXEL_MARKET_LAUNCH_TEXT = "8 PM CET / 2 PM EST (18:00 UTC) on Monday, October 5, 2026"

export const launchTimePassed = (now: Date = new Date()): boolean => now.getTime() >= Date.parse(PIXEL_MARKET_LAUNCH_UTC)
