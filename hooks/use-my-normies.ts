"use client"

import { useQuery } from "@tanstack/react-query"
import { getAddress } from "viem"

import {
  DELEGATE_REGISTRY,
  DELEGATE_REGISTRY_ABI,
  NORMIES_NFT,
} from "@/constants/contracts"
import { enrichOwnedNormies, normiesApi } from "@/lib/api/normies"
import { publicClient } from "@/lib/viem-client"
import type { OwnedNormie } from "@/lib/types"

async function fetchDelegateXyzTokenIds(wallet: `0x${string}`): Promise<number[]> {
  const delegatedIds: number[] = []

  try {
    const delegations = (await publicClient.readContract({
      address: DELEGATE_REGISTRY,
      abi: DELEGATE_REGISTRY_ABI,
      functionName: "getDelegationsByDelegate",
      args: [wallet],
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
        const holders = await normiesApi.holders(vaultAddr)
        for (const id of holders.tokenIds ?? []) {
          const parsed = Number(id)
          if (Number.isFinite(parsed)) delegatedIds.push(parsed)
        }
      } catch {
        // Vault enumeration may fail on stale RPC/indexer data
      }
    }
  } catch {
    // Delegation registry failures are common on public RPCs
  }

  return delegatedIds
}

/** Server-cached scan for Normies Canvas hot-wallet delegates. */
async function fetchCanvasDelegatedTokenIds(address: string): Promise<number[]> {
  try {
    const res = await fetch(
      `/api/canvas-delegates?address=${encodeURIComponent(address)}`,
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

/**
 * Normies controlled by a wallet:
 * - direct owner (holders API)
 * - Delegate.xyz vault delegate (on-chain registry)
 * - Normies Canvas hot-wallet delegate (server scan + cache)
 */
export function useMyNormies(address?: string) {
  return useQuery({
    queryKey: ["my-normies", address?.toLowerCase()],
    queryFn: async (): Promise<OwnedNormie[]> => {
      if (!address) return []

      const normalized = getAddress(address) as `0x${string}`

      const [holdersResult, delegateXyzIds, canvasDelegateIds] = await Promise.all([
        normiesApi.holders(normalized).catch(() => ({ tokenIds: [] as Array<number | string> })),
        fetchDelegateXyzTokenIds(normalized),
        fetchCanvasDelegatedTokenIds(normalized),
      ])

      const directIds = (holdersResult.tokenIds ?? [])
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id))

      const uniqueIds = Array.from(
        new Set([...directIds, ...delegateXyzIds, ...canvasDelegateIds]),
      ).sort((a, b) => a - b)

      return enrichOwnedNormies(uniqueIds)
    },
    enabled: !!address && /^0x[a-fA-F0-9]{40}$/.test(address),
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  })
}