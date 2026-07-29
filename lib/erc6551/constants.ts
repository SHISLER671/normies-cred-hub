/**
 * ERC-6551 registry + Tokenbound production defaults.
 *
 * Spec: https://eips.ethereum.org/EIPS/eip-6551
 * Deployments: https://docs.tokenbound.org/contracts/deployments
 *
 * Zulo identity remains ERC-8004 + Normie ERC-721 — TBA is an optional
 * account-provider layer, not a replacement for agentId/control plane.
 */

import type { Address, Hex } from "viem"

/** Immutable singleton ERC-6551 registry (same address on supported chains). */
export const ERC6551_REGISTRY =
  "0x000000006551c19487814612e58FE06813775758" as const satisfies Address

/**
 * Tokenbound Account Proxy (V3) — preferred `implementation` for createAccount.
 * https://docs.tokenbound.org/contracts/deployments
 */
export const TOKENBOUND_ACCOUNT_PROXY =
  "0x55266d75D1a14E4572138116aF39863Ed6596E7F" as const satisfies Address

/**
 * Tokenbound Account Implementation (V3) — used for initialize after proxy create.
 */
export const TOKENBOUND_ACCOUNT_IMPLEMENTATION =
  "0x41C8f39463A868d3A88af00cd0fe7102F30E44eC" as const satisfies Address

/** Default salt for primary TBA (bytes32 zero). Multiple TBAs = different salt/implementation. */
export const ERC6551_DEFAULT_SALT =
  "0x0000000000000000000000000000000000000000000000000000000000000000" as const satisfies Hex

/** isValidSigner magic value from IERC6551Account */
export const ERC6551_IS_VALID_SIGNER_MAGIC =
  "0x523e3260" as const satisfies Hex

export const ERC6551_REGISTRY_ABI = [
  {
    type: "function",
    name: "account",
    stateMutability: "view",
    inputs: [
      { name: "implementation", type: "address" },
      { name: "salt", type: "bytes32" },
      { name: "chainId", type: "uint256" },
      { name: "tokenContract", type: "address" },
      { name: "tokenId", type: "uint256" },
    ],
    outputs: [{ name: "account", type: "address" }],
  },
  {
    type: "function",
    name: "createAccount",
    stateMutability: "nonpayable",
    inputs: [
      { name: "implementation", type: "address" },
      { name: "salt", type: "bytes32" },
      { name: "chainId", type: "uint256" },
      { name: "tokenContract", type: "address" },
      { name: "tokenId", type: "uint256" },
    ],
    outputs: [{ name: "account", type: "address" }],
  },
] as const

/** Minimal IERC6551Account surface (read-only for CredHub). */
export const ERC6551_ACCOUNT_ABI = [
  {
    type: "function",
    name: "token",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "chainId", type: "uint256" },
      { name: "tokenContract", type: "address" },
      { name: "tokenId", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "state",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "isValidSigner",
    stateMutability: "view",
    inputs: [
      { name: "signer", type: "address" },
      { name: "data", type: "bytes" },
    ],
    outputs: [{ name: "magicValue", type: "bytes4" }],
  },
] as const

export type Erc6551Version = "tokenbound-v3" | "custom"

export const TOKENBOUND_V3_DEFAULTS = {
  version: "tokenbound-v3" as const,
  registry: ERC6551_REGISTRY,
  implementation: TOKENBOUND_ACCOUNT_PROXY,
  accountImplementation: TOKENBOUND_ACCOUNT_IMPLEMENTATION,
  salt: ERC6551_DEFAULT_SALT,
} as const
