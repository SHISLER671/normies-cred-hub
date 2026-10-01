import { type NextRequest, NextResponse } from "next/server"

import { fetchControlledNormiesWithMeta } from "@/lib/controlled-normies"

/** Fast path only: Canvas delegates are read from the index; the live scan is paginated client-side via /api/canvas-delegates. */
export const maxDuration = 10

/**
 * Returns Normies controlled by a wallet:
 * direct owner, Delegate.xyz vault delegate, or Normies Canvas hot-wallet delegate.
 */
export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address")?.trim()

  if (!address || !/^0x[a-fA-F0-9]{40}$/i.test(address)) {
    return NextResponse.json({ error: "A valid address query param is required." }, { status: 400 })
  }

  try {
    const { normies, canvas } = await fetchControlledNormiesWithMeta(address)
    return NextResponse.json(
      {
        normies,
        // Canvas delegates come from the index, so they can lag. asOf = oldest index row; checked=false means
        // the index could not be read and Canvas delegations are UNKNOWN for this wallet.
        canvasDelegates: { asOf: canvas.asOf, checked: canvas.checked },
      },
      {
        headers: {
          "Cache-Control": "private, max-age=30, stale-while-revalidate=120",
        },
      },
    )
  } catch (err) {
    console.error("[my-normies] Failed to fetch controlled Normies", err)
    return NextResponse.json(
      { error: "Could not load Normies for this wallet." },
      { status: 502 },
    )
  }
}