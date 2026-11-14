// Pulse level 4, "Clean ownership & delegation": the reads. Read-only: one ownerOf call, one row from the owner index, and the
// delegate.xyz registries. The rule itself is in lib/ownership-check.ts. Every read has a time limit, and a read that fails or
// times out is reported as "couldn't read", never as a pass.

import { NORMIES_API_BASE, NORMIES_NFT } from "@/constants/contracts"
import { getSupabase } from "@/lib/db/supabase"
import { delegationCheckIncomplete, findDelegateXyz, registryReaders, type DelegateXyzResult } from "@/lib/delegations"
import { fetchWithTimeout } from "@/lib/fetch-with-timeout"
import { publicClient } from "@/lib/viem-client"

import { evaluateOwnershipCheck, type OwnershipCheck, type OwnershipInputs, type Readable } from "./ownership-check"

const READ_TIMEOUT_MS = 8_000
/** delegate.xyz is two registry reads, then one holdings lookup per vault they name. */
const DELEGATE_XYZ_TIMEOUT_MS = 12_000
const OWNER_OF_ABI = [
  { inputs: [{ name: "tokenId", type: "uint256" }], name: "ownerOf", outputs: [{ name: "", type: "address" }], stateMutability: "view", type: "function" },
] as const

export type IndexOwnerRow = { owner: string | null; owner_since: string | null }

/** The three reads behind the check. Each one throws when it can't read; none returns a guess. Injectable for tests. */
export type OwnershipDeps = {
  readChainOwner: (tokenId: number) => Promise<string>
  /** The normie_index row, or null when there is no row for this token. */
  readIndexRow: (tokenId: number) => Promise<IndexOwnerRow | null>
  readDelegateXyz: (owner: string) => Promise<DelegateXyzResult>
  now: () => Date
}

function withTimeout<T>(work: Promise<T>, ms = READ_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const limit = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("timed out")), ms)
  })
  return Promise.race([work, limit]).finally(() => clearTimeout(timer))
}

async function readable<T>(work: () => Promise<T>, ms = READ_TIMEOUT_MS): Promise<Readable<T>> {
  try {
    return { ok: true, value: await withTimeout(work(), ms) }
  } catch {
    return { ok: false }
  }
}

async function readChainOwner(tokenId: number): Promise<string> {
  return (await publicClient.readContract({ address: NORMIES_NFT, abi: OWNER_OF_ABI, functionName: "ownerOf", args: [BigInt(tokenId)] })) as string
}

async function readIndexRow(tokenId: number): Promise<IndexOwnerRow | null> {
  const db = getSupabase()
  if (!db) throw new Error("owner index is not configured")
  const { data, error } = await db.from("normie_index").select("owner,owner_since").eq("token_id", tokenId).maybeSingle()
  if (error) throw new Error("owner index read failed")
  if (!data) return null
  const row = data as { owner?: unknown; owner_since?: unknown }
  return {
    owner: typeof row.owner === "string" ? row.owner : null,
    owner_since: typeof row.owner_since === "string" ? row.owner_since : null,
  }
}

/** Normies a vault holds now, from the official API. Throws on any failure: "couldn't look it up" is never "holds nothing". */
async function vaultHoldings(vault: `0x${string}`): Promise<Array<number | string>> {
  // The address comes from the delegate.xyz registry; only a well-formed one is ever put in the URL.
  if (!/^0x[a-fA-F0-9]{40}$/.test(vault)) throw new Error("bad vault address")
  const res = await fetchWithTimeout(`${NORMIES_API_BASE}/holders/${vault}`, { headers: { Accept: "application/json" } }, READ_TIMEOUT_MS)
  if (!res.ok) throw new Error("holders lookup failed")
  const data = (await res.json()) as { tokenIds?: Array<number | string> }
  if (!Array.isArray(data.tokenIds)) throw new Error("holders lookup returned no list")
  return data.tokenIds
}

/** A wallet's delegations rarely change: keep a COMPLETE read for 5 minutes per server instance. An incomplete one is never kept. */
const DELEGATE_XYZ_TTL_MS = 5 * 60_000
const delegateXyzCache = new Map<string, { at: number; result: DelegateXyzResult }>()

async function readDelegateXyz(owner: string): Promise<DelegateXyzResult> {
  const key = owner.toLowerCase()
  const hit = delegateXyzCache.get(key)
  if (hit && Date.now() - hit.at < DELEGATE_XYZ_TTL_MS) return hit.result
  const result = await findDelegateXyz(owner, { ...registryReaders(publicClient), holdersOf: vaultHoldings })
  if (!delegationCheckIncomplete(result)) {
    if (delegateXyzCache.size > 2_000) delegateXyzCache.clear()
    delegateXyzCache.set(key, { at: Date.now(), result })
  }
  return result
}

export const DEFAULT_OWNERSHIP_DEPS: OwnershipDeps = { readChainOwner, readIndexRow, readDelegateXyz, now: () => new Date() }

/**
 * Run the four checks for one Normie. `apiOwner` and `canvas` are the official API reads the Pulse has already made, so they
 * aren't fetched twice. Never throws.
 */
export async function loadOwnershipCheck(
  tokenId: number,
  api: Pick<OwnershipInputs, "apiOwner" | "canvas">,
  deps: OwnershipDeps = DEFAULT_OWNERSHIP_DEPS,
): Promise<OwnershipCheck> {
  const [chainOwner, index] = await Promise.all([
    readable(() => deps.readChainOwner(tokenId)),
    readable(() => deps.readIndexRow(tokenId)),
  ])

  // delegate.xyz is read for the live on-chain owner. Without one there is nobody to check, and the owner check already fails.
  const owner = chainOwner.ok && /^0x[a-fA-F0-9]{40}$/.test(chainOwner.value) && !/^0x0+$/.test(chainOwner.value) ? chainOwner.value : null
  const dx = owner ? await readable(() => deps.readDelegateXyz(owner), DELEGATE_XYZ_TIMEOUT_MS) : null

  return evaluateOwnershipCheck({
    now: deps.now(),
    chainOwner,
    apiOwner: api.apiOwner,
    index,
    canvas: api.canvas,
    delegateXyz: dx && dx.ok ? dx.value : null,
  })
}
