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

export type CanvasDelegatePageResult = {
  tokenIds: number[]
  nextCursor: string | null
  hasMore: boolean
}

const PAGE_SIZE = 100
const CANVAS_BATCH_SIZE = 25
const CANVAS_FETCH_TIMEOUT_MS = 6_000
const LIST_FETCH_TIMEOUT_MS = 12_000

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
 * Scan a single page of awakened agents for Canvas delegates matching `address`.
 * Designed to finish within Vercel Hobby's 10s function limit.
 */
export async function scanCanvasDelegatePage(
  address: string,
  cursor?: string | null,
): Promise<CanvasDelegatePageResult> {
  const target = address.toLowerCase()

  const url = new URL(`${NORMIES_API_BASE}/agents/list`)
  url.searchParams.set("limit", String(PAGE_SIZE))
  if (cursor) url.searchParams.set("cursor", cursor)

  const res = await fetchWithTimeout(url.toString(), {}, LIST_FETCH_TIMEOUT_MS)
  if (!res.ok) {
    throw new Error(`agents/list failed with ${res.status}`)
  }

  const page = (await res.json()) as AgentsListPage
  const items = page.items ?? []
  const matches: number[] = []

  for (let i = 0; i < items.length; i += CANVAS_BATCH_SIZE) {
    const batch = items.slice(i, i + CANVAS_BATCH_SIZE)
    const batchMatches = await Promise.all(
      batch.map((item) => fetchCanvasDelegateForToken(item.tokenId, target)),
    )
    for (const id of batchMatches) {
      if (id != null && Number.isFinite(id)) matches.push(id)
    }
  }

  const hasMore = !!page.hasMore && items.length > 0
  const nextCursor = hasMore ? (items[items.length - 1]?.agentId ?? null) : null

  return {
    tokenIds: matches,
    nextCursor,
    hasMore,
  }
}

/** Full scan by walking pages — only use when long runtimes are available. */
export async function scanAllCanvasDelegatedTokenIds(address: string): Promise<number[]> {
  const matches: number[] = []
  let cursor: string | null = null
  let hasMore = true

  while (hasMore) {
    const page = await scanCanvasDelegatePage(address, cursor)
    matches.push(...page.tokenIds)
    hasMore = page.hasMore
    cursor = page.nextCursor
    if (hasMore && !cursor) break
  }

  return Array.from(new Set(matches)).sort((a, b) => a - b)
}

/** @deprecated Prefer paginated scanCanvasDelegatePage from the client. */
export async function getCanvasDelegatedTokenIds(address: string): Promise<number[]> {
  return scanAllCanvasDelegatedTokenIds(address)
}