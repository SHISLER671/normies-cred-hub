// GET /api/zulo/security — public security posture (no secrets).

import { NextResponse } from "next/server"

import { ZULO_IDENTITY } from "@/lib/agent-recommendations/constants"
import { getCircuitState } from "@/lib/security/circuitBreaker"
import { getPaymentRailStatus } from "@/lib/agent-recommendations/verifyPayment"
import { HIGH_VALUE_AP, MIN_CONFIRMATIONS } from "@/lib/payments/verify"

export const dynamic = "force-dynamic"

export async function GET() {
  const circuit = await getCircuitState()

  return NextResponse.json(
    {
      posture: "I assume breach. Every transaction is adversarial.",
      agent: {
        name: ZULO_IDENTITY.name,
        ens: ZULO_IDENTITY.ens,
        tokenId: ZULO_IDENTITY.tokenId,
        role: "strategic-architect",
      },
      layers: [
        "crypto-format-validation",
        "7-step-payment-verification",
        "dual-key-rate-limits",
        "strict-input-schemas",
        "security-headers",
        "append-only-audit-log",
        "payment-circuit-breaker",
      ],
      payment: {
        railStatus: getPaymentRailStatus(),
        minConfirmations: MIN_CONFIRMATIONS,
        highValueApThreshold: HIGH_VALUE_AP,
        paymentsPaused: circuit.paymentsPaused,
        circuit: circuit.state,
      },
      bugBounty: {
        status: "informal",
        scope: "normiescredhub.vercel.app API + payment verification surface",
        outOfScope: ["social engineering of holders", "physical attacks", "third-party NFT markets"],
        report: "POST /api/zulo/security/report",
        email: "security@normiescredhub.example",
        note: "Replace email with project mailbox. No public SEV1 disclosure until mitigated.",
      },
      responsibleDisclosure: [
        "1. Report via POST /api/zulo/security/report or security email.",
        "2. Allow reasonable time for mitigation before public write-up.",
        "3. Do not exploit beyond minimal PoC; no user fund theft.",
      ],
      docs: {
        knowledge: "lib/agent-recommendations/knowledge/payment-security.md",
        health: "/api/zulo/health",
      },
      asOf: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
      },
    },
  )
}
