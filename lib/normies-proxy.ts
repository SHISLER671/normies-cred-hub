// Allowlist for the /api/normies/* proxy. Pure, so it is unit-tested (normies-proxy.test.ts).
import { NORMIES_API_BASE } from "@/constants/contracts"

const TOKEN_ID = /^\d{1,4}$/
const ADDRESS = /^0x[a-fA-F0-9]{40}$/
/** Per-Normie sub-routes the app reads through this proxy (lib/api/normies.ts). Anything else is a 404. */
const NORMIE_SUBPATHS = new Set(["traits", "metadata", "owner", "canvas/info", "canvas/diff", "agent"])
/** Batch binding body: up to this many ids, and this many bytes. */
export const MAX_BATCH_IDS = 1000
export const MAX_BATCH_BYTES = 16_384
export const UPSTREAM_TIMEOUT_MS = 8_000

/**
 * The upstream URL for an allowed path, or null. Allowlisted on purpose: this used to forward any `/normie/*` path
 * (including `..` and encoded `?`), which made it an anonymous open proxy onto the whole Normies API.
 */
export function resolveUpstream(segments: string[]): string | null {
  const [a, b, c] = segments
  if (segments.length === 2 && a === "holders" && ADDRESS.test(b)) return `${NORMIES_API_BASE}/holders/${b}`
  if (segments.length === 3 && a === "agents" && (b === "binding" || b === "identity") && TOKEN_ID.test(c)) {
    return `${NORMIES_API_BASE}/agents/${b}/${Number(c)}`
  }
  if (segments.length >= 2 && TOKEN_ID.test(a)) {
    const sub = segments.slice(1).join("/")
    if (!NORMIE_SUBPATHS.has(sub)) return null
    if (sub === "agent") return `${NORMIES_API_BASE}/agents/info/${Number(a)}`
    return `${NORMIES_API_BASE}/normie/${Number(a)}/${sub}`
  }
  return null
}

/** Most attributes the proxy passes on. A Normie has 14 today. */
export const MAX_METADATA_ATTRIBUTES = 64

export interface TrimmedMetadataAttribute {
  trait_type: string
  value: string | number
  display_type?: string
}

/**
 * What the proxy returns for /normie/{id}/metadata: only `name` and well-formed `attributes` (audit 2026-11-16).
 * The upstream also carries a base64 SVG `image` and an HTML `animation_url`; the app never uses them (images come from
 * the fixed /normie/{id}/image.svg URL), so they never reach the browser.
 */
export function trimMetadata(data: unknown): { name?: string; attributes: TrimmedMetadataAttribute[] } {
  const d = data !== null && typeof data === "object" ? (data as Record<string, unknown>) : {}
  const out: { name?: string; attributes: TrimmedMetadataAttribute[] } = { attributes: [] }
  if (typeof d.name === "string") out.name = d.name
  if (Array.isArray(d.attributes)) {
    for (const a of d.attributes) {
      if (out.attributes.length >= MAX_METADATA_ATTRIBUTES) break
      if (a === null || typeof a !== "object") continue
      const { trait_type, value, display_type } = a as Record<string, unknown>
      if (typeof trait_type !== "string") continue
      if (typeof value !== "string" && !(typeof value === "number" && Number.isFinite(value))) continue
      out.attributes.push(typeof display_type === "string" ? { trait_type, value, display_type } : { trait_type, value })
    }
  }
  return out
}

/** True when an upstream URL from resolveUpstream is a Normie's /metadata. */
export const isMetadataUpstream = (upstream: string): boolean => /\/normie\/\d+\/metadata$/.test(upstream)
