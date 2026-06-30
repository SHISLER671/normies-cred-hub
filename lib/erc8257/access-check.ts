import { checkToolAccess } from "@opensea/tool-sdk"
import { isAddress } from "viem"
import type { Erc8257Chain, RegistryTool } from "@/lib/erc8257/types"
import { ERC8257_CHAIN_CONFIG } from "@/lib/erc8257/constants"

const ACCESS_CACHE_TTL_MS = 10 * 60 * 1000
const CHECK_CONCURRENCY = 6

type CacheEntry = { granted: boolean; fetchedAt: number }

const accessCache = new Map<string, CacheEntry>()

function cacheKey(wallet: string, chain: Erc8257Chain, toolId: number): string {
  return `${wallet.toLowerCase()}:${chain}:${toolId}`
}

async function checkSingleToolAccess(
  tool: RegistryTool,
  wallet: `0x${string}`,
): Promise<boolean> {
  if (tool.access.openAccess) return true

  const key = cacheKey(wallet, tool.chain, tool.toolId)
  const cached = accessCache.get(key)
  if (cached && Date.now() - cached.fetchedAt < ACCESS_CACHE_TTL_MS) {
    return cached.granted
  }

  const { chain, rpcUrl } = ERC8257_CHAIN_CONFIG[tool.chain]
  const result = await checkToolAccess({
    toolId: BigInt(tool.toolId),
    account: wallet,
    chain: chain as never,
    rpcUrl,
  })

  const granted = result.ok && result.granted
  accessCache.set(key, { granted, fetchedAt: Date.now() })
  return granted
}

async function mapPool<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency: number,
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let index = 0

  async function worker() {
    while (index < items.length) {
      const i = index++
      results[i] = await fn(items[i])
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  )
  return results
}

export type EnrichAccessOptions = {
  /** Cap gated-tool RPC checks (open-access tools skip the call). */
  maxChecks?: number
}

/**
 * Attach wallet-specific accessGranted to tools via on-chain tryHasAccess.
 * Open-access tools are marked granted without an RPC call.
 */
export async function enrichToolsWithWalletAccess(
  tools: RegistryTool[],
  wallet: string | undefined | null,
  options: EnrichAccessOptions = {},
): Promise<RegistryTool[]> {
  if (!wallet || !isAddress(wallet)) {
    return tools.map((t) => ({
      ...t,
      access: { ...t.access, accessGranted: null },
    }))
  }

  const account = wallet as `0x${string}`
  const maxChecks = options.maxChecks ?? 80
  let gatedChecks = 0

  const grantedFlags = await mapPool(
    tools,
    async (tool) => {
      if (tool.access.openAccess) return true
      if (gatedChecks >= maxChecks) return null
      gatedChecks++
      try {
        return await checkSingleToolAccess(tool, account)
      } catch {
        return null
      }
    },
    CHECK_CONCURRENCY,
  )

  return tools.map((tool, i) => ({
    ...tool,
    access: {
      ...tool.access,
      accessGranted: tool.access.openAccess ? true : grantedFlags[i],
    },
  }))
}

export function formatWalletAccessLine(access: RegistryTool["access"]): string {
  if (access.accessGranted === true) return "Holder can use: yes"
  if (access.accessGranted === false) return "Holder can use: no (gated)"
  if (access.openAccess) return "Holder can use: yes (open access)"
  return "Holder can use: not checked"
}