// Server-only: the market-or-burn compare as a JSON response, shared by /api/burn/ap-check (its home) and the old
// /api/ap-check?calc= (kept working for the ERC-8257 manifest pinned on chain; Ryan chose this on 2026-11-10 over a 410,
// so registered agent calls don't break before the manifest is re-registered). Every answer ships COMPARE_API_NOTES.

import { NextResponse } from "next/server"

import { planForBudget, planForPixels } from "./buy-smart"
import { loadBuySmart } from "./buy-smart-load"
import { COMPARE_API_NOTES } from "./compare-api"

export async function compareResponse(
  sp: URLSearchParams,
  isPost: boolean,
  /** Extra fields for the old address (movedTo, page, deprecated). Additive only. */
  extra: Record<string, unknown> = {},
): Promise<NextResponse> {
  const cache = isPost ? { "Cache-Control": "no-store" } : { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30" }
  const calc = sp.get("calc")
  if (calc !== "pixels" && calc !== "eth") {
    return NextResponse.json({ error: "pass calc=pixels or calc=eth, with amount", code: "invalid_calc", ...extra }, { status: 400 })
  }
  const amount = Number(sp.get("amount"))
  const ok = calc === "pixels" ? Number.isInteger(amount) && amount > 0 && amount <= 1_000_000 : amount > 0 && amount <= 1_000
  if (!ok) {
    return NextResponse.json(
      { error: "amount must be a positive whole number of pixels (calc=pixels) or ETH up to 1000 (calc=eth)", code: "invalid_amount", ...extra },
      { status: 400 },
    )
  }
  try {
    const inputs = await loadBuySmart()
    if (!inputs) {
      return NextResponse.json({ error: "listings or the Pixel Market could not be read", code: "unavailable", retryable: true }, { status: 502 })
    }
    const depth = inputs.book && !inputs.book.paused ? inputs.book.depth : null
    const plan = calc === "pixels" ? planForPixels(inputs.picks, depth, amount) : planForBudget(inputs.picks, depth, amount)
    return NextResponse.json(
      {
        answer: plan,
        yieldMode: inputs.yieldMode,
        modeSource: inputs.modeSource,
        listingsChecked: inputs.listingsChecked,
        liveConfirmed: inputs.liveConfirmed,
        asOf: inputs.asOf,
        ...COMPARE_API_NOTES,
        ...extra,
      },
      { headers: cache },
    )
  } catch (err) {
    console.error("[compare] unexpected failure", err)
    return NextResponse.json({ error: "Something went wrong on our side.", code: "internal", retryable: true }, { status: 500 })
  }
}
