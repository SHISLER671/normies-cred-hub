import { NORMIES_API_BASE } from "@/constants/contracts"
import { fetchWithTimeout } from "@/lib/fetch-with-timeout"
import { MAX_BATCH_BYTES, MAX_BATCH_IDS, resolveUpstream, UPSTREAM_TIMEOUT_MS } from "@/lib/normies-proxy"
import { enforceDualRateLimit } from "@/lib/middleware/rateLimit"
import { type NextRequest, NextResponse } from "next/server"

async function proxyJson(upstream: string, init: RequestInit | undefined, cacheSeconds: number): Promise<NextResponse> {
  try {
    const res = await fetchWithTimeout(
      upstream,
      {
        ...init,
        headers: { Accept: "application/json", ...(init?.headers ?? {}) },
        next: { revalidate: cacheSeconds },
      },
      UPSTREAM_TIMEOUT_MS,
    )

    if (!res.ok) {
      // Pass 404 through (a real "not found"); everything else is an upstream problem.
      const status = res.status === 404 ? 404 : 502
      return NextResponse.json(
        { error: status === 404 ? "Not found" : "The Normies API is unavailable right now" },
        { status, headers: { "Cache-Control": "no-store" } },
      )
    }

    const data = await res.json()
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": `public, s-maxage=${cacheSeconds}, stale-while-revalidate=${cacheSeconds * 2}`,
      },
    })
  } catch (err) {
    console.error("[normies-proxy]", upstream, err)
    return NextResponse.json(
      { error: "Failed to reach the Normies API" },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    )
  }
}

/**
 * Read-only proxy for the public Normies API, limited to the routes the app uses.
 * Keeps third-party calls server-side (no CORS, centralized caching).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const rl = await enforceDualRateLimit(req, "default", { bucketPrefix: "normies-proxy" })
  if (!rl.ok) return rl.response

  const { path } = await params
  const segments = path ?? []
  const upstream = resolveUpstream(segments)
  if (!upstream) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const cacheSeconds = segments[0] === "holders" ? 10 : 300
  return proxyJson(upstream, undefined, cacheSeconds)
}

/** Batch binding lookup: read-only POST passthrough, validated and size-capped. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const rl = await enforceDualRateLimit(req, "default", { bucketPrefix: "normies-proxy-batch" })
  if (!rl.ok) return rl.response

  const { path } = await params
  const segments = path ?? []
  if (segments.join("/") !== "agents/binding/batch") {
    return NextResponse.json({ error: "Method not allowed for this path" }, { status: 405 })
  }

  const declared = Number(req.headers.get("content-length") ?? 0)
  if (declared > MAX_BATCH_BYTES) return NextResponse.json({ error: "Body too large" }, { status: 413 })
  const text = await req.text()
  if (text.length > MAX_BATCH_BYTES) return NextResponse.json({ error: "Body too large" }, { status: 413 })

  let tokenIds: number[]
  try {
    const parsed = JSON.parse(text) as { tokenIds?: unknown }
    if (!Array.isArray(parsed.tokenIds)) throw new Error("tokenIds must be an array")
    tokenIds = [...new Set(parsed.tokenIds.map(Number))].filter((n) => Number.isInteger(n) && n >= 0 && n <= 9999)
    if (tokenIds.length > MAX_BATCH_IDS) throw new Error("too many ids")
  } catch {
    return NextResponse.json({ error: `Body must be {"tokenIds": number[]} with at most ${MAX_BATCH_IDS} ids` }, { status: 400 })
  }

  return proxyJson(
    `${NORMIES_API_BASE}/agents/binding/batch`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tokenIds }) },
    60,
  )
}
