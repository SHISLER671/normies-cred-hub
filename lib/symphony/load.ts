// Server-side loader for Pixel Symphony voices. Read-only: official api.normies.art routes only, cached 5 minutes.
// With a block, the pixels are the version that was active at that block (/history/normie/{id}/versions), or the
// original mint bitmap if the Normie hadn't been painted yet. Nothing is stored.

import { NORMIES_API_BASE } from "@/constants/contracts"
import { fetchWithTimeout } from "@/lib/fetch-with-timeout"

import { loadNormieTraits } from "@/lib/normie-traits"

import { parseBinding } from "./awakened"
import { isPlayableGrid } from "./grid"
import { pickVersionAtBlock, readVersions } from "./pin"
import type { AwakenedBinding, NormieTrait } from "./types"

export type LoadedVoice = {
  tokenId: number
  name: string
  pixels: string
  gridSize: number
  traits: NormieTrait[]
  /** What the pixels came from: "live", "original" (before any paint at that block) or a version number. */
  pixels_from: "live" | "original" | number
  /** ERC-8004 binding if awakened (by `block`, when pinned); null for a regular Normie or if the lookup fails. */
  awakened: AwakenedBinding | null
}

/** Thrown when an upstream read fails (timeout, 5xx), as opposed to a real "not found". Pinned songs must not be
 * built, or cached for a week, from a guess. */
export class SymphonyUpstreamError extends Error {}

type Read = { ok: true; data: unknown } | { ok: false; notFound: boolean }

async function read(path: string, asJson: boolean): Promise<Read> {
  try {
    const r = await fetchWithTimeout(
      `${NORMIES_API_BASE}${path}`,
      { headers: asJson ? { Accept: "application/json" } : {}, next: { revalidate: 300 } },
      8_000,
    )
    if (!r.ok) return { ok: false, notFound: r.status === 404 }
    return { ok: true, data: asJson ? await r.json() : (await r.text()).trim() }
  } catch {
    return { ok: false, notFound: false }
  }
}

async function get(path: string, asJson: boolean): Promise<unknown> {
  const r = await read(path, asJson)
  return r.ok ? r.data : null
}

function cleanPixels(raw: unknown): string | null {
  const bits = typeof raw === "string" ? raw.replace(/[^01]/g, "") : ""
  return bits && isPlayableGrid(bits) ? bits : null
}

async function pixelsAt(tokenId: number, block: number | null): Promise<{ pixels: string | null; from: LoadedVoice["pixels_from"] }> {
  if (block === null) return { pixels: cleanPixels(await get(`/normie/${tokenId}/pixels`, false)), from: "live" }
  // A failed history read used to fall back to the mint pixels and get cached as the pinned song. Now it's an error;
  // only a real "no versions" (404 or an empty list) means "not painted by that block".
  const versionsRead = await read(`/history/normie/${tokenId}/versions?limit=500`, true)
  if (!versionsRead.ok && !versionsRead.notFound) throw new SymphonyUpstreamError(`history unavailable for #${tokenId}`)
  const v = pickVersionAtBlock(readVersions(versionsRead.ok ? versionsRead.data : null), block)
  if (v) {
    const p = cleanPixels(await get(`/history/normie/${tokenId}/version/${v.version}/pixels`, false))
    if (!p) throw new SymphonyUpstreamError(`version ${v.version} pixels unavailable for #${tokenId}`)
    return { pixels: p, from: v.version }
  }
  return { pixels: cleanPixels(await get(`/normie/${tokenId}/original/pixels`, false)), from: "original" }
}

/**
 * One Normie's pixels (live, or at a block), traits, agent name and awakened binding. null if its pixels can't be read
 * (e.g. burned). Throws SymphonyUpstreamError when a pinned read failed, so callers don't cache a wrong song.
 */
export async function loadVoice(tokenId: number, block: number | null): Promise<LoadedVoice | null> {
  const [{ pixels, from }, traits, identity, binding] = await Promise.all([
    pixelsAt(tokenId, block),
    // Base traits from the official /metadata, /traits only if that fails (lib/normie-traits.ts).
    loadNormieTraits(tokenId, (path) => get(path, true)),
    get(`/agents/identity/${tokenId}`, true) as Promise<{ name?: string | null } | null>,
    get(`/agents/binding/${tokenId}`, true),
  ])
  if (!pixels) return null
  return {
    tokenId,
    name: identity?.name?.trim() || `Normie #${tokenId}`,
    pixels,
    gridSize: Math.round(Math.sqrt(pixels.length)),
    traits: (traits?.attributes ?? []).map((t) => ({ trait_type: t.trait_type, value: t.value })),
    pixels_from: from,
    // A failed or missing lookup just means no extra layers: the Normie still plays its full part.
    awakened: parseBinding(binding, block),
  }
}
