// GET /api/zulo/security — public security posture (no secrets).

import { NextResponse } from "next/server"

import { ZULO_IDENTITY } from "@/lib/agent-recommendations/constants"

export const dynamic = "force-dynamic"

export async function GET() {

  return NextResponse.json(
    {
      posture: "I assume breach. Every request is adversarial.",
      agent: {
        name: ZULO_IDENTITY.name,
        ens: ZULO_IDENTITY.ens,
        tokenId: ZULO_IDENTITY.tokenId,
        role: "strategic-architect",
      },
      layers: [
        "read-only (no transactions, approvals or typed-data signatures)",
        "strict-input-validation",
        "dual-key-rate-limits",
        "allowlisted-upstream-paths",
        "security-headers",
        "append-only-audit-log",
      ],
      // Parked: Zulo takes no payments, and this endpoint doesn't describe how payments would work.
      payments: "parked",
      bugBounty: {
        status: "informal",
        scope: "normiescredhub.vercel.app pages and APIs",
        outOfScope: ["social engineering of holders", "physical attacks", "third-party NFT markets"],
        report: "POST /api/zulo/security/report",
        privateAdvisory: "https://github.com/SHISLER671/normies-cred-hub/security/advisories/new",
        note: "No public SEV1 disclosure until mitigated.",
      },
      responsibleDisclosure: [
        "1. Report via POST /api/zulo/security/report or a private GitHub security advisory.",
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
