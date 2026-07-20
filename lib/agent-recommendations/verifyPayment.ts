// lib/agent-recommendations/verifyPayment.ts
// Payment verification scaffold for future A2A marketplace (not live yet).

import { NORMIES_API_BASE } from "@/constants/contracts"
import { fetchWithTimeout } from "@/lib/fetch-with-timeout"
import { isAddress } from "viem"

import { ZULO_IDENTITY, ZULO_SERVICE_PRICES } from "./constants"

export interface PaymentVerification {
  from: string
  to: string
  amount: number
  service: string
  txHash: string
  verified: boolean
}

/**
 * Verify AP payment to Zulo's wallet.
 * PLACEHOLDER until Canvas payment rails / contract details are public.
 */
export async function verifyAPPayment(
  txHash: string,
  expectedAmount: number,
  service: string,
): Promise<PaymentVerification> {
  console.log("[agent-recommendations] Payment verification not yet implemented", {
    txHash,
    expectedAmount,
    service,
    to: ZULO_IDENTITY.hotWallet,
  })

  return {
    from: "",
    to: ZULO_IDENTITY.hotWallet,
    amount: 0,
    service,
    txHash,
    verified: false,
  }
}

/**
 * Best-effort: true if wallet currently owns Normie #7141 (Zulo's body).
 */
export async function isHolder(walletAddress: string): Promise<boolean> {
  if (!walletAddress || !isAddress(walletAddress)) return false

  try {
    const res = await fetchWithTimeout(
      `${NORMIES_API_BASE}/normie/${ZULO_IDENTITY.tokenId}/owner`,
      {},
      8_000,
    )
    if (!res.ok) return false
    const data = (await res.json()) as { owner?: string }
    if (!data.owner || !isAddress(data.owner)) return false
    return data.owner.toLowerCase() === walletAddress.toLowerCase()
  } catch {
    return false
  }
}

/** Required AP amount for a service id (0 if free/unknown). */
export function getServicePrice(serviceId: string): number {
  return ZULO_SERVICE_PRICES[serviceId] ?? 0
}
