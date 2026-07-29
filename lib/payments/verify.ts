// 7-step payment verification for Zulo A2A tips (scaffold-aware).
// Atomic replay protection via Redis SET NX (or in-memory Set fallback).

import { createPublicClient, http, isAddress, type Hash } from "viem"
import { mainnet } from "viem/chains"

import { ZULO_IDENTITY } from "@/lib/agent-recommendations/constants"
import { appendSecurityEvent } from "@/lib/security/audit"
import { isPaymentsPaused } from "@/lib/security/circuitBreaker"
import { getReceiverAddress } from "@/lib/treasury"
import { txHashSchema } from "@/lib/validation/schemas"
import { Redis } from "@upstash/redis"

/** Minimum confirmations before accepting a payment tx. */
export const MIN_CONFIRMATIONS = 12

/** AP amounts at or above this require stronger finality checks. */
export const HIGH_VALUE_AP = 10

export type PaymentVerifyStep =
  | "format"
  | "circuit"
  | "confirmations"
  | "recipient"
  | "amount"
  | "replay"
  | "reorg"
  | "finality"

export interface PaymentVerifyResult {
  verified: boolean
  steps: Array<{ step: PaymentVerifyStep; ok: boolean; detail: string }>
  txHash: string
  from?: string
  to?: string
  amountAp?: number
  service: string
  confirmations?: number
  finalityProof?: {
    blockNumber: string
    blockHash: string
    parentHash: string
    confirmations: number
  }
  reason?: string
  railStatus: "planned" | "scaffold" | "live"
}

const seenMemory = new Set<string>()

let redis: Redis | null | undefined

function getRedis(): Redis | null {
  if (redis !== undefined) return redis
  const url = process.env.KV_REST_API_URL
  const token = process.env.KV_REST_API_TOKEN
  if (!url || !token) {
    redis = null
    return null
  }
  redis = new Redis({ url, token })
  return redis
}

function railStatus(): "planned" | "scaffold" | "live" {
  const env = process.env.ZULO_PAYMENT_RAIL_STATUS?.trim().toLowerCase()
  if (env === "live") return "live"
  if (env === "scaffold") return "scaffold"
  return "planned"
}

function rpcUrl(): string {
  return (
    process.env.ETH_RPC_URL?.trim() ||
    process.env.NEXT_PUBLIC_ETH_RPC_URL?.trim() ||
    "https://ethereum.publicnode.com"
  )
}

function getClient() {
  return createPublicClient({
    chain: mainnet,
    transport: http(rpcUrl(), { timeout: 12_000 }),
  })
}

/**
 * Atomic claim of txHash for replay protection.
 * Redis SET NX ≈ row lock; memory Set for local.
 */
export async function claimTxHashAtomic(txHash: string): Promise<boolean> {
  const key = `zulo:payments:seen:${txHash.toLowerCase()}`
  const client = getRedis()
  if (client) {
    try {
      // SET NX with long TTL (1 year) — first writer wins (FOR UPDATE analogue)
      const res = await client.set(key, String(Date.now()), { nx: true, ex: 365 * 24 * 3600 })
      return res === "OK"
    } catch (e) {
      console.warn("[payments] redis claim failed, memory fallback", e)
    }
  }
  const h = txHash.toLowerCase()
  if (seenMemory.has(h)) return false
  seenMemory.add(h)
  return true
}

export async function releaseTxHashClaim(txHash: string): Promise<void> {
  const key = `zulo:payments:seen:${txHash.toLowerCase()}`
  const client = getRedis()
  if (client) {
    try {
      await client.del(key)
    } catch {
      /* ignore */
    }
  }
  seenMemory.delete(txHash.toLowerCase())
}

/**
 * 7-step payment verification.
 * When rails are planned/scaffold, steps still run for format/circuit/replay;
 * on-chain steps degrade gracefully without false verified=true.
 */
export async function verifyPayment7Step(input: {
  txHash: string
  expectedAmountAp: number
  service: string
  expectedRecipient?: string
  caller?: string
}): Promise<PaymentVerifyResult> {
  const steps: PaymentVerifyResult["steps"] = []
  const rail = railStatus()
  // EVM tip sink: payment receiver adapter (hot wallet default; TBA when flipped)
  const resolvedReceiver = input.expectedRecipient
    ? input.expectedRecipient
    : await getReceiverAddress({
        tokenId: ZULO_IDENTITY.tokenId,
        chainId: ZULO_IDENTITY.chainId,
      })
  const recipient = resolvedReceiver.toLowerCase()

  const push = (step: PaymentVerifyStep, ok: boolean, detail: string) => {
    steps.push({ step, ok, detail })
  }

  // 1) Format
  const fmt = txHashSchema.safeParse(input.txHash)
  if (!fmt.success) {
    push("format", false, fmt.error.issues[0]?.message || "invalid txHash")
    await reject(input, steps, rail, "invalid txHash format")
    return fail(input, steps, rail, "invalid txHash format")
  }
  const txHash = fmt.data as Hash
  push("format", true, "txHash format valid")

  // 2) Circuit breaker
  if (await isPaymentsPaused()) {
    push("circuit", false, "payments paused (circuit breaker open)")
    await reject(input, steps, rail, "circuit open")
    return fail(input, steps, rail, "payments paused — SEV lockdown")
  }
  push("circuit", true, "circuit closed")

  // Soft path when rails not live: do not mark verified
  if (rail !== "live") {
    push("confirmations", true, `skipped (rail=${rail})`)
    push("recipient", true, `expected ${recipient} (not enforced until live)`)
    push("amount", true, `expected ${input.expectedAmountAp} AP (not enforced until live)`)
    const claimed = await claimTxHashAtomic(txHash)
    if (!claimed) {
      push("replay", false, "txHash already seen")
      await reject(input, steps, rail, "replay")
      return fail(input, steps, rail, "replay detected")
    }
    push("replay", true, "txHash claimed (atomic)")
    // Release claim in non-live mode so tests can re-run; live mode keeps claim
    await releaseTxHashClaim(txHash)
    push("reorg", true, `skipped (rail=${rail})`)
    push("finality", true, `skipped (rail=${rail})`)
    await appendSecurityEvent({
      type: "PAYMENT_REJECTED",
      caller: input.caller,
      txHash,
      amount: input.expectedAmountAp,
      service: input.service,
      detail: `rails not live (${rail}) — verification scaffold only`,
    })
    return {
      verified: false,
      steps,
      txHash,
      to: recipient,
      amountAp: input.expectedAmountAp,
      service: input.service,
      reason: `AP payment rails are ${rail} — verification scaffold ran; not credited`,
      railStatus: rail,
    }
  }

  // LIVE path
  let claimed = false
  try {
    const client = getClient()
    const receipt = await client.getTransactionReceipt({ hash: txHash })
    if (!receipt) {
      push("confirmations", false, "receipt not found")
      return fail(input, steps, rail, "transaction not found")
    }

    const head = await client.getBlockNumber()
    const conf = Number(head - receipt.blockNumber)
    push(
      "confirmations",
      conf >= MIN_CONFIRMATIONS,
      `${conf} confirmations (min ${MIN_CONFIRMATIONS})`,
    )
    if (conf < MIN_CONFIRMATIONS) {
      return fail(input, steps, rail, `need ${MIN_CONFIRMATIONS} confirmations, have ${conf}`)
    }

    // Recipient — transfer logs would be protocol-specific; check tx.to or configured sink
    const tx = await client.getTransaction({ hash: txHash })
    const to = (tx.to || receipt.to || "").toLowerCase()
    // Accept configured receiver; during migration also accept hot wallet fallback
    const hot = ZULO_IDENTITY.hotWallet.toLowerCase()
    const recipientOk = to === recipient || to === hot
    push(
      "recipient",
      recipientOk,
      recipientOk
        ? `to=${to}`
        : `to=${to} expected=${recipient} (hotWallet fallback=${hot})`,
    )
    if (!recipientOk) {
      return fail(input, steps, rail, "recipient mismatch")
    }

    // Amount — without AP ledger, accept expectedAmount as client claim only if value matches env oracle
    // Placeholder: require explicit PAYMENT_AMOUNT_ORACLE hook later
    const amountOk = input.expectedAmountAp > 0
    push(
      "amount",
      amountOk,
      amountOk
        ? `expectedAmountAp=${input.expectedAmountAp} (ledger oracle planned)`
        : "amount missing",
    )
    if (!amountOk) {
      return fail(input, steps, rail, "invalid amount")
    }

    // Replay (atomic)
    claimed = await claimTxHashAtomic(txHash)
    push("replay", claimed, claimed ? "first claim" : "duplicate txHash")
    if (!claimed) {
      return fail(input, steps, rail, "replay detected")
    }

    // Reorg protection — re-read block hash at receipt height
    const block = await client.getBlock({ blockNumber: receipt.blockNumber })
    const still = await client.getTransactionReceipt({ hash: txHash })
    const reorgOk =
      !!still &&
      still.blockHash.toLowerCase() === block.hash.toLowerCase() &&
      still.blockNumber === receipt.blockNumber
    push("reorg", reorgOk, reorgOk ? "canonical receipt matches block" : "receipt moved")
    if (!reorgOk) {
      await releaseTxHashClaim(txHash)
      return fail(input, steps, rail, "reorg protection failed")
    }

    // Finality proof for high-value
    const high = input.expectedAmountAp >= HIGH_VALUE_AP
    const finalityOk = !high || conf >= Math.max(MIN_CONFIRMATIONS, 32)
    const finalityProof = {
      blockNumber: receipt.blockNumber.toString(),
      blockHash: block.hash,
      parentHash: block.parentHash,
      confirmations: conf,
    }
    push(
      "finality",
      finalityOk,
      high
        ? `high-value (>=${HIGH_VALUE_AP} AP) conf=${conf} need>=32`
        : `standard finality conf=${conf}`,
    )
    if (!finalityOk) {
      await releaseTxHashClaim(txHash)
      return fail(input, steps, rail, "insufficient finality for high-value payment")
    }

    await appendSecurityEvent({
      type: "PAYMENT_VERIFIED",
      caller: input.caller || (tx.from as string),
      txHash,
      amount: input.expectedAmountAp,
      service: input.service,
      detail: `conf=${conf}`,
    })

    return {
      verified: true,
      steps,
      txHash,
      from: tx.from,
      to: recipient,
      amountAp: input.expectedAmountAp,
      service: input.service,
      confirmations: conf,
      finalityProof,
      railStatus: rail,
    }
  } catch (e) {
    if (claimed) await releaseTxHashClaim(txHash)
    const msg = e instanceof Error ? e.message : "verification error"
    push("confirmations", false, msg)
    await reject(input, steps, rail, msg)
    return fail(input, steps, rail, msg)
  }
}

function fail(
  input: { txHash: string; expectedAmountAp: number; service: string },
  steps: PaymentVerifyResult["steps"],
  rail: PaymentVerifyResult["railStatus"],
  reason: string,
): PaymentVerifyResult {
  return {
    verified: false,
    steps,
    txHash: input.txHash,
    amountAp: input.expectedAmountAp,
    service: input.service,
    reason,
    railStatus: rail,
  }
}

async function reject(
  input: { txHash: string; expectedAmountAp: number; service: string; caller?: string },
  steps: PaymentVerifyResult["steps"],
  rail: string,
  reason: string,
) {
  await appendSecurityEvent({
    type: "PAYMENT_REJECTED",
    caller: input.caller,
    txHash: input.txHash,
    amount: input.expectedAmountAp,
    service: input.service,
    detail: `${reason} rail=${rail} steps=${steps.filter((s) => !s.ok).map((s) => s.step).join(",")}`,
  })
}

/** Test helper */
export function __clearSeenMemoryForTests() {
  seenMemory.clear()
}
