import { NextResponse } from 'next/server'
import { tools } from '@/lib/tools'

/**
 * Tools list for the Normies ecosystem.
 *
 * The public normies.art/tools page is fully client-rendered, so a server-side
 * fetch returns no usable markup — the previous implementation fetched it,
 * never parsed it, and always fell through to the static list anyway. That
 * wasted a network round-trip on every cache miss for zero benefit.
 *
 * Until normies.art exposes a JSON API for tools, we serve the curated static
 * list directly. This is fast, deterministic, and cacheable.
 */
export async function GET() {
  return NextResponse.json(tools, {
    headers: {
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
