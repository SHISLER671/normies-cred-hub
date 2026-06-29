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

async function fetchDelegatedTokenIds(owner: `0x${string}`): Promise<number[]> {
  const delegatedIds: number[] = []

  try {
    const delegations = (await publicClient.readContract({
      address: DELEGATE_REGISTRY,
      abi: DELEGATE_REGISTRY_ABI,
      functionName: "getDelegationsByDelegate",
      args: [owner],
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

export function useMyNormies(owner?: string) {
  return useQuery({
    queryKey: ["my-normies", owner],
    queryFn: async (): Promise<OwnedNormie[]> => {
      if (!owner) return []

      try {
        const normalizedOwner = getAddress(owner) as `0x${string}`

        const [holdersResult, delegatedIds] = await Promise.all([
          normiesApi.holders(normalizedOwner),
          fetchDelegatedTokenIds(normalizedOwner),
        ])

        const apiIds = (holdersResult.tokenIds ?? [])
          .map((id) => Number(id))
          .filter((id) => Number.isFinite(id))

        const allIds = [...apiIds, ...delegatedIds]
        const uniqueIds = Array.from(new Set(allIds)).sort((a, b) => a - b)

        return enrichOwnedNormies(uniqueIds)
      } catch (err) {
        console.warn("[useMyNormies] Error fetching owned Normies", err)
        throw err
      }
    },
    enabled: !!owner,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  })
}