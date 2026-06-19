import { NORMIES_API_BASE } from "@/constants/contracts"
import { type NextRequest, NextResponse } from "next/server"

/**
 * Read-only proxy for the public Normies API.
 *
 * Maps `/api/normies/<...path>` to `https://api.normies.art/normie/<...path>`,
 * with one special case: `/api/normies/<id>/agent` → `/agents/info/<id>`.
 *
 * This keeps all third-party calls server-side (no CORS, centralized caching)
 * and only ever performs GET requests — no writes are possible through here.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params
  const segments = path ?? []

  let upstream: string
  if (segments.length === 2 && segments[1] === "agent") {
    // /api/normies/7141/agent -> /agents/info/7141
    upstream = `${NORMIES_API_BASE}/agents/info/${segments[0]}`
  } else if (segments.length === 3 && segments[0] === "agents" && segments[1] === "binding") {
    // support /api/normies/agents/binding/7141 -> /agents/binding/7141
    upstream = `${NORMIES_API_BASE}/agents/binding/${segments[2]}`
  } else {
    upstream = `${NORMIES_API_BASE}/normie/${segments.join("/")}`
  }

  try {
    const res = await fetch(upstream, {
      headers: { Accept: "application/json" },
      // Cache upstream responses for 5 minutes, allow stale-while-revalidate.
      next: { revalidate: 300 },
    })

    if (!res.ok) {
      return NextResponse.json(
        { error: `Upstream returned ${res.status}`, path: segments.join("/") },
        { status: res.status },
      )
    }

    const data = await res.json()
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    })
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to reach Normies API", detail: String(err) },
      { status: 502 },
    )
  }
}
