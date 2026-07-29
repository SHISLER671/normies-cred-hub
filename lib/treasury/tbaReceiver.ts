/**
 * ERC-6551 TBA payment receiver for a Normie (default Zulo #7141).
 *
 * Scaffold: resolves deterministic TBA via lib/erc6551 (Tokenbound V3).
 * Not production default — enable with ZULO_PAYMENT_RECEIVER=tba after product flip.
 *
 * Canvas AP is NEVER read from this address as balanceOf.
 */

import type { Address, PublicClient } from "viem"
import { getAddress } from "viem"

import { NORMIES_NFT } from "@/constants/contracts"
import { ZULO_IDENTITY } from "@/lib/agent-recommendations/constants"
import { createTokenboundAccountProvider } from "@/lib/erc6551"
import { publicClient } from "@/lib/viem-client"

import type { PaymentReceiverAdapter, ReceiverAddressParams } from "./types"

export type TbaReceiverOptions = {
  defaultTokenId?: number
  defaultChainId?: number
  collection?: Address
  client?: PublicClient
  /** scaffold until ops flips payment receiver to TBA */
  status?: "scaffold" | "live"
}

export function createTbaReceiver(
  options: TbaReceiverOptions = {},
): PaymentReceiverAdapter {
  const defaultTokenId = options.defaultTokenId ?? ZULO_IDENTITY.tokenId
  const defaultChainId = options.defaultChainId ?? ZULO_IDENTITY.chainId
  const collection = getAddress(options.collection ?? NORMIES_NFT)
  const client = options.client ?? publicClient
  const status = options.status ?? "scaffold"

  const provider = createTokenboundAccountProvider({
    status,
    defaultClient: client,
  })

  return {
    id: "erc6551-tba",
    status,
    label: `Normie TBA (ERC-6551 · default #${defaultTokenId})`,

    async getReceiverAddress(params?: ReceiverAddressParams): Promise<Address> {
      const tokenId = params?.tokenId ?? defaultTokenId
      const chainId = params?.chainId ?? defaultChainId
      const resolved = await provider.resolveAccount(
        {
          chainId,
          tokenContract: collection,
          tokenId,
          enrich: false,
        },
        client,
      )
      return resolved.address
    },

    async getNativeBalance(params?: ReceiverAddressParams): Promise<bigint> {
      const address = await this.getReceiverAddress!(params)
      return client.getBalance({ address })
    },
  }
}
