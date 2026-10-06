// Maps a POST JSON body for /api/ap-check onto the same query parameters GET uses, so both methods share one code path.
// Only the known fields are copied; anything else is ignored. Pure, so it is unit tested without a server.

const STRING_FIELDS = ["wallet", "approvals", "contract", "calc"] as const
const NUMBER_FIELDS = ["token", "amount"] as const

/** null when the body is not a plain JSON object. */
export function bodyToParams(body: unknown): URLSearchParams | null {
  if (body === null || typeof body !== "object" || Array.isArray(body)) return null
  const b = body as Record<string, unknown>
  const sp = new URLSearchParams()
  for (const k of NUMBER_FIELDS) {
    const v = b[k]
    if (typeof v === "number" && Number.isFinite(v)) sp.set(k, String(v))
    else if (typeof v === "string" && v.trim() !== "") sp.set(k, v.trim())
  }
  for (const k of STRING_FIELDS) {
    const v = b[k]
    if (typeof v === "string") sp.set(k, v.trim())
  }
  const listings = b.listings
  if (listings === true || listings === 1 || listings === "1" || listings === "true") sp.set("listings", "1")
  return sp
}
