// GET /api/symphony/voice/{tokenId} — everything Pixel Symphony needs to compose one Normie, in one cached request.
// Read-only: the live pixel grid (/normie/{id}/pixels), its fixed traits, and the agent name if it has one.
// Nothing is stored; the song is recomputed from these on every play.

import { type NextRequest, NextResponse } from "next/server"

import { NORMIES_API_BASE } from "@/constants/contracts"
import { parseTokenId } from "@/lib/api/agent-pulse"
import { fetchWithTimeout } from "@/lib/fetch-with-timeout"
import { enforceDualRateLimit } from "@/lib/middleware/rateLimit"

const CACHE = { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" }

async function text(path: string): Promise<string | null> {
  try {
    const r = await fetchWithTimeout(`${NORMIES_API_BASE}${path}`, { next: { revalidate: 300 } }, 8_000)
    return r.ok ? (await r.text()).trim() : null
  } catch {
    return null
  }
}

async function json<T>(path: string): Promise<T | null> {
  try {
    const r = await fetchWithTimeout(`${NORMIES_API_BASE}${path}`, { headers: { Accept: "application/json" }, next: { revalidate: 300 } }, 8_000)
    return r.ok ? ((await r.json()) as T) : null
  } catch {
    return null
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ tokenId: string }> }) {
  const rl = await enforceDualRateLimit(req, "default", { bucketPrefix: "symphony" })
  if (!rl.ok) return rl.response

  const { tokenId: raw } = await params
  const tokenId = parseTokenId(raw)
  if (tokenId === null) return NextResponse.json({ error: "Invalid token ID (must be 0–9999)" }, { status: 400 })

  const [rawPixels, traits, identity] = await Promise.all([
    text(`/normie/${tokenId}/pixels`),
    json<{ attributes?: Array<{ trait_type: string; value: string | number }> }>(`/normie/${tokenId}/traits`),
    json<{ name?: string | null }>(`/agents/identity/${tokenId}`),
  ])

  const pixels = (rawPixels ?? "").replace(/[^01]/g, "")
  const side = Math.round(Math.sqrt(pixels.length))
  if (!pixels || side * side !== pixels.length) {
    return NextResponse.json({ error: "Couldn't read this Normie's pixels (it may be burned)" }, { status: 404 })
  }

  return NextResponse.json(
    {
      tokenId,
      name: identity?.name?.trim() || `Normie #${tokenId}`,
      pixels,
      gridSize: side,
      traits: (traits?.attributes ?? []).map((t) => ({ trait_type: t.trait_type, value: t.value })),
      source: { pixels: `GET /normie/${tokenId}/pixels`, traits: `GET /normie/${tokenId}/traits` },
      as_of: new Date().toISOString(),
    },
    { headers: CACHE },
  )
}
