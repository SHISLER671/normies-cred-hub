import { type NextRequest, NextResponse } from "next/server"

import { fetchCanvasDelegatedFromIndex } from "@/lib/controlled-normies"

/**
 * Canvas delegations for a wallet, read from the index (a database read: no calls to the Normies API). The index is refreshed hourly by a
 * scheduled job, so this is the fast path; /api/canvas-delegates (the live scan) is only used when this finds nothing.
 */
export const maxDuration = 10

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address")?.trim()
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json({ error: "A valid address query param is required." }, { status: 400 })
  }
  const { tokenIds, asOf, checked } = await fetchCanvasDelegatedFromIndex(address)
  return NextResponse.json({ tokenIds, asOf, checked }, { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=120" } })
}
