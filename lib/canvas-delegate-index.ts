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

/** Builds delegate address → token IDs from awakened agents' canvas info. */
async function buildCanvasDelegateIndex(): Promise<Record<string, number[]>> {
  const index: Record<string, number[]> = {}
  let cursor: string | undefined
  let hasMore = true

  while (hasMore) {
    const url = new URL(`${NORMIES_API_BASE}/agents/list`)
    url.searchParams.set("limit", "100")
    if (cursor) url.searchParams.set("cursor", cursor)

    const res = await fetchWithTimeout(url.toString(), {}, 20_000)
    if (!res.ok) break

    const page = (await res.json()) as AgentsListPage
    const items = page.items ?? []

    await Promise.all(
      items.map(async (item) => {
        try {
          const infoRes = await fetchWithTimeout(
            `${NORMIES_API_BASE}/normie/${item.tokenId}/canvas/info`,
            {},
            8_000,
          )
          if (!infoRes.ok) return

          const info = (await infoRes.json()) as CanvasInfo
          const delegate = info.delegate?.toLowerCase()
          if (!delegate || delegate === ZERO_ADDRESS) return

          if (!index[delegate]) index[delegate] = []
          index[delegate].push(Number(item.tokenId))
        } catch {
          // Skip tokens with unavailable canvas info
        }
      }),
    )

    hasMore = !!page.hasMore
    cursor = items.length > 0 ? items[items.length - 1]!.agentId : undefined
    if (!cursor) hasMore = false
  }

  for (const key of Object.keys(index)) {
    index[key] = Array.from(new Set(index[key])).sort((a, b) => a - b)
  }

  return index
}

export const getCanvasDelegateIndex = unstable_cache(
  buildCanvasDelegateIndex,
  ["normies-canvas-delegate-index"],
  { revalidate: 600 },
)

export async function getCanvasDelegatedTokenIds(address: string): Promise<number[]> {
  const index = await getCanvasDelegateIndex()
  return index[address.toLowerCase()] ?? []
}