import { Redis } from "@upstash/redis"
import type { RegistryTool } from "@/lib/erc8257/types"
import { ERC8257_CACHE_TTL_MS } from "@/lib/erc8257/constants"
import { discoverRegistryTools } from "@/lib/erc8257/discover"

const REDIS_CACHE_KEY = "erc8257:registry-tools:v1"

type CacheEntry = {
  tools: RegistryTool[]
  fetchedAt: number
}

let redis: Redis | null = null
let cache: CacheEntry | null = null
let inflight: Promise<RegistryTool[]> | null = null

function getRedis(): Redis | null {
  if (redis) return redis
  const url = process.env.KV_REST_API_URL
  const token = process.env.KV_REST_API_TOKEN
  if (!url || !token) return null
  redis = new Redis({ url, token })
  return redis
}

function isFresh(entry: CacheEntry, now = Date.now()): boolean {
  return now - entry.fetchedAt < ERC8257_CACHE_TTL_MS
}

async function loadFromRedis(): Promise<CacheEntry | null> {
  const client = getRedis()
  if (!client) return null

  try {
    const raw = await client.get<CacheEntry>(REDIS_CACHE_KEY)
    if (!raw?.tools?.length || !raw.fetchedAt) return null
    if (!isFresh(raw)) return null
    return raw
  } catch (err) {
    console.warn("[erc8257/cache] redis read failed:", err)
    return null
  }
}

async function saveToRedis(entry: CacheEntry): Promise<void> {
  const client = getRedis()
  if (!client) return

  try {
    await client.set(REDIS_CACHE_KEY, entry, { px: ERC8257_CACHE_TTL_MS })
  } catch (err) {
    console.warn("[erc8257/cache] redis write failed:", err)
  }
}

export async function getCachedRegistryTools(): Promise<{
  tools: RegistryTool[]
  cached: boolean
  fetchedAt: string
}> {
  const now = Date.now()

  if (cache && isFresh(cache, now)) {
    return {
      tools: cache.tools,
      cached: true,
      fetchedAt: new Date(cache.fetchedAt).toISOString(),
    }
  }

  const fromRedis = await loadFromRedis()
  if (fromRedis) {
    cache = fromRedis
    return {
      tools: fromRedis.tools,
      cached: true,
      fetchedAt: new Date(fromRedis.fetchedAt).toISOString(),
    }
  }

  if (!inflight) {
    inflight = discoverRegistryTools()
      .then(async (tools) => {
        const entry: CacheEntry = { tools, fetchedAt: Date.now() }
        cache = entry
        await saveToRedis(entry)
        return tools
      })
      .finally(() => {
        inflight = null
      })
  }

  const tools = await inflight
  return {
    tools,
    cached: false,
    fetchedAt: new Date(cache?.fetchedAt ?? Date.now()).toISOString(),
  }
}