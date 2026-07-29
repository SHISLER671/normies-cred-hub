// lib/agent-recommendations/verifyPayment.ts
// Payment verification scaffold for future A2A marketplace (not live yet).

import { NORMIES_API_BASE } from "@/constants/contracts"
import { fetchWithTimeout } from "@/lib/fetch-with-timeout"
import { isAddress } from "viem"

import { ZULO_IDENTITY, ZULO_SERVICE_PRICES } from "./constants"

export type PaymentRailStatus = "planned" | "scaffold" | "live"

export interface PaymentVerification {
  from: string
  to: string
  amount: number
  service: string
  txHash: string
  verified: boolean
  /** Why verification failed or is pending */
  reason?: string
  railStatus: PaymentRailStatus
}

/**
 * Current payment rail status for A2A.
 * Flip to "live" only when Normies publishes verifiable AP transfer proofs.
 */
export function getPaymentRailStatus(): PaymentRailStatus {
  const env = process.env.ZULO_PAYMENT_RAIL_STATUS?.trim().toLowerCase()
  if (env === "live") return "live"
  if (env === "scaffold") return "scaffold"
  return "planned"
}

/**
 * Verify AP payment to Zulo's wallet.
 * Scaffold: always returns verified=false until rails exist.
 * When live, replace body with on-chain / marketplace receipt checks.
 */
export async function verifyAPPayment(
  txHash: string,
  expectedAmount: number,
  service: string,
): Promise<PaymentVerification> {
  const railStatus = getPaymentRailStatus()
  const cleanHash = typeof txHash === "string" ? txHash.trim() : ""

  if (!cleanHash) {
    return {
      from: "",
      to: ZULO_IDENTITY.hotWallet,
      amount: 0,
      service,
      txHash: "",
      verified: false,
      reason: "txHash required for paid A2A services",
      railStatus,
    }
  }

  if (railStatus !== "live") {
    console.log("[agent-recommendations] Payment verification scaffold (not live)", {
      txHash: cleanHash.slice(0, 18),
      expectedAmount,
      service,
      to: ZULO_IDENTITY.hotWallet,
      railStatus,
    })

    return {
      from: "",
      to: ZULO_IDENTITY.hotWallet,
      amount: 0,
      service,
      txHash: cleanHash,
      verified: false,
      reason:
        "AP payment rails are not live — verification is scaffolded. Use free /ask or set ZULO_PAYMENT_RAIL_STATUS=live when Normies A2A proofs exist.",
      railStatus,
    }
  }

  // LIVE path placeholder — implement against published A2A receipt schema
  return {
    from: "",
    to: ZULO_IDENTITY.hotWallet,
    amount: 0,
    service,
    txHash: cleanHash,
    verified: false,
    reason: "Live verification handler not implemented for this receipt type",
    railStatus: "live",
  }
}

/**
 * Gate paid services: free for holders of #7141 today; others need verified payment when live.
 * Safe to call anytime — never throws.
 */
export async function requirePaymentIfNeeded(input: {
  service: string
  userWallet?: string
  txHash?: string
}): Promise<
  | { ok: true; free: boolean }
  | { ok: false; status: 402; body: Record<string, unknown> }
> {
  const price = getServicePrice(input.service)
  if (price <= 0) return { ok: true, free: true }

  const holder = input.userWallet ? await isHolder(input.userWallet) : false
  if (holder) return { ok: true, free: true }

  const rail = getPaymentRailStatus()
  if (rail !== "live") {
    // Soft-open: do not block free web while rails planned
    return { ok: true, free: true }
  }

  const payment = await verifyAPPayment(input.txHash || "", price, input.service)
  if (!payment.verified) {
    return {
      ok: false,
      status: 402,
      body: {
        error: "Payment required",
        price,
        currency: "AP",
        service: input.service,
        receiverWallet: ZULO_IDENTITY.hotWallet,
        reason: payment.reason,
        railStatus: payment.railStatus,
      },
    }
  }

  return { ok: true, free: false }
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
