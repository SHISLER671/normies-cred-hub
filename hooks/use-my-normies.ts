"use client"

import { useQuery } from "@tanstack/react-query"
import { getAddress } from "viem"

import { publicClient } from "@/lib/viem-client"
import {
  DELEGATE_REGISTRY,
  DELEGATE_REGISTRY_ABI,
  ERC721_ENUMERABLE_ABI,
  NORMIES_NFT,
} from "@/constants/contracts"

export function useMyNormies(owner?: string) {
  return useQuery({
    queryKey: ["my-normies", owner],
    queryFn: async (): Promise<number[]> => {
      if (!owner) return []

      try {
        const normalizedOwner = getAddress(owner) as `0x${string}`

        // Helper to safely enumerate tokens for an address (owner or delegated vault)
        async function fetchTokensFor(addr: `0x${string}`): Promise<number[]> {
          try {
            const balance = (await publicClient.readContract({
              address: NORMIES_NFT,
              abi: ERC721_ENUMERABLE_ABI,
              functionName: "balanceOf",
              args: [addr],
            })) as bigint

            const bal = Number(balance)
            const ids: number[] = []

            for (let i = 0; i < bal; i++) {
              try {
                const tokenId = (await publicClient.readContract({
                  address: NORMIES_NFT,
                  abi: ERC721_ENUMERABLE_ABI,
                  functionName: "tokenOfOwnerByIndex",
                  args: [addr, BigInt(i)],
                })) as bigint

                ids.push(Number(tokenId))
              } catch {
                // expected — some vaults/owners have balanceOf > 0 but tokenOfOwnerByIndex reverts (contract implementation quirk)
              }
            }
            return ids
          } catch {
            return []
          }
        }

        // 1. Directly owned tokens
        const directOwned = await fetchTokensFor(normalizedOwner)

        // 2. Tokens delegated to this wallet via Delegate.xyz
        const delegatedIds: number[] = []

        try {
          const delegations = (await publicClient.readContract({
            address: DELEGATE_REGISTRY,
            abi: DELEGATE_REGISTRY_ABI,
            functionName: "getDelegationsByDelegate",
            args: [normalizedOwner],
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
              // Full collection delegation from this vault
              fullCollectionVaults.push(d.vault)
            } else {
              // Specific token delegation
              delegatedIds.push(Number(d.tokenId))
            }
          }

          // For full collection delegations, fetch all tokens the vault owns
          for (const vault of fullCollectionVaults) {
            const vaultAddr = getAddress(vault) as `0x${string}`
            const vaultTokens = await fetchTokensFor(vaultAddr)
            delegatedIds.push(...vaultTokens)
          }
        } catch {
          // Silently ignore delegation registry failures (common on public RPCs)
        }

        // Merge + deduplicate
        const allIds = [...directOwned, ...delegatedIds]
        const uniqueIds = Array.from(new Set(allIds))

        return uniqueIds.sort((a, b) => a - b)
      } catch (err) {
        console.warn("[useMyNormies] Error fetching tokens", err)
        return []
      }
    },
    enabled: !!owner,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  })
}
