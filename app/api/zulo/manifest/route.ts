// GET /api/zulo/manifest — marketplace discovery for Zulo services.

import { NextResponse } from "next/server"

import { getManifest } from "@/lib/agent-recommendations/manifest"

export async function GET() {
  const manifest = await getManifest()
  return NextResponse.json(manifest, {
    headers: {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  })
}
