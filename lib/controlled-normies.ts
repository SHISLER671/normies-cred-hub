import { getAddress } from "viem"

import { getSupabase } from "@/lib/db/supabase"
import { enrichOwnedNormiesServer } from "@/lib/normies-server"
import { NORMIES_API_BASE } from "@/constants/contracts"
import { findDelegateXyz, registryReaders, type DelegateXyzResult } from "@/lib/delegations"
import { fetchWithRetry } from "@/lib/fetch-with-retry"
import { publicClient } from "@/lib/viem-client"
import type { OwnedNormie } from "@/lib/types"
import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Token IDs the Normies API says `address` holds. An empty wallet is a 200 with `[]`, so any failure
 * here (after retries) throws instead of returning `[]`: "could not look it up" must never read as "holds nothing".
 */
async function fetchDirectHolderIds(address: `0x${string}`): Promise<number[]> {
  const res = await fetchWithRetry(`${NORMIES_API_BASE}/holders/${address}`, {}, 10_000)
  if (!res.ok) throw new Error(`Normies holders lookup failed (${res.status}) for ${address}`)

  const data = (await res.json()) as { tokenIds?: Array<number | string> }
  return (data.tokenIds ?? [])
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id))
}

export type CanvasLookup = {
  tokenIds: number[]
  /** When the OLDEST row of the index was last refreshed; null if the index could not be read. */
  asOf: string | null
  /** false when the index could not be read, so "no Canvas delegations" is unknown, not a fact. */
  checked: boolean
}

/**
 * Canvas delegations come from `normie_index.delegate`, not from a live scan: the scan made hundreds of
 * requests per call against a 60/min limit. The cost is staleness, so the caller gets `asOf`.
 */
export async function fetchCanvasDelegatedFromIndex(
  address: string,
  db: Pick<SupabaseClient, "from"> | null = getSupabase(),
): Promise<CanvasLookup> {
  if (!db) return { tokenIds: [], asOf: null, checked: false }
  // The zero address is how "no delegate" is stored in the index, so it is never a real delegate (a checked, empty answer).
  if (/^0x0+$/i.test(address)) return { tokenIds: [], asOf: null, checked: true }
  try {
    const [rows, oldest] = await Promise.all([
      db.from("normie_index").select("token_id").eq("burned", false).eq("delegate", address.toLowerCase()),
      db.from("normie_index").select("indexed_at").order("indexed_at", { ascending: true }).limit(1),
    ])
    if (rows.error || oldest.error) throw new Error((rows.error ?? oldest.error)?.message)
    return {
      tokenIds: (rows.data ?? []).map((r: { token_id: number }) => Number(r.token_id)),
      asOf: (oldest.data?.[0] as { indexed_at?: string } | undefined)?.indexed_at ?? null,
      checked: true,
    }
  } catch {
    return { tokenIds: [], asOf: null, checked: false }
  }
}

export type ControlledLookup = { tokenIds: number[]; canvas: Omit<CanvasLookup, "tokenIds">; delegateXyz: Pick<DelegateXyzResult, "checked" | "failedVaults"> }

/** All token IDs the wallet controls: owner, Delegate.xyz (v1 and v2, see lib/delegations.ts), or Canvas delegate (from the index). */
export async function lookupControlled(address: string): Promise<ControlledLookup> {
  const normalized = getAddress(address) as `0x${string}`

  const [directIds, delegateXyz, canvas] = await Promise.all([
    fetchDirectHolderIds(normalized),
    findDelegateXyz(normalized, { ...registryReaders(publicClient), holdersOf: fetchDirectHolderIds }),
    fetchCanvasDelegatedFromIndex(normalized),
  ])

  const tokenIds = Array.from(
    new Set([...directIds, ...delegateXyz.entries.map((e) => e.tokenId), ...canvas.tokenIds]),
  ).sort((a, b) => a - b)
  return {
    tokenIds,
    canvas: { asOf: canvas.asOf, checked: canvas.checked },
    delegateXyz: { checked: delegateXyz.checked, failedVaults: delegateXyz.failedVaults },
  }
}

export async function fetchControlledTokenIds(address: string): Promise<number[]> {
  return (await lookupControlled(address)).tokenIds
}

export async function fetchControlledNormies(address: string): Promise<OwnedNormie[]> {
  return enrichOwnedNormiesServer(await fetchControlledTokenIds(address))
}

/** Same as fetchControlledNormies, plus how fresh the Canvas-delegate part is. */
export async function fetchControlledNormiesWithMeta(address: string) {
  const { tokenIds, canvas } = await lookupControlled(address)
  return { normies: await enrichOwnedNormiesServer(tokenIds), canvas }
}
