// Server-side loader for Pixel Symphony voices. Read-only: official api.normies.art routes only, cached 5 minutes.
// With a block, the pixels are the version that was active at that block (/history/normie/{id}/versions), or the
// original mint bitmap if the Normie hadn't been painted yet. Nothing is stored.

import { NORMIES_API_BASE } from "@/constants/contracts"
import { fetchWithTimeout } from "@/lib/fetch-with-timeout"

import { pickVersionAtBlock, readVersions } from "./pin"
import type { NormieTrait } from "./types"

export type LoadedVoice = {
  tokenId: number
  name: string
  pixels: string
  gridSize: number
  traits: NormieTrait[]
  /** What the pixels came from: "live", "original" (before any paint at that block) or a version number. */
  pixels_from: "live" | "original" | number
}

async function get(path: string, asJson: boolean): Promise<unknown> {
  try {
    const r = await fetchWithTimeout(
      `${NORMIES_API_BASE}${path}`,
      { headers: asJson ? { Accept: "application/json" } : {}, next: { revalidate: 300 } },
      8_000,
    )
    if (!r.ok) return null
    return asJson ? await r.json() : (await r.text()).trim()
  } catch {
    return null
  }
}

function cleanPixels(raw: unknown): string | null {
  const bits = typeof raw === "string" ? raw.replace(/[^01]/g, "") : ""
  const n = Math.round(Math.sqrt(bits.length))
  return bits && n * n === bits.length ? bits : null
}

async function pixelsAt(tokenId: number, block: number | null): Promise<{ pixels: string | null; from: LoadedVoice["pixels_from"] }> {
  if (block === null) return { pixels: cleanPixels(await get(`/normie/${tokenId}/pixels`, false)), from: "live" }
  const versions = readVersions(await get(`/history/normie/${tokenId}/versions?limit=500`, true))
  const v = pickVersionAtBlock(versions, block)
  if (v) {
    const p = cleanPixels(await get(`/history/normie/${tokenId}/version/${v.version}/pixels`, false))
    if (p) return { pixels: p, from: v.version }
  }
  return { pixels: cleanPixels(await get(`/normie/${tokenId}/original/pixels`, false)), from: "original" }
}

/** One Normie's pixels (live, or at a block), traits and agent name. null if its pixels can't be read (e.g. burned). */
export async function loadVoice(tokenId: number, block: number | null): Promise<LoadedVoice | null> {
  const [{ pixels, from }, traits, identity] = await Promise.all([
    pixelsAt(tokenId, block),
    get(`/normie/${tokenId}/traits`, true) as Promise<{ attributes?: Array<{ trait_type: string; value: string | number }> } | null>,
    get(`/agents/identity/${tokenId}`, true) as Promise<{ name?: string | null } | null>,
  ])
  if (!pixels) return null
  return {
    tokenId,
    name: identity?.name?.trim() || `Normie #${tokenId}`,
    pixels,
    gridSize: Math.round(Math.sqrt(pixels.length)),
    traits: (traits?.attributes ?? []).map((t) => ({ trait_type: t.trait_type, value: t.value })),
    pixels_from: from,
  }
}
