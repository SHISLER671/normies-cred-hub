/**
 * Zulo account plane: identity (live) + optional TBA provider (future).
 *
 * Live today:
 *   Normie #7141 → ERC-8004 agent 32626 → owner/Canvas-delegate control
 *   Hot wallet for A2A tips narrative — not a TBA inventory
 *
 * Future:
 *   Optional ERC-6551 TBA via Tokenbound V3 provider for NFT-bound wallet
 *   without replacing ERC-8004 agent identity
 */

import type { Address, PublicClient } from "viem"
import { getAddress } from "viem"

import { NORMIES_NFT } from "@/constants/contracts"
import {
  ZULO_IDENTITY,
} from "@/lib/agent-recommendations/constants"
import { publicClient } from "@/lib/viem-client"

import { createDisabledAccountProvider } from "./providers/disabled"
import { createTokenboundAccountProvider } from "./providers/tokenbound"
import type {
  AccountControlMode,
  AccountProvider,
  ResolveAccountParams,
  ResolvedTokenBoundAccount,
  ZuloAccountPlane,
} from "./types"

export type ZuloTbaEnablement = "disabled" | "scaffold" | "live"

/**
 * Env: ZULO_TBA_PROVIDER_STATUS
 *   disabled (default) — no TBA resolution in product paths
 *   scaffold — resolve/encode allowed for research & dry-run
 *   live — product may surface TBA addresses as first-class
 */
export function getZuloTbaProviderStatus(): ZuloTbaEnablement {
  const raw = process.env.ZULO_TBA_PROVIDER_STATUS?.trim().toLowerCase()
  if (raw === "live") return "live"
  if (raw === "scaffold") return "scaffold"
  return "disabled"
}

export function createZuloAccountProvider(
  status: ZuloTbaEnablement = getZuloTbaProviderStatus(),
  client: PublicClient = publicClient,
): AccountProvider {
  if (status === "disabled") {
    return createDisabledAccountProvider(
      "ZULO_TBA_PROVIDER_STATUS=disabled — ERC-6551 not part of live Zulo identity",
    )
  }
  return createTokenboundAccountProvider({
    status,
    defaultClient: client,
  })
}

export function getZuloAccountPlane(
  status: ZuloTbaEnablement = getZuloTbaProviderStatus(),
): ZuloAccountPlane {
  const controlModes: AccountControlMode[] = [
    "erc721-owner",
    "canvas-delegate",
    "hot-wallet",
  ]
  if (status !== "disabled") {
    controlModes.push("erc6551-signer")
  }

  return {
    identity: {
      kind: "erc8004-normie",
      name: ZULO_IDENTITY.name,
      tokenId: ZULO_IDENTITY.tokenId,
      agentId: ZULO_IDENTITY.agentId,
      ens: ZULO_IDENTITY.ens,
      chainId: ZULO_IDENTITY.chainId,
      collection: getAddress(NORMIES_NFT),
      hotWallet: getAddress(ZULO_IDENTITY.hotWallet),
      delegatedTo: getAddress(ZULO_IDENTITY.delegatedTo),
    },
    accountProvider: createZuloAccountProvider(status),
    controlModes,
    notes: [
      "Identity is ERC-8004 agentId bound to Normie ERC-721 — not ERC-6551.",
      "Canvas AP is per-Normie and non-transferable via TBA inventory today.",
      "Hot wallet is receive-oriented for planned A2A tips; not a TBA.",
      "When TBA is enabled, addresses are deterministic pre-deploy via registry.account().",
      "Do not fold TBA into core identity types until provider status is live.",
    ],
  }
}

/** Resolve a Normie token's TBA (Tokenbound V3 defaults) when provider allows. */
export async function resolveNormieTba(
  tokenId: number | bigint,
  options: {
    chainId?: number
    collection?: Address
    enrich?: boolean
    status?: ZuloTbaEnablement
    client?: PublicClient
  } = {},
): Promise<ResolvedTokenBoundAccount> {
  const status = options.status ?? getZuloTbaProviderStatus()
  if (status === "disabled") {
    throw new Error(
      "Normie TBA resolution disabled (set ZULO_TBA_PROVIDER_STATUS=scaffold|live)",
    )
  }

  const provider = createZuloAccountProvider(status, options.client ?? publicClient)
  const params: ResolveAccountParams = {
    chainId: options.chainId ?? ZULO_IDENTITY.chainId,
    tokenContract: getAddress(options.collection ?? NORMIES_NFT),
    tokenId,
    enrich: options.enrich ?? false,
  }
  return provider.resolveAccount(params, options.client)
}

/** Convenience: Zulo (#7141) TBA under current provider status. */
export async function resolveZuloTba(
  options: {
    enrich?: boolean
    status?: ZuloTbaEnablement
    client?: PublicClient
  } = {},
): Promise<ResolvedTokenBoundAccount> {
  return resolveNormieTba(ZULO_IDENTITY.tokenId, options)
}

/**
 * Product guard for depositing an NFT into a TBA.
 * Blocks depth-1 self-ownership cycles when security policy requires it.
 */
export function assertSafeTbaDeposit(input: {
  provider: AccountProvider
  account: Address
  nftContract: Address
  nftTokenId: bigint
  binding: ResolvedTokenBoundAccount["binding"]
}): void {
  if (
    input.provider.wouldCreateOwnershipCycle({
      account: input.account,
      nftContract: input.nftContract,
      nftTokenId: input.nftTokenId,
      binding: input.binding,
    })
  ) {
    throw new Error(
      "Blocked: depositing the bound NFT into its own TBA would create an ownership cycle",
    )
  }
}
