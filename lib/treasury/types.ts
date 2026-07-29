/**
 * Payment / tip treasury types for Zulo.
 *
 * Account plane (ERC-6551) is separate — see lib/erc6551.
 * Canvas AP is NOT an EVM balance on a TBA — see tipAssets.ts.
 */

import type { Address } from "viem"

/**
 * Tip assets in product priority order (1 = first when rails exist).
 * Wire Network / cross-chain is intentionally omitted until 1–4 ship.
 */
export type TipAssetId =
  | "canvas-ap"
  | "x402-usdc"
  | "eth-mainnet"
  | "eth-base"

export type TipAssetKind = "canvas-ap" | "x402" | "native"

export interface TipAssetDef {
  id: TipAssetId
  /** 1 = highest priority */
  priority: number
  kind: TipAssetKind
  label: string
  /** CAIP-2 where applicable; null for Normies-native AP */
  chainId: number | null
  caip2: string | null
  /**
   * How verification works when the rail is live.
   * canvas-ap stays stubbed until Normies official A2A docs.
   */
  verification: "normies-a2a-oracle" | "x402-facilitator" | "evm-native-transfer"
  status: "primary" | "planned" | "deferred"
  notes: string[]
}

export type PaymentReceiverId = "hot-wallet" | "erc6551-tba"

export type PaymentReceiverStatus = "live" | "scaffold" | "disabled"

export interface ReceiverAddressParams {
  /** Normie token id — used by TBA receiver; ignored by hot wallet */
  tokenId?: number
  chainId?: number
}

/**
 * Thin payment-receiver port (EVM destination + metadata).
 * Do NOT put Canvas AP getBalance on this interface.
 */
export interface PaymentReceiverAdapter {
  readonly id: PaymentReceiverId
  readonly status: PaymentReceiverStatus
  /** Human label for manifests / logs */
  readonly label: string
  getReceiverAddress(params?: ReceiverAddressParams): Promise<Address>
  /**
   * Optional native ETH balance at the receiver (EVM only).
   * Never use this for Canvas AP.
   */
  getNativeBalance?(params?: ReceiverAddressParams): Promise<bigint>
}

export interface PaymentReceiverSnapshot {
  id: PaymentReceiverId
  status: PaymentReceiverStatus
  label: string
  address: Address
  tokenId: number | null
  chainId: number
  tipAssetPriority: TipAssetId[]
  migration: string[]
  notes: string[]
}
