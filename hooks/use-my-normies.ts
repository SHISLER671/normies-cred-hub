"use client"

import { useQuery } from "@tanstack/react-query"

import type { OwnedNormie } from "@/lib/types"

/**
 * Normies controlled by a wallet: direct owner, Delegate.xyz vault delegate,
 * or Normies Canvas hot-wallet delegate (via server-side canvas delegate index).
 */
export function useMyNormies(address?: string) {
  return useQuery({
    queryKey: ["my-normies", address?.toLowerCase()],
    queryFn: async (): Promise<OwnedNormie[]> => {
      if (!address) return []

      const res = await fetch(
        `/api/my-normies?address=${encodeURIComponent(address)}`,
      )

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? "Could not load Normies for this wallet.")
      }

      const data = (await res.json()) as { normies?: OwnedNormie[] }
      return data.normies ?? []
    },
    enabled: !!address && /^0x[a-fA-F0-9]{40}$/.test(address),
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  })
}