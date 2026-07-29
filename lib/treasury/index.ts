/**
 * Zulo treasury — payment receiver + tip asset roadmap.
 *
 * @example
 * ```ts
 * import { getPaymentReceiver, getReceiverAddress } from "@/lib/treasury"
 * const to = await getReceiverAddress()
 * ```
 */

import type { Address } from "viem"
import { getAddress } from "viem"

import { ZULO_IDENTITY } from "@/lib/agent-recommendations/constants"

import { createHotWalletReceiver } from "./hotWalletReceiver"
import { createTbaReceiver } from "./tbaReceiver"
import { tipAssetPriorityIds } from "./tipAssets"
import type {
  PaymentReceiverAdapter,
  PaymentReceiverId,
  PaymentReceiverSnapshot,
  ReceiverAddressParams,
} from "./types"

export type { TipAssetId, TipAssetDef, PaymentReceiverAdapter, PaymentReceiverId, PaymentReceiverSnapshot, ReceiverAddressParams } from "./types"
export { TIP_ASSETS, getTipAssetsByPriority, getTipAsset, tipAssetPriorityIds } from "./tipAssets"
export { createHotWalletReceiver } from "./hotWalletReceiver"
export { createTbaReceiver } from "./tbaReceiver"

/**
 * ZULO_PAYMENT_RECEIVER:
 *   hot-wallet | hotwallet | hot (default) — live hot wallet
 *   tba | erc6551 | 6551 — #7141 TBA (scaffold until explicitly live)
 *
 * Independent of ZULO_TBA_PROVIDER_STATUS (account plane).
 */
export function getPaymentReceiverMode(): PaymentReceiverId {
  const raw = process.env.ZULO_PAYMENT_RECEIVER?.trim().toLowerCase()
  if (
    raw === "tba" ||
    raw === "erc6551" ||
    raw === "erc6551-tba" ||
    raw === "6551"
  ) {
    return "erc6551-tba"
  }
  return "hot-wallet"
}

export function getPaymentReceiver(
  mode: PaymentReceiverId = getPaymentReceiverMode(),
): PaymentReceiverAdapter {
  if (mode === "erc6551-tba") {
    // When selected via env, mark live so product can use it; still ops responsibility
    return createTbaReceiver({ status: "live" })
  }
  return createHotWalletReceiver()
}

/** Resolve current EVM tip receiver address (default hot wallet). */
export async function getReceiverAddress(
  params?: ReceiverAddressParams,
): Promise<Address> {
  const adapter = getPaymentReceiver()
  return adapter.getReceiverAddress(params)
}

/**
 * Snapshot for manifests, health, and prompts.
 * TBA address resolution is async; hot wallet is sync-fast.
 */
export async function getPaymentReceiverSnapshot(
  params?: ReceiverAddressParams,
): Promise<PaymentReceiverSnapshot> {
  const mode = getPaymentReceiverMode()
  const adapter = getPaymentReceiver(mode)
  let address: Address
  try {
    address = await adapter.getReceiverAddress({
      tokenId: params?.tokenId ?? ZULO_IDENTITY.tokenId,
      chainId: params?.chainId ?? ZULO_IDENTITY.chainId,
    })
  } catch {
    // TBA resolve failure must not break manifest — fall back to hot wallet
    address = getAddress(ZULO_IDENTITY.hotWallet)
  }

  return {
    id: adapter.id,
    status: adapter.status,
    label: adapter.label,
    address,
    tokenId: mode === "erc6551-tba" ? (params?.tokenId ?? ZULO_IDENTITY.tokenId) : null,
    chainId: params?.chainId ?? ZULO_IDENTITY.chainId,
    tipAssetPriority: tipAssetPriorityIds(),
    migration: [
      "Default: hot wallet (live).",
      "Eventually: #7141 TBA may receive EVM tips (and AP if Normies allows).",
      "Flip: ZULO_PAYMENT_RECEIVER=tba after TBA deploy + product decision.",
      "Independent of ZULO_TBA_PROVIDER_STATUS (account plane).",
    ],
    notes: [
      "Canvas AP verification uses Normies A2A oracle when docs exist — not balanceOf(receiver).",
      "Tip priority: canvas-ap → x402-usdc → eth-mainnet → eth-base → Wire Network later.",
    ],
  }
}
