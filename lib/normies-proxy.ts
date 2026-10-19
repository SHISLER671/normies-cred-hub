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
