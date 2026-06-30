import type {
  DiscoverToolsOptions,
  Erc8257Chain,
  RegistryTool,
} from "@/lib/erc8257/types"
import {
  ERC8257_CHAIN_CONFIG,
  ERC8257_SUPPORTED_CHAINS,
} from "@/lib/erc8257/constants"
import { fetchOnchainToolConfigs } from "@/lib/erc8257/registry"
import { fetchAndVerifyManifest } from "@/lib/erc8257/manifests"
import { resolveToolAccess } from "@/lib/erc8257/access-notes"

const MANIFEST_CONCURRENCY = 8

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

async function discoverChainTools(chain: Erc8257Chain): Promise<RegistryTool[]> {
  const { chain: viemChain, openseaSegment } = ERC8257_CHAIN_CONFIG[chain]
  const onchain = await fetchOnchainToolConfigs(chain)

  const resolved = await mapPool(
    onchain,
    async (cfg) => {
      const manifest = await fetchAndVerifyManifest(
        cfg.metadataURI,
        cfg.manifestHash,
      )
      const access = await resolveToolAccess(
        chain,
        cfg.toolId,
        cfg.accessPredicate,
        manifest.manifestAccessLabels,
        manifest.manifestDeclaresGating,
      )

      const toolId = Number(cfg.toolId)

      return {
        toolId,
        chain,
        chainId: viemChain.id,
        name: manifest.name,
        description: manifest.description,
        tags: manifest.tags,
        endpoint: manifest.endpoint,
        manifestUri: cfg.metadataURI,
        manifestHash: cfg.manifestHash,
        manifestVerified: manifest.manifestVerified,
        creator: cfg.creator,
        access,
        openseaUrl: `https://opensea.io/tools/erc8257/${openseaSegment}/${toolId}`,
      } satisfies RegistryTool
    },
    MANIFEST_CONCURRENCY,
  )

  return resolved.filter((t) => t.name !== "Unknown Tool" || t.endpoint)
}

function matchesTags(tool: RegistryTool, tags?: string[]): boolean {
  if (!tags?.length) return true
  const normalized = tags.map((t) => t.toLowerCase())
  return tool.tags.some((tag) => normalized.includes(tag.toLowerCase()))
}

export async function discoverRegistryTools(
  options: DiscoverToolsOptions = {},
): Promise<RegistryTool[]> {
  const chains = options.chains ?? ERC8257_SUPPORTED_CHAINS
  const perChain = await Promise.all(chains.map((c) => discoverChainTools(c)))
  let tools = perChain.flat()

  if (options.tags?.length) {
    tools = tools.filter((t) => matchesTags(t, options.tags))
  }

  tools.sort((a, b) => {
    if (a.chain !== b.chain) return a.chain === "mainnet" ? -1 : 1
    return b.toolId - a.toolId
  })

  if (options.limit && options.limit > 0) {
    tools = tools.slice(0, options.limit)
  }

  return tools
}