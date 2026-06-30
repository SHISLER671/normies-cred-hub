import type { RegistryTool } from "@/lib/erc8257/types"
import { ERC8257_CACHE_TTL_MS } from "@/lib/erc8257/constants"
import { discoverRegistryTools } from "@/lib/erc8257/discover"

type CacheEntry = {
  tools: RegistryTool[]
  fetchedAt: number
}

let cache: CacheEntry | null = null
let inflight: Promise<RegistryTool[]> | null = null

export async function getCachedRegistryTools(): Promise<{
  tools: RegistryTool[]
  cached: boolean
  fetchedAt: string
}> {
  const now = Date.now()

  if (cache && now - cache.fetchedAt < ERC8257_CACHE_TTL_MS) {
    return {
      tools: cache.tools,
      cached: true,
      fetchedAt: new Date(cache.fetchedAt).toISOString(),
    }
  }

  if (!inflight) {
    inflight = discoverRegistryTools()
      .then((tools) => {
        cache = { tools, fetchedAt: Date.now() }
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