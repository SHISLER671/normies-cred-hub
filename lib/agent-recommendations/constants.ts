// lib/agent-recommendations/constants.ts
// Zulo identity baselines + ecosystem links for the recommendations plugin.

import { ethereumListing, NORMIES_CRED_PULSE } from "@/lib/erc8257/our-tools"

/** Featured proof-of-concept agent: Normie #7141 → Zulo → ERC-8004 agentId 32626. */
export const ZULO_IDENTITY = {
  tokenId: 7141,
  agentId: 32626,
  name: "Zulo",
  hotWallet: "0xb8792E6516b88e73eD0723F8C1C8a92531A98767",
  ens: "32626.eth",
  delegatedTo: "0xFafd8Fb6b4E43ACE0E365553f1b9242384591031",
  chainId: 1,
} as const

export const ZULO_RECOMMENDATIONS_DYOR =
  "Informational only — not financial, legal, or security advice. DYOR before any on-chain action. Zulo never asks for keys, signatures, or approvals."

export const MAX_SESSION_HISTORY = 5
export const MAX_USER_QUERY_CHARS = 1000

/** Normies Cred Pulse — ERC-8257 Ethereum Tool #53 on this app. */
const pulseEth = ethereumListing(NORMIES_CRED_PULSE)

export const CRED_HUB_PULSE = {
  toolId: pulseEth.toolId,
  pathTemplate: "/api/agent/{tokenId}/pulse",
  openSeaToolsUrl:
    pulseEth.openseaUrl ?? "https://opensea.io/tools/erc8257/ethereum/53",
} as const

/**
 * A2A service prices in Canvas Action Points (low-fee launch table).
 * holder-chat remains free for the web UI.
 */
export const ZULO_SERVICE_PRICES: Record<string, number> = {
  "pulse-analysis": 1,
  strategy: 2,
  urgent: 2,
  "holder-chat": 0,
}

/** Official + community surfaces Zulo may cite. */
export const ECOSYSTEM_LINKS = {
  main: "https://www.normies.art/",
  lab: "https://www.normies.art/lab",
  canvas: "https://www.normies.art/lab/canvas",
  canvasEdit: (tokenId: number) =>
    `https://www.normies.art/lab/canvas/edit/${tokenId}`,
  agentic: "https://www.normies.art/lab/agentic",
  docsNormies: "https://www.normies.art/docs/normies",
  docsAgentic: "https://www.normies.art/docs/agentic",
  docsTechnical: "https://www.normies.art/docs/technical",
  api: "https://api.normies.art/",
  rarity: "https://rarity.normies.art/",
  rarityApi: "https://rarity.normies.art/api",
  multisend: "https://multisend.normies.art/",
  normifier: "https://normifier.vercel.app/",
  opensea: "https://opensea.io/collection/normies",
  credHubPulseTool: "https://opensea.io/tools/erc8257/ethereum/53",
} as const

export const DEFAULT_RESOURCE_LINKS = [
  ECOSYSTEM_LINKS.lab,
  ECOSYSTEM_LINKS.canvas,
  ECOSYSTEM_LINKS.rarity,
  ECOSYSTEM_LINKS.multisend,
  ECOSYSTEM_LINKS.normifier,
  ECOSYSTEM_LINKS.docsNormies,
  ECOSYSTEM_LINKS.docsAgentic,
  ECOSYSTEM_LINKS.credHubPulseTool,
] as const
