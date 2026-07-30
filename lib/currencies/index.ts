/**
 * Zulo / Normies currency definitions (additive scaffolding).
 *
 * AP remains the live Canvas unit. PIXEL is prepared for PIXEL MARKET
 * (Serc hint that "Pixel" may be the market currency name for what is
 * currently called Action Points). Conversion is 1:1 until an oracle exists.
 *
 * Feature flag: PIXEL_CURRENCY_ENABLED (default false) — see lib/payments/config.ts
 */

export type CurrencyCode = "AP" | "PIXEL"

export interface CurrencyDef {
  /** Canonical code used in APIs / manifests */
  code: CurrencyCode
  /** Human-readable name */
  name: string
  /** Short symbol for UI */
  symbol: string
  /** Display / ledger decimals (AP is integer) */
  decimals: number
  /**
   * Whether the unit is expected to be tradeable on PIXEL MARKET when live.
   * Canvas AP today is not a free-floating transferable ledger.
   */
  tradable: boolean
  /** Primary display label (Pixel preferred when enabled; AP is legacy alias) */
  primaryTerm: string
  /** Legacy alias for UI (AP when showing Pixel) */
  legacyAlias?: string
  /** Optional notes for discovery UIs */
  notes?: string[]
}

/**
 * Currency registry. AP is always present for backward compatibility.
 * PIXEL is defined always; enablement is controlled by feature flags.
 */
export const CURRENCIES: Record<CurrencyCode, CurrencyDef> = {
  AP: {
    code: "AP",
    name: "Action Points",
    symbol: "AP",
    decimals: 0,
    tradable: false,
    primaryTerm: "Action Points",
    notes: [
      "Canvas-local transform budget bound to a specific Normie.",
      "Earned by burning; spent 1:1 per pixel add/remove on 40×40.",
      "Legacy alias if PIXEL becomes the official PIXEL MARKET name.",
    ],
  },
  PIXEL: {
    code: "PIXEL",
    name: "Pixel",
    symbol: "PIXEL",
    decimals: 0,
    tradable: true,
    primaryTerm: "Pixel",
    legacyAlias: "AP",
    notes: [
      "Scaffolded currency name for PIXEL MARKET (Serc hint).",
      "May be the same unit as AP (1:1) or a distinct tradeable unit.",
      "Not enforced until PIXEL_CURRENCY_ENABLED and official Normies docs.",
    ],
  },
} as const

/** Ordered list for discovery: AP first (backward compatible). */
export const CURRENCY_CODES: readonly CurrencyCode[] = ["AP", "PIXEL"] as const

/**
 * Conversion mode between AP and PIXEL until serc/oracle docs land.
 * - same-unit: 1 AP = 1 PIXEL (default assumption)
 * - oracle: variable rate from conversion oracle (placeholder)
 */
export type ConversionMode = "same-unit" | "oracle"

export interface ConversionResult {
  from: CurrencyCode
  to: CurrencyCode
  amountIn: number
  amountOut: number
  rate: number
  mode: ConversionMode
  status: "live" | "placeholder" | "identity"
  note: string
}

/**
 * Placeholder oracle rate PIXEL per 1 AP when units differ.
 * Overridable via PIXEL_AP_ORACLE_RATE env (number string).
 * Only used when PIXEL_CONVERSION_MODE=oracle.
 */
export function getPlaceholderOracleRate(): number {
  const raw = process.env.PIXEL_AP_ORACLE_RATE?.trim()
  if (!raw) return 1
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : 1
}

export function getConversionMode(): ConversionMode {
  const m = process.env.PIXEL_CONVERSION_MODE?.trim().toLowerCase()
  if (m === "oracle") return "oracle"
  return "same-unit"
}

/**
 * Convert between AP and PIXEL.
 * Same currency → identity. Default same-unit → 1:1.
 * Oracle mode → placeholder rate until Normies docs drop.
 */
export function convertCurrency(
  amount: number,
  from: CurrencyCode,
  to: CurrencyCode,
): ConversionResult {
  if (!Number.isFinite(amount) || amount < 0) {
    return {
      from,
      to,
      amountIn: amount,
      amountOut: 0,
      rate: 0,
      mode: getConversionMode(),
      status: "placeholder",
      note: "invalid amount",
    }
  }

  if (from === to) {
    return {
      from,
      to,
      amountIn: amount,
      amountOut: amount,
      rate: 1,
      mode: getConversionMode(),
      status: "identity",
      note: "same currency",
    }
  }

  const mode = getConversionMode()
  if (mode === "same-unit") {
    return {
      from,
      to,
      amountIn: amount,
      amountOut: amount,
      rate: 1,
      mode,
      status: "placeholder",
      note: "Assuming 1 AP = 1 PIXEL until official conversion docs",
    }
  }

  // oracle: rate = PIXEL per 1 AP
  const pixelPerAp = getPlaceholderOracleRate()
  const rate = from === "AP" && to === "PIXEL" ? pixelPerAp : 1 / pixelPerAp
  return {
    from,
    to,
    amountIn: amount,
    amountOut: amount * rate,
    rate,
    mode,
    status: "placeholder",
    note: "Placeholder oracle rate — replace when conversionOracle goes live",
  }
}

/** Format amount with symbol for UI (integer-friendly for decimals=0). */
export function formatCurrencyAmount(
  amount: number,
  code: CurrencyCode,
  opts?: { preferPrimaryTerm?: boolean },
): string {
  const def = CURRENCIES[code]
  const decimals = def.decimals
  const n =
    decimals === 0 ? String(Math.trunc(amount)) : amount.toFixed(decimals)
  if (opts?.preferPrimaryTerm) {
    return `${n} ${def.primaryTerm}`
  }
  return `${n} ${def.symbol}`
}

/**
 * Display label: when Pixel feature is enabled, prefer "Pixel" with AP alias;
 * otherwise pure AP (legacy).
 */
export function displayCurrencyLabel(
  code: CurrencyCode,
  pixelEnabled: boolean,
): string {
  if (!pixelEnabled) {
    return CURRENCIES.AP.symbol
  }
  // Dual vocabulary: Pixel primary, AP legacy alias
  if (code === "PIXEL" || code === "AP") {
    return `${CURRENCIES.PIXEL.primaryTerm} (${CURRENCIES.AP.symbol})`
  }
  // Exhaustiveness — CurrencyCode is only AP | PIXEL today
  return CURRENCIES.AP.symbol
}

export function getCurrency(code: CurrencyCode): CurrencyDef {
  return CURRENCIES[code]
}

export function isCurrencyCode(value: string): value is CurrencyCode {
  return value === "AP" || value === "PIXEL"
}
