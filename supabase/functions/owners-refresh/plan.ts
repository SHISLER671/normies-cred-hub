// Plan a refresh of normie_index.owner from the chain (ownerOf per living token). Pure: no I/O.
// The bulk rarity list has no owners, so this is the only source. Only `owner` is changed here; burned flags stay with
// the census refresh (lib/census-refresh.ts), which has the complete official list to check against.

export interface OwnerRowLite {
  token_id: number
  owner: string | null
  burned: boolean
}

/** Result of one ownerOf call: an address, or null when the call failed (reverted or the RPC erred). */
export type ChainOwners = ReadonlyMap<number, string | null>

export interface OwnersPlan {
  updates: Array<{ token_id: number; owner: string }>
  unchanged: number
  /** Living in the index but the chain call failed: left exactly as they are, listed for the report. */
  unknown: number[]
  /** False means: write nothing, something is off (an RPC problem, or far more churn than a few days can explain). */
  ok: boolean
  why: string
}

export const MAX_OWNER_CHANGE_SHARE = 0.3
export const MAX_UNKNOWN_SHARE = 0.05

const norm = (a: string | null | undefined) => (a ?? "").toLowerCase()
const ADDRESS = /^0x[a-f0-9]{40}$/

export function planOwnersRefresh(chain: ChainOwners, index: readonly OwnerRowLite[]): OwnersPlan {
  const living = index.filter((r) => !r.burned)
  const updates: OwnersPlan["updates"] = []
  const unknown: number[] = []
  let unchanged = 0

  for (const row of living) {
    const got = chain.get(row.token_id)
    const owner = typeof got === "string" ? got.toLowerCase() : null
    if (!owner || !ADDRESS.test(owner)) { unknown.push(row.token_id); continue }
    if (owner === norm(row.owner)) unchanged++
    else updates.push({ token_id: row.token_id, owner })
  }

  const n = Math.max(1, living.length)
  if (unknown.length / n > MAX_UNKNOWN_SHARE) {
    return { updates: [], unchanged, unknown, ok: false, why: `${unknown.length} of ${living.length} owner lookups failed (over ${MAX_UNKNOWN_SHARE * 100}%): the RPC is unreliable, nothing written` }
  }
  if (updates.length / n > MAX_OWNER_CHANGE_SHARE) {
    return { updates: [], unchanged, unknown, ok: false, why: `${updates.length} of ${living.length} owners would change (over ${MAX_OWNER_CHANGE_SHARE * 100}%): too many to be real, nothing written` }
  }
  return { updates, unchanged, unknown, ok: true, why: "ok" }
}
