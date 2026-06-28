import { type NextRequest, NextResponse } from "next/server"
import { fetchWithTimeout, isTimeoutError } from "@/lib/fetch-with-timeout"

const AGENTCHECK_API_BASE = "https://agentcheck-bice.vercel.app"

/**
 * Read-only proxy for the public AgentCheck reputation API (ERC-8257 Tool #13).
 * Forwards to GET /api/check?wallet=. No wallet auth required.
 * Keeps the third-party call server-side (avoids CORS) and applies a timeout.
 */
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet")?.toLowerCase()

  if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
    return NextResponse.json({ error: "A valid 0x address is required" }, { status: 400 })
  }

  try {
    const res = await fetchWithTimeout(
      `${AGENTCHECK_API_BASE}/api/check?wallet=${wallet}`,
      { headers: { Accept: "application/json" }, next: { revalidate: 300 } },
      12_000,
    )

    if (!res.ok) {
      return NextResponse.json(
        { error: `AgentCheck upstream returned ${res.status}` },
        { status: res.status },
      )
    }

    const data = await res.json()

    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    })
  } catch (err) {
    if (isTimeoutError(err)) {
      return NextResponse.json({ error: "AgentCheck timed out" }, { status: 504 })
    }
    return NextResponse.json(
      { error: "Failed to reach AgentCheck API", detail: String(err) },
      { status: 502 },
    )
  }
}
