import { getAddress } from "viem"

import { getCanvasDelegatedTokenIds } from "@/lib/canvas-delegate-index"
import { enrichOwnedNormiesServer } from "@/lib/normies-server"
import {
  DELEGATE_REGISTRY,
  DELEGATE_REGISTRY_ABI,
  NORMIES_NFT,
  NORMIES_API_BASE,
} from "@/constants/contracts"
import { fetchWithTimeout } from "@/lib/fetch-with-timeout"
import { publicClient } from "@/lib/viem-client"
import type { OwnedNormie } from "@/lib/types"

async function fetchDirectHolderIds(address: `0x${string}`): Promise<number[]> {
  try {
    const res = await fetchWithTimeout(
      `${NORMIES_API_BASE}/holders/${address}`,
      {},
      10_000,
    )
    if (!res.ok) return []

    const data = (await res.json()) as { tokenIds?: Array<number | string> }
    return (data.tokenIds ?? [])
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id))
  } catch {
    return []
  }
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

/** All token IDs the wallet controls: owner, Delegate.xyz, or Canvas delegate. */
export async function fetchControlledTokenIds(address: string): Promise<number[]> {
  const normalized = getAddress(address) as `0x${string}`

  const [directIds, delegateXyzIds, canvasDelegateIds] = await Promise.all([
    fetchDirectHolderIds(normalized),
    fetchDelegateXyzTokenIds(normalized),
    getCanvasDelegatedTokenIds(normalized),
  ])

  const uniqueIds = Array.from(new Set([...directIds, ...delegateXyzIds, ...canvasDelegateIds]))
  return uniqueIds.sort((a, b) => a - b)
}

export async function fetchControlledNormies(address: string): Promise<OwnedNormie[]> {
  const tokenIds = await fetchControlledTokenIds(address)
  return enrichOwnedNormiesServer(tokenIds)
}