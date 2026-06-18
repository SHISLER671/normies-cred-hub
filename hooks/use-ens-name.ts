"use client"

import { useQuery } from "@tanstack/react-query"

import { publicClient } from "@/lib/viem-client"

export function useEnsName(address?: string) {
  return useQuery({
    queryKey: ["ens-name", address?.toLowerCase()],
    queryFn: async (): Promise<string | null> => {
      if (!address) return null
      try {
        const name = await publicClient.getEnsName({
          address: address as `0x${string}`,
        })
        return name || null
      } catch {
        return null
      }
    },
    enabled: !!address,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  })
}
