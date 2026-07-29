/**
 * Zulo tip asset roadmap (product priority).
 *
 * 1. Canvas AP (Normies A2A) — blocked on official Normies docs for live verify
 * 2. USDC via x402
 * 3. ETH Ethereum mainnet
 * 4. ETH Base
 * 5+. Wire Network / cross-chain — later, not typed here yet
 */

import type { TipAssetDef, TipAssetId } from "./types"

export const TIP_ASSETS: readonly TipAssetDef[] = [
  {
    id: "canvas-ap",
    priority: 1,
    kind: "canvas-ap",
    label: "Canvas Action Points (Normies A2A)",
    chainId: null,
    caip2: null,
    verification: "normies-a2a-oracle",
    status: "primary",
    notes: [
      "Primary A2A tip unit when Normies marketplace rails go live.",
      "AP is per-Normie Canvas budget — not eth_getBalance and not TBA inventory.",
      "Live verification blocked until Normies publishes transfer/oracle docs.",
    ],
  },
  {
    id: "x402-usdc",
    priority: 2,
    kind: "x402",
    label: "USDC via x402 (HTTP 402)",
    chainId: 8453,
    caip2: "eip155:8453",
    verification: "x402-facilitator",
    status: "planned",
    notes: [
      "Second priority after Canvas AP.",
      "Chain/asset CAIP details confirmed at build time (Base-first hypothesis).",
      "Settles to PaymentReceiver address (hot wallet today; #7141 TBA eventually).",
    ],
  },
  {
    id: "eth-mainnet",
    priority: 3,
    kind: "native",
    label: "ETH (Ethereum mainnet)",
    chainId: 1,
    caip2: "eip155:1",
    verification: "evm-native-transfer",
    status: "planned",
    notes: ["After AP + x402 patterns are stable."],
  },
  {
    id: "eth-base",
    priority: 4,
    kind: "native",
    label: "ETH (Base)",
    chainId: 8453,
    caip2: "eip155:8453",
    verification: "evm-native-transfer",
    status: "planned",
    notes: ["Same adapter shape as mainnet ETH with chainId=8453."],
  },
] as const

export function getTipAssetsByPriority(): TipAssetDef[] {
  return [...TIP_ASSETS].sort((a, b) => a.priority - b.priority)
}

export function getTipAsset(id: TipAssetId): TipAssetDef | undefined {
  return TIP_ASSETS.find((a) => a.id === id)
}

export function tipAssetPriorityIds(): TipAssetId[] {
  return getTipAssetsByPriority().map((a) => a.id)
}
