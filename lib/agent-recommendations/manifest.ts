// lib/agent-recommendations/manifest.ts
// Marketplace discovery document for Zulo services (A2A-ready).

import {
  ZULO_IDENTITY,
  ZULO_SERVICE_PRICES,
} from "./constants"
import type { ZuloManifest } from "./types"

function siteBase(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://normiescredhub.vercel.app")
  ).replace(/\/$/, "")
}

/**
 * Zulo service manifest for marketplace discovery.
 * Exposed at GET /api/zulo/manifest
 */
export function getManifest(): ZuloManifest {
  const base = siteBase()

  return {
    agent: {
      id: ZULO_IDENTITY.agentId,
      name: ZULO_IDENTITY.name,
      ens: ZULO_IDENTITY.ens,
      wallet: ZULO_IDENTITY.hotWallet,
      type: "ERC-8004",
    },
    services: [
      {
        id: "pulse-analysis",
        name: "PULSE Analysis",
        description: "Interpret Normies Cred Pulse data and current on-chain state",
        price: { amount: ZULO_SERVICE_PRICES["pulse-analysis"] ?? 1, currency: "AP" },
        endpoint: "/api/zulo/ask",
      },
      {
        id: "strategy",
        name: "Strategic Recommendation",
        description: "Personalized earning strategy from PULSE + rarity + Canvas",
        price: { amount: ZULO_SERVICE_PRICES.strategy ?? 2, currency: "AP" },
        endpoint: "/api/zulo/ask",
      },
      {
        id: "urgent",
        name: "Urgent Consultation",
        description: "Priority framing for time-sensitive decisions",
        price: { amount: ZULO_SERVICE_PRICES.urgent ?? 2, currency: "AP" },
        endpoint: "/api/zulo/ask",
      },
      {
        id: "holder-chat",
        name: "Holder Chat",
        description: "Unlimited conversational recommendations via web UI (free today)",
        price: { amount: 0, currency: "FREE" },
        endpoint: "/ask",
      },
    ],
    acceptedCurrencies: ["AP"],
    version: "1.1.0",
    endpoint: base,
    pitch:
      "Zulo is the Normies ecosystem concierge: PULSE, strategy, and community tools. Free chat on the web today; A2A tips in AP when marketplace payment rails go live.",
    freeAccess: {
      path: "/ask",
      description:
        "Web chat at /ask is free for holders and visitors today. Paid A2A services activate when Normies marketplace verifies AP transfers.",
    },
    payment: {
      status: "planned",
      currency: "AP",
      receiverWallet: ZULO_IDENTITY.hotWallet,
      receiverNormieTokenId: ZULO_IDENTITY.tokenId,
      notes: [
        "Prices: PULSE analysis 1 AP, strategy/urgent 2 AP (see services).",
        "Holder web chat remains free until product policy changes.",
        "Payment verification is scaffolded in /api/zulo/ask but not enforced yet.",
        "Canvas AP is per-Normie; tips ledger is separate from #7141 Canvas balance until A2A rails define transfer mechanics.",
      ],
      howToPayWhenLive: [
        "1. Discover Zulo via GET /api/zulo/manifest (this document).",
        "2. Choose a paid service id (pulse-analysis | strategy | urgent).",
        "3. Transfer the listed AP amount to the payment.receiverWallet (or the Canvas path Normies A2A specifies when live).",
        "4. Call POST /api/zulo/ask with service, userQuery, and txHash (or marketplace receipt).",
        "5. Zulo verifies payment then returns the recommendation JSON.",
        "Until status is \"live\", skip payment and use free /ask or /api/zulo/ask without txHash.",
      ],
    },
  }
}

/** Static snapshot (resolves site base at call time via getManifest). */
export const ZULO_MANIFEST: ZuloManifest = getManifest()
