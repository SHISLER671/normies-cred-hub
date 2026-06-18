"use client"

import { useQuery } from "@tanstack/react-query"
import { getAddress } from "viem"

import { publicClient } from "@/lib/viem-client"
import { ERC721_ENUMERABLE_ABI, NORMIES_NFT } from "@/constants/contracts"

export function useMyNormies(owner?: string) {
  return useQuery({
    queryKey: ["my-normies", owner],
    queryFn: async (): Promise<number[]> => {
      if (!owner) return []

      try {
        // Normalize the address (fixes most checksum/casing issues)
        const normalizedOwner = getAddress(owner) as `0x${string}`

        const balance = (await publicClient.readContract({
          address: NORMIES_NFT,
          abi: ERC721_ENUMERABLE_ABI,
          functionName: "balanceOf",
          args: [normalizedOwner],
        })) as bigint

        const bal = Number(balance)
        if (bal === 0) return []

        const ids: number[] = []

        for (let i = 0; i < bal; i++) {
          try {
            const tokenId = (await publicClient.readContract({
              address: NORMIES_NFT,
              abi: ERC721_ENUMERABLE_ABI,
              functionName: "tokenOfOwnerByIndex",
              args: [normalizedOwner, BigInt(i)],
            })) as bigint

            ids.push(Number(tokenId))
          } catch (innerErr) {
            // If one index fails, just skip it instead of failing everything
            console.warn(`Failed to get token at index ${i}`, innerErr)
          }
        }

        return ids.sort((a, b) => a - b)
      } catch (err) {
        console.warn("[useMyNormies] Could not enumerate owned tokens", err)
        return []
      }
    },
    enabled: !!owner,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  })
}
