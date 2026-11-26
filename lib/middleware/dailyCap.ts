// Daily cap for routes that spend money on every call (today: Ask).
//
// The per-minute limit stops bursts, but 12 a minute is still 17,280 calls a day from one address. This adds a ceiling per
// caller and one for everyone combined, so the most Ask can cost in a day is a known number. Why and how the numbers were
// chosen: docs/zulo/sustainability-plan.md.
//
// Pure logic on purpose: the limiter is passed in, so this file imports nothing and its test runs without any service.

export type LimitResult = { ok: true } | { ok: false; retryAfter: number }

/** Same shape as `checkRateLimitById` in lib/ratelimit.ts. */
export type LimitCheck = (id: string, bucket: string, limit: number, windowSec: number) => Promise<LimitResult>

/** The cap window: any 24 hours (sliding), not a calendar day. */
export const DAY_SEC = 86_400

export type DailyCap = {
  /** Calls per client address in any 24 hours. */
  ip: number
  /** Calls per wallet in any 24 hours, when the request names one. The wallet is not verified, so this only slows honest clients. */
  wallet: number
  /** Calls from everyone combined in any 24 hours. This is the real ceiling on spend. */
  all: number
}

/** Ask. Tune here, in one place; the plan doc quotes these numbers and a test keeps the two in step. */
export const ASK_DAILY_CAP: DailyCap = { ip: 40, wallet: 40, all: 300 }

export type DailyCapScope = "ip" | "wallet" | "all"

export type DailyCapResult = { ok: true } | { ok: false; scope: DailyCapScope; retryAfter: number }

/** Shown when one caller reaches their own cap. Free stays free: no price, no upsell, no nudge to pay. */
export const DAILY_CAP_MESSAGE_CALLER =
  "You've reached today's free Ask limit. Ask is free and opens up again over the next 24 hours. The rest of NCH is still open."

/** Shown when everyone combined reaches the cap. */
export const DAILY_CAP_MESSAGE_ALL =
  "Zulo has answered a lot of questions today, so Ask is resting. Ask is free and opens up again over the next 24 hours. The rest of NCH is still open."

export function dailyCapMessage(scope: DailyCapScope): string {
  return scope === "all" ? DAILY_CAP_MESSAGE_ALL : DAILY_CAP_MESSAGE_CALLER
}

/**
 * Checks the caller's own caps first and the combined cap last. The order matters: a caller who is already over their own
 * cap is turned away before the combined counter is touched, so one noisy caller cannot use up everyone's allowance.
 */
export async function checkDailyCap(
  check: LimitCheck,
  prefix: string,
  cap: DailyCap,
  ids: { ip: string; wallet?: string },
): Promise<DailyCapResult> {
  const ip = await check(ids.ip, `${prefix}-day-ip`, cap.ip, DAY_SEC)
  if (!ip.ok) return { ok: false, scope: "ip", retryAfter: ip.retryAfter }

  if (ids.wallet) {
    const wallet = await check(ids.wallet, `${prefix}-day-wallet`, cap.wallet, DAY_SEC)
    if (!wallet.ok) return { ok: false, scope: "wallet", retryAfter: wallet.retryAfter }
  }

  const all = await check("all", `${prefix}-day-all`, cap.all, DAY_SEC)
  if (!all.ok) return { ok: false, scope: "all", retryAfter: all.retryAfter }

  return { ok: true }
}
