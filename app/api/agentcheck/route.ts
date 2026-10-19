import { type NextRequest, NextResponse } from "next/server"
import { fetchWithTimeout, isTimeoutError } from "@/lib/fetch-with-timeout"
import { enforceDualRateLimit } from "@/lib/middleware/rateLimit"

const AGENTCHECK_API_BASE = "https://agentcheck-bice.vercel.app"

/**
 * Read-only proxy for the public AgentCheck reputation API (ERC-8257 Tool #13).
 * Forwards to GET /api/check?wallet=. No wallet auth required.
 * Keeps the third-party call server-side (avoids CORS) and applies a timeout.
 */
export async function GET(req: NextRequest) {
  const rl = await enforceDualRateLimit(req, "default", { bucketPrefix: "agentcheck" })
  if (!rl.ok) return rl.response
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
      console.warn("[agentcheck] upstream", res.status)
      return NextResponse.json({ error: "AgentCheck is unavailable right now" }, { status: 502 })
    }

    const data = await res.json()

    return NextResponse.json(data, {
      // Per-wallet answer: cache in the browser only, not on the shared CDN.
      headers: { "Cache-Control": "private, max-age=300" },
    })
  } catch (err) {
    if (isTimeoutError(err)) {
      return NextResponse.json({ error: "AgentCheck timed out" }, { status: 504 })
    }
    console.error("[agentcheck]", err)
    return NextResponse.json({ error: "Failed to reach AgentCheck" }, { status: 502 })
  }
}
