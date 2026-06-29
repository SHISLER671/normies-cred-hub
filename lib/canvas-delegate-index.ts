import { unstable_cache } from "next/cache"

import { NORMIES_API_BASE } from "@/constants/contracts"
import { fetchWithTimeout } from "@/lib/fetch-with-timeout"
import { ZERO_ADDRESS } from "@/lib/normie-control"

type AgentsListPage = {
  items?: Array<{ tokenId: string; agentId: string }>
  hasMore?: boolean
}

type CanvasInfo = {
  delegate?: string
}

const PAGE_SIZE = 100
const CANVAS_BATCH_SIZE = 25
const CANVAS_FETCH_TIMEOUT_MS = 8_000
const LIST_FETCH_TIMEOUT_MS = 20_000

async function fetchCanvasDelegateForToken(
  tokenId: string,
  target: string,
): Promise<number | null> {
  try {
    const infoRes = await fetchWithTimeout(
      `${NORMIES_API_BASE}/normie/${tokenId}/canvas/info`,
      {},
      CANVAS_FETCH_TIMEOUT_MS,
    )
    if (!infoRes.ok) return null

    const info = (await infoRes.json()) as CanvasInfo
    const delegate = info.delegate?.toLowerCase()
    if (!delegate || delegate === ZERO_ADDRESS || delegate !== target) return null

    return Number(tokenId)
  } catch {
    return null
  }
}

/**
 * Scan awakened agents for Normies where `address` is the Canvas hot-wallet delegate.
 * Paginates /agents/list and checks /normie/{id}/canvas/info in parallel per page.
 */
async function scanCanvasDelegatedTokenIds(address: string): Promise<number[]> {
  const target = address.toLowerCase()
  const matches: number[] = []
  let cursor: string | undefined
  let hasMore = true

  while (hasMore) {
    const url = new URL(`${NORMIES_API_BASE}/agents/list`)
    url.searchParams.set("limit", String(PAGE_SIZE))
    if (cursor) url.searchParams.set("cursor", cursor)

    const res = await fetchWithTimeout(url.toString(), {}, LIST_FETCH_TIMEOUT_MS)
    if (!res.ok) {
      throw new Error(`agents/list failed with ${res.status}`)
    }

    const page = (await res.json()) as AgentsListPage
    const items = page.items ?? []

    for (let i = 0; i < items.length; i += CANVAS_BATCH_SIZE) {
      const batch = items.slice(i, i + CANVAS_BATCH_SIZE)
      const batchMatches = await Promise.all(
        batch.map((item) => fetchCanvasDelegateForToken(item.tokenId, target)),
      )
      for (const id of batchMatches) {
        if (id != null && Number.isFinite(id)) matches.push(id)
      }
    }

    hasMore = !!page.hasMore
    cursor = items.length > 0 ? items[items.length - 1]!.agentId : undefined
    if (!cursor) hasMore = false
  }

  return Array.from(new Set(matches)).sort((a, b) => a - b)
}

const getCachedCanvasDelegatedTokenIds = unstable_cache(
  async (normalizedAddress: string) => scanCanvasDelegatedTokenIds(normalizedAddress),
  ["normies-canvas-delegate-lookup"],
  { revalidate: 600 },
)

export async function getCanvasDelegatedTokenIds(address: string): Promise<number[]> {
  return getCachedCanvasDelegatedTokenIds(address.toLowerCase())
}