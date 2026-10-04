"use client"

import { useQuery } from "@tanstack/react-query"
import { getAddress } from "viem"

import { enrichOwnedNormies, normiesApi } from "@/lib/api/normies"
import { findDelegateXyz, registryReaders } from "@/lib/delegations"
import { publicClient } from "@/lib/viem-client"
import type { OwnedNormie } from "@/lib/types"

const CANVAS_DELEGATE_CACHE_MS = 10 * 60 * 1000

/** Delegate.xyz v1 + v2 through the shared, tested module (lib/delegations.ts). Never throws: a failed read just yields no ids here. */
async function fetchDelegateXyzTokenIds(wallet: `0x${string}`): Promise<number[]> {
  const { entries } = await findDelegateXyz(wallet, {
    ...registryReaders(publicClient),
    holdersOf: async (vault) => ((await normiesApi.holders(vault)).tokenIds ?? []).map((id) => Number(id)).filter((n) => Number.isFinite(n)),
  })
  return entries.map((e) => e.tokenId)
}

function readCanvasDelegateCache(address: string): number[] | null {
  try {
    const raw = sessionStorage.getItem(`canvas-delegates:${address.toLowerCase()}`)
    if (!raw) return null
    const { ts, ids } = JSON.parse(raw) as { ts: number; ids: number[] }
    if (Date.now() - ts > CANVAS_DELEGATE_CACHE_MS) return null
    return ids
  } catch {
    return null
  }
}

function writeCanvasDelegateCache(address: string, ids: number[]): void {
  try {
    sessionStorage.setItem(
      `canvas-delegates:${address.toLowerCase()}`,
      JSON.stringify({ ts: Date.now(), ids }),
    )
  } catch {
    // sessionStorage may be unavailable
  }
}

/**
 * Paginated Canvas delegate scan — one serverless page per request to avoid
 * Vercel's 10s timeout on full scans (~13 pages total).
 */
async function fetchCanvasDelegatedTokenIds(address: string): Promise<number[]> {
  const cached = readCanvasDelegateCache(address)
  if (cached) return cached

  const allIds: number[] = []
  let cursor: string | null = null
  let hasMore = true
  let pages = 0
  const maxPages = 20

  while (hasMore && pages < maxPages) {
    const params = new URLSearchParams({ address })
    if (cursor) params.set("cursor", cursor)

    const res = await fetch(`/api/canvas-delegates?${params.toString()}`)
    if (!res.ok) {
      console.warn("[useMyNormies] Canvas delegate page failed", res.status)
      break
    }

    const data = (await res.json()) as {
      tokenIds?: Array<number | string>
      nextCursor?: string | null
      hasMore?: boolean
    }

    for (const id of data.tokenIds ?? []) {
      const parsed = Number(id)
      if (Number.isFinite(parsed)) allIds.push(parsed)
    }

    hasMore = !!data.hasMore
    cursor = data.nextCursor ?? null
    pages += 1

    if (hasMore && !cursor) break
  }

  const unique = Array.from(new Set(allIds)).sort((a, b) => a - b)
  if (unique.length > 0 || pages >= maxPages || !hasMore) {
    writeCanvasDelegateCache(address, unique)
  }

  return unique
}

/**
 * Normies controlled by a wallet:
 * - direct owner (holders API)
 * - Delegate.xyz vault delegate (on-chain registry)
 * - Normies Canvas hot-wallet delegate (paginated server scan + session cache)
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