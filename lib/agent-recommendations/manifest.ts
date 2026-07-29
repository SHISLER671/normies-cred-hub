// Marketplace discovery document for Zulo services (A2A-ready).

import {
  ZULO_IDENTITY,
  ZULO_SERVICE_PRICES,
} from "./constants"
import { getAllZuloSkills, ZULO_STRATEGY_SKILLS } from "./skillsCatalog"
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
  const skills = getAllZuloSkills()

  return {
    agent: {
      id: ZULO_IDENTITY.agentId,
      name: ZULO_IDENTITY.name,
      ens: ZULO_IDENTITY.ens,
      wallet: ZULO_IDENTITY.hotWallet,
      type: "ERC-8004",
    },
    role: "strategic-architect",
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
        name: "Strategic Architecture",
        description:
          "Personalized strategy from PULSE + rarity + Canvas + burn/market/canvas skills",
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
        id: "burn-efficiency",
        name: "Burn Efficiency Scan",
        description: "Top burn fodder by expected AP per ETH",
        price: { amount: ZULO_SERVICE_PRICES.strategy ?? 2, currency: "AP" },
        endpoint: "/api/zulo/ask",
      },
      {
        id: "market-sentinel",
        name: "PIXEL MARKET Sentinel",
        description: "Floor / burn / whale intelligence brief",
        price: { amount: ZULO_SERVICE_PRICES.strategy ?? 2, currency: "AP" },
        endpoint: "/api/zulo/ask",
      },
      {
        id: "canvas-preview",
        name: "Canvas Evolution Preview",
        description: "Simulate edits, AP cost, PROCEED/MODIFY/ABANDON",
        price: { amount: ZULO_SERVICE_PRICES["pulse-analysis"] ?? 1, currency: "AP" },
        endpoint: "/api/zulo/ask",
      },
      {
        id: "holder-chat",
        name: "Architect Chat",
        description: "Unlimited strategic conversation via web UI (free today)",
        price: { amount: 0, currency: "FREE" },
        endpoint: "/ask",
      },
    ],
    skills: skills.map((s) => ({
      id: s.id,
      name: s.name,
      status: s.status,
      description: s.description,
      samplePrompt: s.prompt,
      endpoint: s.endpoint,
    })),
    strategySkills: ZULO_STRATEGY_SKILLS.map((s) => s.id),
    acceptedCurrencies: ["AP"],
    version: "1.3.0",
    endpoint: base,
    pitch:
      "Zulo is the Normies Strategic Architect: PULSE, burn efficiency, PIXEL MARKET signals, canvas evolution, and (when live) gacha/raffle EV. Free web chat today; A2A tips in AP when marketplace rails go live.",
    freeAccess: {
      path: "/ask",
      description:
        "Web chat at /ask is free for holders and visitors today. Paid A2A services activate when Normies marketplace verifies AP transfers.",
    },
    integrations: {
      normiesApi: "https://api.normies.art",
      opensea: {
        collection: "https://opensea.io/collection/normies",
        stats: "optional OPENSEA_API_KEY for listings; public collection stats used as fallback",
      },
      pixelMarket: {
        status: "planned",
        note: "AP book / WS feeds not public yet — Sentinel uses floor-burn efficiency as proxy",
      },
      ethos: "optional reputation enrichment",
    },
    payment: {
      status: "planned",
      currency: "AP",
      receiverWallet: ZULO_IDENTITY.hotWallet,
      receiverNormieTokenId: ZULO_IDENTITY.tokenId,
      verification: {
        module: "lib/agent-recommendations/verifyPayment.ts",
        enforced: false,
        methods: ["txHash-scaffold", "marketplace-receipt-planned"],
      },
      notes: [
        "Prices: PULSE analysis 1 AP, strategy/sentinel/burn scans 2 AP (see services).",
        "Holder web chat remains free until product policy changes.",
        "Payment verification is scaffolded in /api/zulo/ask but not enforced yet.",
        "Canvas AP is per-Normie; tips ledger is separate from #7141 Canvas balance until A2A rails define transfer mechanics.",
      ],
      howToPayWhenLive: [
        "1. Discover Zulo via GET /api/zulo/manifest (this document).",
        "2. Choose a paid service id (pulse-analysis | strategy | urgent | burn-efficiency | market-sentinel | canvas-preview).",
        "3. Transfer the listed AP amount to the payment.receiverWallet (or the Canvas path Normies A2A specifies when live).",
        "4. Call POST /api/zulo/ask with service, userQuery, and txHash (or marketplace receipt).",
        "5. Zulo verifies payment then returns the recommendation JSON.",
        "Until status is \"live\", skip payment and use free /ask or /api/zulo/ask without txHash.",
      ],
    },
    health: `${base}/api/zulo/health`,
  }
}

/** Static snapshot (resolves site base at call time via getManifest). */
export const ZULO_MANIFEST: ZuloManifest = getManifest()
