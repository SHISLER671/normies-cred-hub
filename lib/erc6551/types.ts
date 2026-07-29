/**
 * Future-proof account-provider types for Zulo.
 *
 * Design:
 * - Identity plane: Normie ERC-721 + ERC-8004 agentId (live today)
 * - Account plane: pluggable provider (ERC-6551 Tokenbound V3 default)
 * - Providers may be swapped without renaming product surfaces
 */

import type { Address, Hex, PublicClient } from "viem"

import type { Erc6551Version } from "./constants"

/** How a product actor may control a Normie-related account surface. */
export type AccountControlMode =
  | "erc721-owner"
  | "canvas-delegate"
  | "erc6551-signer"
  | "hot-wallet"
  | "unknown"

/** Binding parameters that uniquely identify a TBA under ERC-6551. */
export interface TokenBoundBinding {
  chainId: number
  tokenContract: Address
  tokenId: bigint
  /** Account implementation (Tokenbound proxy by default). */
  implementation: Address
  salt: Hex
  registry: Address
  version: Erc6551Version
}

/** Resolved TBA address + deploy status (address is valid pre-deploy). */
export interface ResolvedTokenBoundAccount {
  address: Address
  binding: TokenBoundBinding
  /** true if bytecode exists at address */
  deployed: boolean
  /** Account state() when deployed; useful for marketplace fraud binding */
  state?: bigint
  /** Bound token() read when deployed */
  boundToken?: {
    chainId: number
    tokenContract: Address
    tokenId: bigint
  }
}

export interface ResolveAccountParams {
  chainId: number
  tokenContract: Address
  tokenId: number | bigint
  /** Override Tokenbound proxy / custom implementation */
  implementation?: Address
  salt?: Hex
  registry?: Address
  /** When true, also read state()/token() if deployed */
  enrich?: boolean
}

/**
 * Product-level security constraints for TBA usage.
 * EIP leaves cycles (depth>1) and sale-time drainage out of scope.
 */
export interface TbaSecurityPolicy {
  /** Refuse product flows that would deposit the bound NFT into its own TBA. */
  blockSelfOwnershipCycle: boolean
  /**
   * When TBA inventory is saleable/bid-upon, require marketplace orders
   * to commit to account state (or locked assets).
   */
  requireStateBoundMarketplaceOrders: boolean
  /** Max TBA ownership graph depth the product will attempt to reason about. */
  maxOwnershipCycleDepth: number
  notes: string[]
}

export const DEFAULT_TBA_SECURITY_POLICY: TbaSecurityPolicy = {
  blockSelfOwnershipCycle: true,
  requireStateBoundMarketplaceOrders: true,
  maxOwnershipCycleDepth: 1,
  notes: [
    "Ownership cycles can permanently lock NFT + TBA assets; EIP only partially mitigates depth-1 cases.",
    "Marketplace fraud (seller drains TBA between bid and sale) is out of EIP scope — bind orders to account state.",
    "Zulo never asks users for seeds or unrestricted approvals when interacting with TBAs.",
  ],
}

/**
 * Swappable account backend. Primary ERC-6551 implementation is Tokenbound V3.
 * Future backends (custom implementation, multi-salt, modular accounts) plug in here.
 */
export interface AccountProvider {
  readonly id: string
  readonly version: Erc6551Version | "none"
  readonly status: "live" | "scaffold" | "planned" | "disabled"
  readonly security: TbaSecurityPolicy

  /** Deterministic TBA address (receivable before deploy). */
  resolveAccount(
    params: ResolveAccountParams,
    client?: PublicClient,
  ): Promise<ResolvedTokenBoundAccount>

  /**
   * Encode createAccount calldata for a wallet client (no automatic broadcast).
   * Scaffold only until product enables TBA deploy UX.
   */
  encodeCreateAccount?(params: ResolveAccountParams): {
    to: Address
    data: Hex
    functionName: "createAccount"
    args: readonly [Address, Hex, bigint, Address, bigint]
  }

  /**
   * Product guard: whether transferring `token` into `account` would create a cycle.
   * Depth-1 self-deposit is always blocked when policy.blockSelfOwnershipCycle.
   */
  wouldCreateOwnershipCycle(input: {
    account: Address
    nftContract: Address
    nftTokenId: bigint
    binding: TokenBoundBinding
  }): boolean
}

/** Zulo product identity vs optional TBA account (never conflated). */
export interface ZuloAccountPlane {
  identity: {
    kind: "erc8004-normie"
    name: string
    tokenId: number
    agentId: number
    ens: string
    chainId: number
    collection: Address
    hotWallet: Address
    /** Ledger / vault owner narrative for #7141 */
    delegatedTo?: Address
  }
  /** Optional TBA provider — disabled until product enables it */
  accountProvider: AccountProvider
  controlModes: AccountControlMode[]
  notes: string[]
}
