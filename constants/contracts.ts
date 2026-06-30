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

/** Main Normies ERC-721 collection on Ethereum */
export const NORMIES_NFT = "0x9eb6e2025b64f340691e424b7fe7022ffde12438" as const

/** ERC-8257 Agent Tool Registry (same CREATE2 address on mainnet + Base) */
export const ERC8257 = {
  TOOL_REGISTRY: "0x265BB2DBFC0A8165C9A1941Eb1372F349baD2cf1",
  ERC721_OWNER_PREDICATE: "0xc8721c9A776958FfFfEb602DA1b708bf1D318379",
} as const

/** Minimal ERC721Enumerable for discovering owned tokens (balance + tokenOfOwnerByIndex) */
export const ERC721_ENUMERABLE_ABI = [
  {
    inputs: [{ name: "owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "owner", type: "address" },
      { name: "index", type: "uint256" },
    ],
    name: "tokenOfOwnerByIndex",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const

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

/**
 * Delegate.xyz Registry (v1)
 * Used to discover tokens delegated to the connected wallet (hot wallet pattern).
 */
export const DELEGATE_REGISTRY = "0x00000000000076A84feF008CDAbe6409d2FE638B" as const

export const DELEGATE_REGISTRY_ABI = [
  {
    inputs: [{ name: "to", type: "address" }],
    name: "getDelegationsByDelegate",
    outputs: [
      {
        components: [
          { name: "vault", type: "address" },
          { name: "delegate", type: "address" },
          { name: "contract_", type: "address" },
          { name: "tokenId", type: "uint256" },
          { name: "rights", type: "bytes32" },
        ],
        name: "",
        type: "tuple[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const

/**
 * AgentCheck — ERC-8257 Tool #13 (trust layer / reputation signal)
 * API: https://agentcheck-bice.vercel.app/api/check?wallet=...
 * On-chain cert registry (Base): isCertified(address) for pure on-chain verification
 *
 * Also relevant: TraitGatedPredicate for gating by Normies traits (Type: Agent etc.)
 * and composition with AgentCheck cert.
 */
export const AGENT_CHECK = {
  /** On-chain certification registry on Base */
  REGISTRY: "0x803A8988E40CBb54897e5782A6A589d907A5B03A" as const,
  /** Simple public API endpoint (no key, free for normal use) */
  API_BASE: "https://agentcheck-bice.vercel.app/api/check",
} as const

/**
 * Example AgentCheck certification predicate address (for setAccessPredicate on tools).
 * Used with TraitGatedPredicate for combined gates (Agent trait + cert).
 */
export const AGENT_CHECK_PREDICATE = "0x38530729..." as const // replace with full address when available

/** Minimal ABI for the on-chain cert registry */
export const AGENT_CHECK_REGISTRY_ABI = [
  {
    inputs: [{ name: "account", type: "address" }],
    name: "isCertified",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
] as const
