// Standing rule: NO CRYPTO AS INCOME. Zulo / CredHub do not take public pay-in.
// ZULO_PAYMENT_RAIL_STATUS=live is therefore hard-blocked: an env var alone can never turn payment enforcement on.
// Lifting this needs a reviewed code change to PAYMENT_RAIL_LIVE_ALLOWED, made only after Ryan explicitly changes the
// no-crypto-as-income rule. Until then "live" is treated as "planned" (free path) and logged.

export type PaymentRailStatus = "planned" | "scaffold" | "live"

/** Do not flip without Ryan's explicit, written change to the no-crypto-as-income rule. Pinned by rail-policy.test.ts. */
export const PAYMENT_RAIL_LIVE_ALLOWED = false as const

let warned = false

export function resolvePaymentRailStatus(raw: string | null | undefined): PaymentRailStatus {
  const env = raw?.trim().toLowerCase()
  if (env === "live") {
    if (PAYMENT_RAIL_LIVE_ALLOWED) return "live"
    if (!warned) {
      warned = true
      console.error("[payments] ZULO_PAYMENT_RAIL_STATUS=live is blocked (no crypto as income). Treating as planned.")
    }
    return "planned"
  }
  if (env === "scaffold") return "scaffold"
  return "planned"
}
