import { type NextRequest, NextResponse } from "next/server"

import { getCanvasDelegatedTokenIds } from "@/lib/canvas-delegate-index"

/** Canvas delegate scan walks ~12 pages of awakened agents; allow extra time on Vercel. */
export const maxDuration = 60

/**
 * Returns token IDs where the wallet is set as the Normies Canvas delegate.
 * Result is cached per address for 10 minutes.
 */
export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address")?.trim()

  if (!address || !/^0x[a-fA-F0-9]{40}$/i.test(address)) {
    return NextResponse.json({ error: "A valid address query param is required." }, { status: 400 })
  }

  try {
    const tokenIds = await getCanvasDelegatedTokenIds(address)
    return NextResponse.json(
      { tokenIds },
      {
        headers: {
          "Cache-Control": "private, max-age=60, stale-while-revalidate=300",
        },
      },
    )
  } catch (err) {
    console.error("[canvas-delegates] scan failed", err)
    return NextResponse.json(
      { error: "Could not resolve Canvas delegate Normies for this wallet." },
      { status: 502 },
    )
  }
}