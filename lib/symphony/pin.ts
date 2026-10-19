// Stateless, block-pinned share links for Pixel Symphony. Pure (no network).
// A link is just Normie ids + an Ethereum block number: opening it recomputes the song from the official API at that
// block, so nothing is ever saved and anyone who opens it hears the same song.

/** Most Normies layered in one room (browser CPU and API politeness). */
export const MAX_ROOM = 12

/** "7141, 1 42;7141" → [7141, 1, 42]. Keeps order, drops duplicates and anything outside 0–9999, caps at MAX_ROOM. */
export function parseIds(raw: string | null | undefined): number[] {
  const out: number[] = []
  for (const part of (raw ?? "").split(/[^\d]+/)) {
    if (!part || part.length > 4) continue
    const n = Number(part)
    if (Number.isInteger(n) && n >= 0 && n <= 9999 && !out.includes(n)) out.push(n)
    if (out.length === MAX_ROOM) break
  }
  return out
}

/** A positive integer block number, or null. */
export function parseBlock(raw: string | null | undefined): number | null {
  if (!raw || !/^\d{1,10}$/.test(raw)) return null
  const n = Number(raw)
  return n > 0 ? n : null
}

export type VersionEntry = { version: number; block: number }

/**
 * Normalise the /history/normie/{id}/versions response. Its block field name isn't documented, so accept the common
 * spellings; entries without a usable version and block are skipped (never guessed).
 */
export function readVersions(body: unknown): VersionEntry[] {
  const list: unknown[] = Array.isArray(body)
    ? body
    : body && typeof body === "object"
      ? (((body as Record<string, unknown>).versions ?? (body as Record<string, unknown>).items ?? (body as Record<string, unknown>).data) as unknown[]) ?? []
      : []
  const out: VersionEntry[] = []
  for (const v of Array.isArray(list) ? list : []) {
    if (!v || typeof v !== "object") continue
    const r = v as Record<string, unknown>
    const version = Number(r.version)
    const block = Number(r.blockNumber ?? r.block ?? r.block_number)
    if (Number.isInteger(version) && Number.isInteger(block) && block > 0) out.push({ version, block })
  }
  return out.sort((a, b) => a.block - b.block || a.version - b.version)
}

/** The version that was active at `block`: the newest one at or before it. null → the original mint pixels apply. */
export function pickVersionAtBlock(versions: VersionEntry[], block: number): VersionEntry | null {
  let pick: VersionEntry | null = null
  for (const v of versions) if (v.block <= block && (!pick || v.block > pick.block || (v.block === pick.block && v.version > pick.version))) pick = v
  return pick
}

/** /symphony?ids=7141,1,42&block=21034567 */
export function symphonyPath(ids: number[], block: number | null): string {
  const q = new URLSearchParams()
  if (ids.length) q.set("ids", ids.join(","))
  if (block) q.set("block", String(block))
  const s = q.toString().replace(/%2C/g, ",")
  return s ? `/symphony?${s}` : "/symphony"
}

/** Post on X / share-sheet text. Same shape as the record card's: pixel squares first, the official tag last. */
export function symphonyShareText(names: string[], block: number | null): string {
  const who = names.length <= 1 ? names[0] ?? "A Normie" : `${names[0]} + ${names.length - 1} Normie${names.length > 2 ? "s" : ""}`
  return `🔲🔳 ${who} singing on Pixel Symphony${block ? ` (block ${block})` : ""}: on-chain pixels as music. @normiesART`
}
