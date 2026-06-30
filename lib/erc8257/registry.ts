import { ToolRegistryClient } from "@opensea/tool-sdk"
import type { Erc8257Chain } from "@/lib/erc8257/types"
import { ERC8257_CHAIN_CONFIG, ERC8257_REGISTRY } from "@/lib/erc8257/constants"

export type OnchainToolConfig = {
  toolId: bigint
  creator: string
  metadataURI: string
  manifestHash: string
  accessPredicate: string
}

export function createRegistryClient(chain: Erc8257Chain): ToolRegistryClient {
  const { chain: viemChain, rpcUrl } = ERC8257_CHAIN_CONFIG[chain]
  return new ToolRegistryClient({
    chain: viemChain as never,
    rpcUrl,
    registryAddress: ERC8257_REGISTRY,
  })
}

export async function fetchOnchainToolConfigs(
  chain: Erc8257Chain,
): Promise<OnchainToolConfig[]> {
  const client = createRegistryClient(chain)
  const count = await client.toolCount()
  const total = Number(count)
  if (total === 0) return []

  const configs: OnchainToolConfig[] = []
  const batchSize = 10

  for (let start = 1; start <= total; start += batchSize) {
    const end = Math.min(start + batchSize - 1, total)
    const batch = await Promise.all(
      Array.from({ length: end - start + 1 }, (_, i) => {
        const toolId = BigInt(start + i)
        return client.getToolConfig(toolId).then((cfg) => ({
          toolId,
          creator: cfg.creator,
          metadataURI: cfg.metadataURI,
          manifestHash: cfg.manifestHash,
          accessPredicate: cfg.accessPredicate,
        }))
      }),
    )
    configs.push(...batch)
  }

  return configs
}