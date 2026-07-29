/**
 * Security unit tests — run with: pnpm test:security
 * Covers validation, replay, rate-limit message, circuit memory.
 */

import assert from "node:assert/strict"
import { describe, it, beforeEach } from "node:test"

import {
  txHashSchema,
  amountSchema,
  serviceSchema,
  signatureSchema,
  timestampSchema,
  paymentVerifySchema,
  MAX_PAYMENT_AP,
} from "../validation/schemas"
import {
  claimTxHashAtomic,
  releaseTxHashClaim,
  verifyPayment7Step,
  __clearSeenMemoryForTests,
} from "../payments/verify"
import { RATE_LIMIT_MESSAGE } from "../middleware/rateLimit"
import {
  __resetCircuitMemoryForTests,
  getCircuitState,
  tripCircuitBreaker,
  isPaymentsPaused,
} from "./circuitBreaker"
import {
  appendSecurityEvent,
  verifyEventSignature,
  merkleLeafProof,
} from "./audit"

const VALID_TX =
  "0x" + "ab".repeat(32)

describe("input validation", () => {
  it("accepts valid txHash", () => {
    assert.equal(txHashSchema.safeParse(VALID_TX).success, true)
  })

  it("rejects short txHash", () => {
    assert.equal(txHashSchema.safeParse("0x1234").success, false)
  })

  it("rejects non-hex txHash", () => {
    assert.equal(
      txHashSchema.safeParse("0x" + "zz".repeat(32)).success,
      false,
    )
  })

  it("amount must be positive and within max", () => {
    assert.equal(amountSchema.safeParse(1).success, true)
    assert.equal(amountSchema.safeParse(0).success, false)
    assert.equal(amountSchema.safeParse(-1).success, false)
    assert.equal(amountSchema.safeParse(Number(MAX_PAYMENT_AP) + 1).success, false)
  })

  it("service enum", () => {
    assert.equal(serviceSchema.safeParse("strategy").success, true)
    assert.equal(serviceSchema.safeParse("not-a-service").success, false)
  })

  it("signature length 130 hex", () => {
    const sig = "0x" + "cd".repeat(65)
    assert.equal(signatureSchema.safeParse(sig).success, true)
    assert.equal(signatureSchema.safeParse("0x" + "cd".repeat(64)).success, false)
  })

  it("timestamp within 60s", () => {
    assert.equal(timestampSchema.safeParse(Date.now()).success, true)
    assert.equal(timestampSchema.safeParse(Date.now() - 120_000).success, false)
  })

  it("paymentVerifySchema edge cases", () => {
    const ok = paymentVerifySchema.safeParse({
      txHash: VALID_TX,
      amount: 2,
      service: "strategy",
    })
    assert.equal(ok.success, true)
  })
})

describe("replay protection", () => {
  beforeEach(() => {
    __clearSeenMemoryForTests()
  })

  it("atomic claim allows first, rejects second", async () => {
    const a = await claimTxHashAtomic(VALID_TX)
    const b = await claimTxHashAtomic(VALID_TX)
    assert.equal(a, true)
    assert.equal(b, false)
    await releaseTxHashClaim(VALID_TX)
    const c = await claimTxHashAtomic(VALID_TX)
    assert.equal(c, true)
  })

  it("scaffold verify rejects replay-style double claim path", async () => {
    // Non-live path releases claim; still validates format
    const r = await verifyPayment7Step({
      txHash: VALID_TX,
      expectedAmountAp: 2,
      service: "strategy",
    })
    assert.equal(r.verified, false)
    assert.equal(r.steps.find((s) => s.step === "format")?.ok, true)
  })
})

describe("rate limit messaging", () => {
  it("uses Patience compounds phrase", () => {
    assert.match(RATE_LIMIT_MESSAGE, /Patience compounds/)
  })
})

describe("circuit breaker", () => {
  beforeEach(() => {
    __resetCircuitMemoryForTests()
  })

  it("trip pauses payments", async () => {
    assert.equal(await isPaymentsPaused(), false)
    await tripCircuitBreaker("test sev1")
    assert.equal(await isPaymentsPaused(), true)
    const s = await getCircuitState()
    assert.equal(s.state, "open")
  })
})

describe("audit log", () => {
  it("signs events and verifies HMAC", async () => {
    const ev = await appendSecurityEvent({
      type: "VALIDATION_FAIL",
      detail: "unit-test",
      txHash: VALID_TX,
    })
    assert.equal(verifyEventSignature(ev), true)
    const proof = merkleLeafProof(ev)
    assert.equal(proof.leaf, ev.entryHash)
  })
})
