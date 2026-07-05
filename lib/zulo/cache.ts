import { Redis } from "@upstash/redis"

import { ZULO_RECOMMENDS_CACHE_TTL_MS } from "@/lib/zulo/constants"
import type { ZuloRecommendsApiResponse } from "@/lib/zulo/transparency"

type CacheEntry = ZuloRecommendsApiResponse & { fetchedAt: number }

let redis: Redis | null = null
const memoryCache = new Map<string, CacheEntry>()

function getRedis(): Redis | null {
  if (redis) return redis
  const url = process.env.KV_REST_API_URL
  const token = process.env.KV_REST_API_TOKEN
  if (!url || !token) return null
  redis = new Redis({ url, token })
  return redis
}

function isFresh(entry: CacheEntry, now = Date.now()): boolean {
  return now - entry.fetchedAt < ZULO_RECOMMENDS_CACHE_TTL_MS
}

export function buildZuloRecommendsCacheKey(
  tokenId: number,
  wallet?: string,
  ethosScore?: number,
): string {
  const walletPart = wallet ? wallet.toLowerCase().slice(0, 12) : "no-wallet"
  const ethosPart = ethosScore != null ? Math.floor(ethosScore / 200) : "no-ethos"
  return `zulo:recommends:v2:${tokenId}:${walletPart}:${ethosPart}`
}

export async function getCachedZuloRecommends(
  key: string,
): Promise<ZuloRecommendsApiResponse | null> {
  const now = Date.now()
  const mem = memoryCache.get(key)
  if (mem && isFresh(mem, now)) {
    return stripFetchedAt(mem, true)
  }

  const client = getRedis()
  if (!client) return null

  try {
    const raw = await client.get<CacheEntry>(key)
    if (!raw?.fetchedAt || !isFresh(raw, now)) return null
    memoryCache.set(key, raw)
    return stripFetchedAt(raw, true)
  } catch (err) {
    console.warn("[zulo/cache] redis read failed:", err)
    return null
  }
}

export async function setCachedZuloRecommends(
  key: string,
  payload: ZuloRecommendsApiResponse,
): Promise<void> {
  const entry: CacheEntry = {
    ...payload,
    fetchedAt: Date.now(),
  }

  memoryCache.set(key, entry)

  const client = getRedis()
  if (!client) return

  try {
    await client.set(key, entry, { px: ZULO_RECOMMENDS_CACHE_TTL_MS })
  } catch (err) {
    console.warn("[zulo/cache] redis write failed:", err)
  }
}

function stripFetchedAt(
  entry: CacheEntry,
  cached: boolean,
): ZuloRecommendsApiResponse {
  const { fetchedAt: _fetchedAt, ...rest } = entry
  return {
    ...rest,
    transparency: {
      ...rest.transparency,
      cached,
      generatedAt: rest.transparency.generatedAt,
    },
  }
}