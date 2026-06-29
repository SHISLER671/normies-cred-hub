import { type NextRequest, NextResponse } from "next/server"

import { scanCanvasDelegatePage } from "@/lib/canvas-delegate-index"

/**
 * Scans one page of awakened agents per request (~5–9s) so each call stays
 * within Vercel Hobby's 10s serverless limit. Clients paginate with `cursor`.
 */
export const maxDuration = 10

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address")?.trim()
  const cursor = req.nextUrl.searchParams.get("cursor")?.trim() || null

  if (!address || !/^0x[a-fA-F0-9]{40}$/i.test(address)) {
    return NextResponse.json({ error: "A valid address query param is required." }, { status: 400 })
  }

  try {
    const page = await scanCanvasDelegatePage(address, cursor)
    return NextResponse.json(page, {
      headers: {
        "Cache-Control": "private, max-age=30, stale-while-revalidate=120",
      },
    })
  } catch (err) {
    console.error("[canvas-delegates] page scan failed", err)
    return NextResponse.json(
      { error: "Could not scan Canvas delegates for this page." },
      { status: 502 },
    )
  }
}