import { NORMIES_API_BASE } from "@/constants/contracts"
import { type NextRequest, NextResponse } from "next/server"

function resolveUpstream(segments: string[]): string {
  if (segments.length === 2 && segments[0] === "holders") {
    return `${NORMIES_API_BASE}/holders/${segments[1]}`
  }

  if (segments.length === 2 && segments[1] === "agent") {
    return `${NORMIES_API_BASE}/agents/info/${segments[0]}`
  }

  if (segments.length === 3 && segments[0] === "agents" && segments[1] === "binding") {
    return `${NORMIES_API_BASE}/agents/binding/${segments[2]}`
  }

  if (segments.length === 3 && segments[0] === "agents" && segments[1] === "identity") {
    return `${NORMIES_API_BASE}/agents/identity/${segments[2]}`
  }

  if (
    segments.length === 3 &&
    segments[0] === "agents" &&
    segments[1] === "binding" &&
    segments[2] === "batch"
  ) {
    return `${NORMIES_API_BASE}/agents/binding/batch`
  }

  return `${NORMIES_API_BASE}/normie/${segments.join("/")}`
}

async function proxyJson(
  upstream: string,
  init?: RequestInit,
  cacheSeconds = 300,
): Promise<NextResponse> {
  try {
    const res = await fetch(upstream, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init?.headers ?? {}),
      },
      next: { revalidate: cacheSeconds },
    })

    if (!res.ok) {
      return NextResponse.json(
        { error: `Upstream returned ${res.status}` },
        { status: res.status },
      )
    }

    const data = await res.json()
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": `public, s-maxage=${cacheSeconds}, stale-while-revalidate=${cacheSeconds * 2}`,
      },
    })
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to reach Normies API", detail: String(err) },
      { status: 502 },
    )
  }
}

/**
 * Read-only proxy for the public Normies API.
 *
 * Maps `/api/normies/<...path>` to the corresponding `https://api.normies.art` route.
 * Keeps third-party calls server-side (no CORS, centralized caching).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params
  const segments = path ?? []
  const upstream = resolveUpstream(segments)
  const cacheSeconds = segments[0] === "holders" ? 10 : 300
  return proxyJson(upstream, undefined, cacheSeconds)
}

/** Batch binding lookup — read-only POST passthrough. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params
  const segments = path ?? []

  if (
    segments.length !== 3 ||
    segments[0] !== "agents" ||
    segments[1] !== "binding" ||
    segments[2] !== "batch"
  ) {
    return NextResponse.json({ error: "Method not allowed for this path" }, { status: 405 })
  }

  const body = await req.text()
  const upstream = `${NORMIES_API_BASE}/agents/binding/batch`

  return proxyJson(
    upstream,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    },
    60,
  )
}