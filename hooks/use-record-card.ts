"use client"

import { useQuery } from "@tanstack/react-query"

import { fetchWithTimeout } from "@/lib/fetch-with-timeout"
import type { RecordCard } from "@/lib/record-card/types"

async function fetchRecordCard(tokenId: number): Promise<RecordCard> {
  const res = await fetchWithTimeout(
    `/api/zulo/record-card/${tokenId}`,
    { headers: { Accept: "application/json" } },
    15_000,
  )
  if (!res.ok) throw new Error(`Record card request failed (${res.status})`)
  return (await res.json()) as RecordCard
}

/**
 * A Normie's record card (live Pulse, trust gate, identity, Arena slot, chat rating). Read-only.
 * Uses the record-card endpoint, not the Pulse endpoint, so viewing the page never counts as a Pulse check.
 */
export function useRecordCard(tokenId?: number | null) {
  const enabled = typeof tokenId === "number" && Number.isSafeInteger(tokenId) && tokenId >= 0 && tokenId <= 9999
  return useQuery({
    queryKey: ["record-card", enabled ? tokenId : null],
    queryFn: () => fetchRecordCard(tokenId as number),
    enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    retry: 1,
  })
}
