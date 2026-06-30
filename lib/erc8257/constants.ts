import { base, mainnet } from "viem/chains"
import { ERC8257 } from "@/constants/contracts"
import type { Erc8257Chain } from "@/lib/erc8257/types"

export const ERC8257_REGISTRY = ERC8257.TOOL_REGISTRY as `0x${string}`

export const ERC8257_CHAIN_CONFIG: Record<
  Erc8257Chain,
  { chain: typeof mainnet | typeof base; rpcUrl: string; openseaSegment: string }
> = {
  mainnet: {
    chain: mainnet,
    rpcUrl: "https://ethereum.publicnode.com",
    openseaSegment: "ethereum",
  },
  base: {
    chain: base,
    rpcUrl: "https://base.publicnode.com",
    openseaSegment: "base",
  },
}

export const ERC8257_SUPPORTED_CHAINS: Erc8257Chain[] = ["mainnet", "base"]

/** Cache TTL — tools and manifests change infrequently. */
export const ERC8257_CACHE_TTL_MS = 6 * 60 * 60 * 1000