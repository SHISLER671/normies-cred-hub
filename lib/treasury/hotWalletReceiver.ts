/**
 * Default payment receiver — Zulo hot wallet (A2A tips narrative).
 * Live today; remains production default until ZULO_PAYMENT_RECEIVER=tba.
 */

import type { Address, PublicClient } from "viem"
import { getAddress } from "viem"

import { ZULO_IDENTITY } from "@/lib/agent-recommendations/constants"
import { publicClient } from "@/lib/viem-client"

import type { PaymentReceiverAdapter, ReceiverAddressParams } from "./types"

export function createHotWalletReceiver(
  client: PublicClient = publicClient,
): PaymentReceiverAdapter {
  const address = getAddress(ZULO_IDENTITY.hotWallet)

  return {
    id: "hot-wallet",
    status: "live",
    label: `Zulo hot wallet (${ZULO_IDENTITY.ens})`,

    async getReceiverAddress(_params?: ReceiverAddressParams): Promise<Address> {
      return address
    },

    async getNativeBalance(): Promise<bigint> {
      return client.getBalance({ address })
    },
  }
}
