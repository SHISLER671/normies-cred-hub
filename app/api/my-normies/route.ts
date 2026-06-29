import { type NextRequest, NextResponse } from "next/server"

import { fetchControlledNormies } from "@/lib/controlled-normies"

/** Includes Canvas delegate scan across all awakened agents. */
export const maxDuration = 60

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
    const normies = await fetchControlledNormies(address)
    return NextResponse.json(
      { normies },
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