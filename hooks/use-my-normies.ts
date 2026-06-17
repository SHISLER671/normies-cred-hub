"use client"

import { useQuery } from "@tanstack/react-query"
import { createPublicClient, http } from "viem"
import { mainnet } from "viem/chains"

import { ERC721_ENUMERABLE_ABI, NORMIES_NFT } from "@/constants/contracts"

const client = createPublicClient({
  chain: mainnet,
  transport: http(),
})

export function useMyNormies(owner?: string) {
  return useQuery({
    queryKey: ["my-normies", owner],
    queryFn: async (): Promise<number[]> => {
      if (!owner) return []

      try {
        const balance = (await client.readContract({
          address: NORMIES_NFT,
          abi: ERC721_ENUMERABLE_ABI,
          functionName: "balanceOf",
          args: [owner as `0x${string}`],
        })) as bigint

        const ids: number[] = []
        const bal = Number(balance)

        // Simple loop is fine — most users own very few
        for (let i = 0; i < bal; i++) {
          const tokenId = (await client.readContract({
            address: NORMIES_NFT,
            abi: ERC721_ENUMERABLE_ABI,
            functionName: "tokenOfOwnerByIndex",
            args: [owner as `0x${string}`, BigInt(i)],
          })) as bigint

          ids.push(Number(tokenId))
        }

        return ids.sort((a, b) => a - b)
      } catch (err) {
        // Contract may not implement enumerable, or temporary error
        console.warn("[useMyNormies] Could not enumerate owned tokens", err)
        return []
      }
    },
    enabled: !!owner,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  })
}
