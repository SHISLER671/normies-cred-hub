// Payment verification facade — delegates to hardened lib/payments/verify.

import { NORMIES_API_BASE } from "@/constants/contracts"
import { fetchWithTimeout } from "@/lib/fetch-with-timeout"
import { isAddress } from "viem"

import { ZULO_IDENTITY, ZULO_SERVICE_PRICES } from "./constants"
import {
  verifyPayment7Step,
  type PaymentVerifyResult,
} from "@/lib/payments/verify"
import { isPaymentsPaused } from "@/lib/security/circuitBreaker"

export type PaymentRailStatus = "planned" | "scaffold" | "live"

export interface PaymentVerification {
  from: string
  to: string
  amount: number
  service: string
  txHash: string
  verified: boolean
  reason?: string
  railStatus: PaymentRailStatus
  steps?: PaymentVerifyResult["steps"]
}

export function getPaymentRailStatus(): PaymentRailStatus {
  const env = process.env.ZULO_PAYMENT_RAIL_STATUS?.trim().toLowerCase()
  if (env === "live") return "live"
  if (env === "scaffold") return "scaffold"
  return "planned"
}

/**
 * Verify AP payment via 7-step pipeline (format, circuit, confirmations, …).
 */
export async function verifyAPPayment(
  txHash: string,
  expectedAmount: number,
  service: string,
  caller?: string,
): Promise<PaymentVerification> {
  if (await isPaymentsPaused()) {
    return {
      from: "",
      to: ZULO_IDENTITY.hotWallet,
      amount: 0,
      service,
      txHash,
      verified: false,
      reason: "payments paused (circuit breaker)",
      railStatus: getPaymentRailStatus(),
    }
  }

  const result = await verifyPayment7Step({
    txHash,
    expectedAmountAp: expectedAmount,
    service,
    caller,
  })

  return {
    from: result.from || "",
    to: result.to || ZULO_IDENTITY.hotWallet,
    amount: result.amountAp ?? 0,
    service,
    txHash: result.txHash,
    verified: result.verified,
    reason: result.reason,
    railStatus: result.railStatus,
    steps: result.steps,
  }
}

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
    return { ok: true, free: true }
  }

  if (await isPaymentsPaused()) {
    return {
      ok: false,
      status: 402,
      body: {
        error: "Payments paused",
        code: "circuit_open",
        reason: "circuit breaker open",
      },
    }
  }

  const payment = await verifyAPPayment(
    input.txHash || "",
    price,
    input.service,
    input.userWallet,
  )
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
        steps: payment.steps,
      },
    }
  }

  return { ok: true, free: false }
}

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

export function getServicePrice(serviceId: string): number {
  return ZULO_SERVICE_PRICES[serviceId] ?? 0
}
