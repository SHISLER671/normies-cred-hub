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
        description: "Unlimited conversational recommendations for holders (free web UI)",
        price: { amount: 0, currency: "FREE" },
        endpoint: "/agent-recommendations",
      },
    ],
    acceptedCurrencies: ["AP"],
    version: "1.0.0",
    endpoint: base,
  }
}

/** Static snapshot (resolves site base at call time via getManifest). */
export const ZULO_MANIFEST: ZuloManifest = getManifest()
