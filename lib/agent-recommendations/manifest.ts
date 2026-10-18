// Marketplace discovery document for Zulo services (A2A-ready).

import {
  getPaymentReceiverMode,
  getPaymentReceiverSnapshot,
  tipAssetPriorityIds,
} from "@/lib/treasury"
import {
  getConversionOracleStatus,
  getDefaultCurrency,
  getFallbackCurrency,
  getAcceptedCurrencies,
  getManifestCurrencies,
  getPixelCurrencyStatus,
} from "@/lib/payments/config"
import { resolvePaymentRailStatus } from "@/lib/payments/rail-policy"

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
 * Payments are dormant (#WillWork4PIXEL, parked): lib/payments/rail-policy.ts hard-blocks "live" until Ryan changes the
 * no-crypto-as-income rule. While dormant the public manifest lists every service as FREE and carries no payment block,
 * no receiver wallet and no how-to-pay steps. The paid shape below stays in code, ready for the day it is allowed.
 */
function paymentsOffered(): boolean {
  return resolvePaymentRailStatus(process.env.ZULO_PAYMENT_RAIL_STATUS) === "live"
}

function servicePrice(ap: number): { amount: number; currency: "AP" | "FREE" } {
  return paymentsOffered() ? { amount: ap, currency: "AP" } : { amount: 0, currency: "FREE" }
}

/**
 * Zulo service manifest for marketplace discovery.
 * Exposed at GET /api/zulo/manifest
 */
export async function getManifest(): Promise<ZuloManifest> {
  const base = siteBase()
  const skills = getAllZuloSkills()
  const receiver = await getPaymentReceiverSnapshot({
    tokenId: ZULO_IDENTITY.tokenId,
    chainId: ZULO_IDENTITY.chainId,
  })
  const mode = getPaymentReceiverMode()
  const offered = paymentsOffered()

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
        price: servicePrice(ZULO_SERVICE_PRICES["pulse-analysis"] ?? 1),
        endpoint: "/api/zulo/ask",
      },
      {
        id: "strategy",
        name: "Strategic Architecture",
        description:
          "Personalized strategy from PULSE + rarity + Canvas + burn/market/canvas skills",
        price: servicePrice(ZULO_SERVICE_PRICES.strategy ?? 2),
        endpoint: "/api/zulo/ask",
      },
      {
        id: "urgent",
        name: "Urgent Consultation",
        description: "Priority framing for time-sensitive decisions",
        price: servicePrice(ZULO_SERVICE_PRICES.urgent ?? 2),
        endpoint: "/api/zulo/ask",
      },
      {
        id: "burn-efficiency",
        name: "Burn Efficiency Scan",
        description: "Top burn fodder by expected AP per ETH",
        price: servicePrice(ZULO_SERVICE_PRICES.strategy ?? 2),
        endpoint: "/api/zulo/ask",
      },
      {
        id: "market-sentinel",
        name: "PIXEL MARKET Sentinel",
        description: "Floor / burn / whale intelligence brief",
        price: servicePrice(ZULO_SERVICE_PRICES.strategy ?? 2),
        endpoint: "/api/zulo/ask",
      },
      {
        id: "canvas-preview",
        name: "Canvas Evolution Preview",
        description: "Simulate edits, official #PIXEL pixel budget, PROCEED/MODIFY/ABANDON — not an AP debit",
        price: servicePrice(ZULO_SERVICE_PRICES["pulse-analysis"] ?? 1),
        endpoint: "/api/zulo/ask",
      },
      {
        id: "holder-chat",
        name: "Architect Chat",
        description: "Unlimited strategic conversation via web UI (free today)",
        price: { amount: 0, currency: "FREE" },
        endpoint: "/ask",
      },
      {
        id: "path-rank",
        name: "Moves Ranking",
        description:
          "Intent → 3–5 Pulse-weighted agent/tool Moves (concierge ranking, not chat). Free; A2A planned. UI at /paths.",
        price: { amount: 0, currency: "FREE" },
        endpoint: "/api/zulo/paths",
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
    // Enforcement list: AP always; PIXEL only when PIXEL_CURRENCY_ENABLED
    acceptedCurrencies: getAcceptedCurrencies(),
    version: "1.5.0",
    endpoint: base,
    pitch: offered
      ? "Zulo is the Normies Strategic Architect: PULSE, burn efficiency, PIXEL MARKET signals, canvas evolution, and (when live) gacha/raffle EV. Free web chat; paid A2A services listed below."
      : "Zulo is the Normies Strategic Architect: PULSE, record cards, burn efficiency, PIXEL MARKET signals and canvas evolution. Every service is free. Zulo takes no payments.",
    freeAccess: {
      path: "/ask",
      description: offered
        ? "Web chat at /ask is free for holders and visitors."
        : "Everything is free: web chat at /ask, POST /api/zulo/ask and /api/zulo/paths. No payment, no wallet transfer.",
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
    ...(offered ? { payment: {
      status: "live" as const,
      // Settlement default remains AP (backward compatible)
      currency: "AP",
      currencies: getManifestCurrencies(),
      default: getDefaultCurrency(),
      fallback: getFallbackCurrency(),
      conversionOracle: getConversionOracleStatus(),
      pixelCurrencyStatus: getPixelCurrencyStatus(),
      receiverWallet: receiver.address,
      receiverMode: mode,
      receiverNormieTokenId: ZULO_IDENTITY.tokenId,
      tipAssetPriority: tipAssetPriorityIds(),
      verification: {
        module: "lib/agent-recommendations/verifyPayment.ts",
        enforced: false,
        methods: [
          "txHash-scaffold",
          "marketplace-receipt-planned",
          "payment-receiver-adapter",
        ],
      },
      notes: [
        "Prices: PULSE analysis 1 AP, strategy/sentinel/burn scans 2 AP (see services).",
        "Holder web chat remains free until product policy changes.",
        "Payment verification is scaffolded in /api/zulo/ask but not enforced yet.",
        "Canvas AP is per-Normie; not eth_getBalance and not TBA inventory.",
        `EVM tip receiver mode: ${mode} → ${receiver.address} (${receiver.label}).`,
        "Tip asset priority: canvas-ap → x402-usdc → eth-mainnet → eth-base (Wire Network later).",
        "Migration: hot wallet default; eventually #7141 TBA via ZULO_PAYMENT_RECEIVER=tba.",
        "AP live verify blocked until Normies official A2A docs.",
        "Pixel currency scaffolding: payment.currencies lists AP+PIXEL; pixelCurrencyStatus is scaffolded/disabled — not enforced until PIXEL_CURRENCY_ENABLED + official docs. See GET /api/zulo/currencies.",
      ],
      howToPayWhenLive: [
        "1. Discover Zulo via GET /api/zulo/manifest (this document).",
        "2. Choose a paid service id (pulse-analysis | strategy | urgent | burn-efficiency | market-sentinel | canvas-preview).",
        "3. Transfer the listed AP amount via Normies A2A path when published (or EVM tip to payment.receiverWallet for multi-asset rails).",
        "4. Call POST /api/zulo/ask with service, userQuery, and txHash (or marketplace receipt).",
        "5. Zulo verifies payment then returns the recommendation JSON.",
        "Until status is \"live\", skip payment and use free /ask or /api/zulo/ask without txHash.",
      ],
    } } : {}),
    health: `${base}/api/zulo/health`,
  }
}

/** Sync-safe fallback when only hot wallet is needed (no TBA resolve). */
export function getManifestSyncHotWallet(): ZuloManifest {
  // Used only if a caller cannot await; prefer getManifest().
  const base = siteBase()
  return {
    agent: {
      id: ZULO_IDENTITY.agentId,
      name: ZULO_IDENTITY.name,
      ens: ZULO_IDENTITY.ens,
      wallet: ZULO_IDENTITY.hotWallet,
      type: "ERC-8004",
    },
    role: "strategic-architect",
    services: [],
    acceptedCurrencies: getAcceptedCurrencies(),
    version: "1.5.0-sync",
    endpoint: base,
    ...(paymentsOffered() ? { payment: {
      status: "live" as const,
      currency: "AP",
      currencies: getManifestCurrencies(),
      default: getDefaultCurrency(),
      fallback: getFallbackCurrency(),
      conversionOracle: getConversionOracleStatus(),
      pixelCurrencyStatus: getPixelCurrencyStatus(),
      receiverWallet: ZULO_IDENTITY.hotWallet,
      receiverMode: "hot-wallet",
      receiverNormieTokenId: ZULO_IDENTITY.tokenId,
      tipAssetPriority: tipAssetPriorityIds(),
      notes: ["Sync fallback — use async getManifest() for TBA-aware receiver."],
      howToPayWhenLive: [],
    } } : {}),
  }
}

/** @deprecated Prefer await getManifest() — kept for import compatibility. */
export const ZULO_MANIFEST: ZuloManifest = getManifestSyncHotWallet()
