/**
 * Payment / currency configuration for Zulo A2A (additive scaffolding).
 *
 * Defaults preserve 100% backward compatibility:
 * - PIXEL_CURRENCY_ENABLED defaults to false
 * - DEFAULT_CURRENCY defaults to AP
 * - Existing AP verification paths are unchanged
 */

import {
  CURRENCIES,
  CURRENCY_CODES,
  type CurrencyCode,
  convertCurrency,
  type ConversionResult,
} from "@/lib/currencies"

export type PixelCurrencyStatus = "disabled" | "scaffolded" | "live"

function envBool(name: string, defaultValue: boolean): boolean {
  const raw = process.env[name]?.trim().toLowerCase()
  if (raw === undefined || raw === "") return defaultValue
  if (raw === "1" || raw === "true" || raw === "yes" || raw === "on") return true
  if (raw === "0" || raw === "false" || raw === "no" || raw === "off") return false
  return defaultValue
}

/** Feature flag — Pixel currency scaffolding (default OFF). */
export function isPixelCurrencyEnabled(): boolean {
  return envBool("PIXEL_CURRENCY_ENABLED", false)
}

/**
 * Default settlement currency for new PIXEL MARKET surfaces.
 * Always AP unless DEFAULT_CURRENCY=PIXEL *and* Pixel is enabled.
 */
export function getDefaultCurrency(): CurrencyCode {
  const raw = (process.env.DEFAULT_CURRENCY?.trim().toUpperCase() || "AP") as string
  if (raw === "PIXEL" && isPixelCurrencyEnabled()) return "PIXEL"
  return "AP"
}

/**
 * Fallback currency for backward compatibility (always AP).
 */
export function getFallbackCurrency(): CurrencyCode {
  return "AP"
}

/**
 * Currencies Zulo accepts for tips / A2A discovery.
 * AP is always first. PIXEL is listed when feature flag is on
 * (manifest may still advertise PIXEL as scaffolded for discovery).
 */
export function getAcceptedCurrencies(): CurrencyCode[] {
  if (isPixelCurrencyEnabled()) {
    return ["AP", "PIXEL"]
  }
  return ["AP"]
}

/**
 * Discovery list for manifest (AP first, always includes PIXEL as scaffolded
 * once we ship v1.5.0 discovery fields — not enforced for payments).
 */
export function getManifestCurrencies(): CurrencyCode[] {
  return [...CURRENCY_CODES]
}

/**
 * Pixel support status for discovery UIs.
 * - disabled: flag off
 * - scaffolded: flag on but rails / oracle not live
 * - live: reserved for future (not auto-set)
 */
export function getPixelCurrencyStatus(): PixelCurrencyStatus {
  if (!isPixelCurrencyEnabled()) return "disabled"
  const forced = process.env.PIXEL_CURRENCY_STATUS?.trim().toLowerCase()
  if (forced === "live") return "live"
  return "scaffolded"
}

export function getConversionOracleStatus(): "planned" | "live" {
  const v = process.env.PIXEL_CONVERSION_ORACLE?.trim().toLowerCase()
  if (v === "live") return "live"
  return "planned"
}

export interface PaymentCurrencyConfig {
  acceptedCurrencies: CurrencyCode[]
  /** Discovery list (AP, PIXEL) for manifest */
  manifestCurrencies: CurrencyCode[]
  defaultCurrency: CurrencyCode
  fallbackCurrency: CurrencyCode
  pixelCurrencyEnabled: boolean
  pixelCurrencyStatus: PixelCurrencyStatus
  conversionOracle: "planned" | "live"
  currencies: typeof CURRENCIES
}

/** Snapshot used by manifest, health, and currency status endpoints. */
export function getPaymentCurrencyConfig(): PaymentCurrencyConfig {
  return {
    acceptedCurrencies: getAcceptedCurrencies(),
    manifestCurrencies: getManifestCurrencies(),
    defaultCurrency: getDefaultCurrency(),
    fallbackCurrency: getFallbackCurrency(),
    pixelCurrencyEnabled: isPixelCurrencyEnabled(),
    pixelCurrencyStatus: getPixelCurrencyStatus(),
    conversionOracle: getConversionOracleStatus(),
    currencies: CURRENCIES,
  }
}

/** Convert using shared currency module (1:1 or placeholder oracle). */
export function convertPaymentAmount(
  amount: number,
  from: CurrencyCode,
  to: CurrencyCode,
): ConversionResult {
  return convertCurrency(amount, from, to)
}

/**
 * Resolve which currency to quote for a service price.
 * Always AP when Pixel disabled — preserves existing 1–2 AP pricing copy.
 */
export function resolveServiceCurrency(
  preferred?: CurrencyCode | string | null,
): CurrencyCode {
  if (!isPixelCurrencyEnabled()) return "AP"
  if (preferred === "PIXEL" || preferred === "AP") return preferred
  return getDefaultCurrency()
}
