/**
 * ERC-8004 on-chain registry addresses + minimal read-only ABIs.
 *
 * SECURITY NOTE: Only read functions are included here. This app intentionally
 * never references transfer / approve / write methods. Everything on-chain is
 * read-only, and the only signing action is a plain `signMessage` (no asset risk).
 */

export const ERC8004 = {
  /** Deployed on Ethereum mainnet (chainId 1). */
  IDENTITY_REGISTRY: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432",
  REPUTATION_REGISTRY: "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63",
} as const

/**
 * Featured proof-of-concept agent for the public demo.
 * Normie #7141 → Zulo → ERC-8004 agentId 32626.
 */
export const ZULO = {
  tokenId: 7141,
  agentId: 32626,
  name: "Zulo",
  chainId: 1,
} as const

export const NORMIES_API_BASE = "https://api.normies.art"
export const ETHOS_API_BASE = "https://api.ethos.network/api/v2"
export const ETHOS_APP_BASE = "https://app.ethos.network"
export const ETHOS_CLIENT_HEADER = "NormiesCredHub/1.2"

/** Minimal read-only ABI fragments for ERC-8004 registries. */
export const IDENTITY_REGISTRY_READ_ABI = [
  {
    type: "function",
    name: "agentURI",
    stateMutability: "view",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    name: "ownerOf",
    stateMutability: "view",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
] as const
