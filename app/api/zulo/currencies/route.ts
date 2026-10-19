// GET /api/zulo/currencies — Pixel / AP scaffolding status (discovery only).

import { NextResponse } from "next/server"

import {
  CURRENCIES,
  convertCurrency,
  getConversionMode,
  getPlaceholderOracleRate,
} from "@/lib/currencies"
import { getPaymentCurrencyConfig } from "@/lib/payments/config"

export const dynamic = "force-dynamic"

/**
 * What #PIXEL / AP are, for agents. Descriptive only: Zulo takes no payments (parked, lib/payments/rail-policy.ts).
 * Pixel Market status comes from lib/official-status.ts.
 */
export async function GET() {
  const config = getPaymentCurrencyConfig()
  const sample = convertCurrency(1, "AP", "PIXEL")

  return NextResponse.json(
    {
      status: config.pixelCurrencyStatus,
      pixelCurrencyEnabled: config.pixelCurrencyEnabled,
      defaultCurrency: config.defaultCurrency,
      fallbackCurrency: config.fallbackCurrency,
      acceptedCurrencies: config.acceptedCurrencies,
      manifestCurrencies: config.manifestCurrencies,
      conversionOracle: config.conversionOracle,
      conversion: {
        mode: getConversionMode(),
        placeholderOracleRate: getPlaceholderOracleRate(),
        sample: {
          from: sample.from,
          to: sample.to,
          amountIn: sample.amountIn,
          amountOut: sample.amountOut,
          rate: sample.rate,
          status: sample.status,
          note: sample.note,
        },
      },
      currencies: {
        AP: CURRENCIES.AP,
        PIXEL: CURRENCIES.PIXEL,
      },
      notes: [
        "Descriptive only. Zulo takes no payments; payments are parked and nothing here is a way to pay.",
        "#PIXEL is the official name for action points: earned by burning or bought on the Pixel Market; painting never spends it.",
      ],
      asOf: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    },
  )
}
