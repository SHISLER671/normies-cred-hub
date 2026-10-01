import { getAddress } from "viem"

import { scanAllCanvasDelegatedTokenIds } from "@/lib/canvas-delegate-index"
import { enrichOwnedNormiesServer } from "@/lib/normies-server"
import {
  DELEGATE_REGISTRY,
  DELEGATE_REGISTRY_ABI,
  DELEGATE_REGISTRY_V2,
  DELEGATE_REGISTRY_V2_ABI,
  NORMIES_NFT,
  NORMIES_API_BASE,
} from "@/constants/contracts"
import { fetchWithRetry } from "@/lib/fetch-with-retry"
import { publicClient } from "@/lib/viem-client"
import type { OwnedNormie } from "@/lib/types"

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

async function fetchDelegateXyzTokenIds(address: `0x${string}`): Promise<number[]> {
  const delegatedIds: number[] = []

  try {
    const delegations = (await publicClient.readContract({
      address: DELEGATE_REGISTRY,
      abi: DELEGATE_REGISTRY_ABI,
      functionName: "getDelegationsByDelegate",
      args: [address],
    })) as Array<{
      vault: string
      delegate: string
      contract_: string
      tokenId: bigint
      rights: string
    }>

    const fullCollectionVaults: string[] = []

    for (const d of delegations) {
      if (d.contract_?.toLowerCase() !== NORMIES_NFT.toLowerCase()) continue

      if (d.tokenId === BigInt(0)) {
        fullCollectionVaults.push(d.vault)
      } else {
        delegatedIds.push(Number(d.tokenId))
      }
    }

    for (const vault of fullCollectionVaults) {
      try {
        const vaultAddr = getAddress(vault) as `0x${string}`
        const vaultIds = await fetchDirectHolderIds(vaultAddr)
        delegatedIds.push(...vaultIds)
      } catch {
        // Vault enumeration may fail on stale RPC/indexer data
      }
    }
  } catch {
    // Delegation registry failures are common on public RPCs
  }

  return delegatedIds
}

export type DelegationV2 = {
  type_: number
  from: string
  contract_: string
  tokenId: bigint
}

const V2_ALL = 1
const V2_CONTRACT = 2
const V2_ERC721 = 3

/**
 * Turn Delegate.xyz v2 delegations into token IDs. ALL and CONTRACT delegations cover every Normie the
 * vault holds (looked up via `holdersOf`); ERC721 covers only its own token. Like v1, `rights` is not
 * checked: a scoped delegation still counts as control for read-only advice.
 */
export async function tokenIdsFromV2Delegations(
  delegations: readonly DelegationV2[],
  holdersOf: (vault: `0x${string}`) => Promise<number[]>,
): Promise<number[]> {
  const ids: number[] = []
  const vaults = new Set<string>()

  for (const d of delegations) {
    if (d.type_ === V2_ALL) {
      vaults.add(d.from)
    } else if (d.type_ === V2_CONTRACT && d.contract_.toLowerCase() === NORMIES_NFT.toLowerCase()) {
      vaults.add(d.from)
    } else if (d.type_ === V2_ERC721 && d.contract_.toLowerCase() === NORMIES_NFT.toLowerCase()) {
      ids.push(Number(d.tokenId))
    }
  }

  for (const vault of vaults) {
    try {
      ids.push(...(await holdersOf(getAddress(vault) as `0x${string}`)))
    } catch {
      // Vault enumeration may fail on stale RPC/indexer data
    }
  }
  return ids
}

async function fetchDelegateXyzV2TokenIds(address: `0x${string}`): Promise<number[]> {
  try {
    const delegations = await publicClient.readContract({
      address: DELEGATE_REGISTRY_V2,
      abi: DELEGATE_REGISTRY_V2_ABI,
      functionName: "getIncomingDelegations",
      args: [address],
    })
    return await tokenIdsFromV2Delegations(delegations, fetchDirectHolderIds)
  } catch {
    // Delegation registry failures are common on public RPCs
    return []
  }
}

/** All token IDs the wallet controls: owner, Delegate.xyz (v1 or v2), or Canvas delegate. */
export async function fetchControlledTokenIds(address: string): Promise<number[]> {
  const normalized = getAddress(address) as `0x${string}`

  // The cheap lookups go first and the Canvas scan after: the scan fires hundreds of requests, and run in
  // parallel it used up the Normies API rate limit (60/min) before the holders lookup got its turn.
  const [directIds, delegateXyzIds, delegateXyzV2Ids] = await Promise.all([
    fetchDirectHolderIds(normalized),
    fetchDelegateXyzTokenIds(normalized),
    fetchDelegateXyzV2TokenIds(normalized),
  ])
  const canvasDelegateIds = await scanAllCanvasDelegatedTokenIds(normalized).catch(() => [] as number[])

  const uniqueIds = Array.from(
    new Set([...directIds, ...delegateXyzIds, ...delegateXyzV2Ids, ...canvasDelegateIds]),
  )
  return uniqueIds.sort((a, b) => a - b)
}

export async function fetchControlledNormies(address: string): Promise<OwnedNormie[]> {
  const tokenIds = await fetchControlledTokenIds(address)
  return enrichOwnedNormiesServer(tokenIds)
}