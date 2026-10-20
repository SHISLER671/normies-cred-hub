// The one place NCH reads a Normie's 8 base traits (GrokBot, 2026-10-20).
//
// Read from GET /normie/{id}/metadata (the official tokenURI-style metadata). GET /normie/{id}/traits disagrees with it for
// Zombies: #1, #2, #3 and #100 come back Type=Human there (with the pre-zombie Gender, Hair Style, etc.) while /metadata says
// Type=Zombie and /normie/{id}/zombie says isZombie: true, so NCH showed Zombie #2 as a Human. /agents/identity/{id} repeats the /traits values, so it is not a source
// for Type either. /traits is used only when /metadata can't be read, and the result says so (`source: "traits_fallback"`).
//
// /metadata also carries a base64 SVG image and animation: those are never kept, only the 8 base attributes.

import { NORMIES_API_BASE } from "@/constants/contracts"
import { fetchWithTimeout } from "@/lib/fetch-with-timeout"
import type { NormieTrait, NormieTraits } from "@/lib/types"

/** The 8 traits fixed at mint, in the official order. Canvas numbers (Level, Pixel Count, AP, ...) are not base traits. */
export const BASE_TRAIT_TYPES = [
  "Type",
  "Gender",
  "Age",
  "Hair Style",
  "Facial Feature",
  "Eyes",
  "Expression",
  "Accessory",
] as const

export type NormieTraitsSource = "metadata" | "traits_fallback"

/** Same shape as before (`raw`, `attributes`), plus where the traits came from. */
export type SourcedNormieTraits = NormieTraits & { source: NormieTraitsSource }

/** Human-readable source label for API responses and docs. */
export function traitsSourceLabel(tokenId: number | string, source: NormieTraitsSource): string {
  return source === "metadata"
    ? `GET /normie/${tokenId}/metadata (attributes)`
    : `GET /normie/${tokenId}/traits (fallback: /metadata unavailable)`
}

type RawAttr = { trait_type?: unknown; value?: unknown }

/** The 8 base attributes from any attributes list, in the official order. Missing ones are skipped. */
export function pickBaseTraits(attributes: unknown): NormieTrait[] {
  if (!Array.isArray(attributes)) return []
  const byType = new Map<string, string | number>()
  for (const a of attributes as RawAttr[]) {
    if (!a || typeof a.trait_type !== "string") continue
    if (typeof a.value !== "string" && typeof a.value !== "number") continue
    if (!byType.has(a.trait_type)) byType.set(a.trait_type, a.value)
  }
  const out: NormieTrait[] = []
  for (const t of BASE_TRAIT_TYPES) {
    const v = byType.get(t)
    if (v !== undefined) out.push({ trait_type: t, value: v })
  }
  return out
}

/** Traits from a /metadata payload, or null when it has no usable base traits (then the caller may fall back). */
export function traitsFromMetadata(metadata: unknown): SourcedNormieTraits | null {
  const attrs = pickBaseTraits((metadata as { attributes?: unknown } | null)?.attributes)
  if (!attrs.some((a) => a.trait_type === "Type")) return null
  return { raw: "", attributes: attrs, source: "metadata" }
}

/** Traits from a /traits payload (fallback only). */
export function traitsFromTraitsEndpoint(traits: unknown): SourcedNormieTraits | null {
  const t = traits as { raw?: unknown; attributes?: unknown } | null
  const attrs = pickBaseTraits(t?.attributes)
  if (attrs.length === 0) return null
  return { raw: typeof t?.raw === "string" ? t.raw : "", attributes: attrs, source: "traits_fallback" }
}

/** The Type trait ("Human", "Zombie", "Cat", "Alien", "Agent", ...) or null. */
export function traitType(traits: Pick<NormieTraits, "attributes"> | null | undefined): string | null {
  const v = traits?.attributes?.find((a) => a.trait_type === "Type")?.value
  return v === undefined || v === null ? null : String(v)
}

/** Fetches parsed JSON for an api.normies.art path, or null on any failure. Injected so tests and the browser can swap it. */
export type NormiesJsonGetter = (path: string) => Promise<unknown | null>

/**
 * Load a Normie's base traits: /metadata first, /traits only if /metadata fails. Null if both fail.
 * `getJson` defaults to a direct server read (8 s timeout, Next data cache 5 min).
 */
export async function loadNormieTraits(
  tokenId: number,
  getJson: NormiesJsonGetter = serverNormiesJson,
): Promise<SourcedNormieTraits | null> {
  const fromMeta = traitsFromMetadata(await getJson(`/normie/${tokenId}/metadata`).catch(() => null))
  if (fromMeta) return fromMeta
  return traitsFromTraitsEndpoint(await getJson(`/normie/${tokenId}/traits`).catch(() => null))
}

/** Server read of api.normies.art JSON. Never throws. The response (≈5 KB with the image) is cached by Next, not by us. */
export function serverNormiesJsonWith(timeoutMs: number): NormiesJsonGetter {
  return async (path) => {
    try {
      const res = await fetchWithTimeout(
        `${NORMIES_API_BASE}${path}`,
        { headers: { Accept: "application/json" }, next: { revalidate: 300 } } as RequestInit,
        timeoutMs,
      )
      if (!res.ok) return null
      return await res.json()
    } catch {
      return null
    }
  }
}

export const serverNormiesJson: NormiesJsonGetter = serverNormiesJsonWith(8_000)
