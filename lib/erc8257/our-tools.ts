// Canonical ERC-8257 coordinates for CredHub's own tools.
// UI, README, and agents should read IDs from here — not scattered copy.

export const ERC8257_REGISTRY_ADDRESS =
  "0x265BB2DBFC0A8165C9A1941Eb1372F349baD2cf1" as const

export type AgentToolChain = "ethereum" | "base" | "abstract" | "robinhood"

export type AgentToolAccess = "nft-gated" | "open"

export type AgentToolListing = {
  chain: AgentToolChain
  chainId: number
  label: string
  toolId: number
  access: AgentToolAccess
  openseaUrl?: string
  explorerUrl?: string
}

export type OurAgentTool = {
  name: string
  slug: string
  manifestPath: string
  manifestUrl: string
  endpoint: string
  listings: readonly AgentToolListing[]
}

const OPENSEA_TOOL = (chain: string, id: number) =>
  `https://opensea.io/tools/erc8257/${chain}/${id}`

export const NORMIES_CRED_PULSE: OurAgentTool = {
  name: "Normies Cred Pulse",
  slug: "normies-cred-pulse",
  manifestPath: "/.well-known/ai-tool/normies-cred-pulse.json",
  manifestUrl:
    "https://normiescredhub.vercel.app/.well-known/ai-tool/normies-cred-pulse.json",
  endpoint: "https://normiescredhub.vercel.app/api/agent",
  listings: [
    {
      chain: "ethereum",
      chainId: 1,
      label: "Ethereum",
      toolId: 53,
      access: "nft-gated",
      openseaUrl: OPENSEA_TOOL("ethereum", 53),
    },
    {
      chain: "base",
      chainId: 8453,
      label: "Base",
      toolId: 531,
      access: "open",
      openseaUrl: OPENSEA_TOOL("base", 531),
    },
    {
      chain: "abstract",
      chainId: 2741,
      label: "Abstract",
      toolId: 1,
      access: "open",
      openseaUrl: OPENSEA_TOOL("abstract", 1),
    },
    {
      chain: "robinhood",
      chainId: 4663,
      label: "Robinhood",
      toolId: 15,
      access: "open",
      explorerUrl:
        "https://robinhoodchain.blockscout.com/tx/0x22cffdfa81b09a939ca6147622627e8c7a9f5c89adaf4cf020dde3ee02a61bf1",
    },
  ],
}

export const NORMIES_PATHS: OurAgentTool = {
  name: "Normies Paths",
  slug: "normies-paths",
  manifestPath: "/.well-known/ai-tool/normies-paths.json",
  manifestUrl:
    "https://normiescredhub.vercel.app/.well-known/ai-tool/normies-paths.json",
  endpoint: "https://normiescredhub.vercel.app/api/zulo/paths",
  listings: [
    {
      chain: "ethereum",
      chainId: 1,
      label: "Ethereum",
      toolId: 215,
      access: "nft-gated",
      openseaUrl: OPENSEA_TOOL("ethereum", 215),
    },
    {
      chain: "base",
      chainId: 8453,
      label: "Base",
      toolId: 530,
      access: "open",
      openseaUrl: OPENSEA_TOOL("base", 530),
    },
    {
      chain: "abstract",
      chainId: 2741,
      label: "Abstract",
      toolId: 2,
      access: "open",
      openseaUrl: OPENSEA_TOOL("abstract", 2),
    },
    {
      chain: "robinhood",
      chainId: 4663,
      label: "Robinhood",
      toolId: 14,
      access: "open",
      explorerUrl:
        "https://robinhoodchain.blockscout.com/tx/0xba44bcbea0f91f05179455bd6080f5ea2ec4164c99d4088ec0933b04301e3e14",
    },
  ],
}

export const OUR_AGENT_TOOLS = [NORMIES_CRED_PULSE, NORMIES_PATHS] as const

export function ethereumListing(tool: OurAgentTool): AgentToolListing {
  const found = tool.listings.find((l) => l.chain === "ethereum")
  if (!found) throw new Error(`No Ethereum listing for ${tool.slug}`)
  return found
}

function listingClause(listing: AgentToolListing): string {
  const gate = listing.access === "nft-gated" ? "Normie NFT gated" : "open"
  return `${listing.label} Tool #${listing.toolId} (${gate})`
}

/** Durable bible text for Ask — IDs come from this file so they cannot drift from the UI. */
export function formatAgentToolsKnowledge(): string {
  const pulseEth = ethereumListing(NORMIES_CRED_PULSE)
  const pathsEth = ethereumListing(NORMIES_PATHS)
  const pulseRest = NORMIES_CRED_PULSE.listings
    .filter((l) => l.chain !== "ethereum")
    .map(listingClause)
    .join("; ")
  const pathsRest = NORMIES_PATHS.listings
    .filter((l) => l.chain !== "ethereum")
    .map(listingClause)
    .join("; ")

  return `## Normies agent tools (ERC-8257)

Two official tools power trust-then-act for Normie agents:

1. **${NORMIES_CRED_PULSE.name}** (${listingClause(pulseEth)} — canonical)
   Other listings: ${pulseRest || "none"}
   - Returns on-chain reputation / trust signals for any Normie (token ID 0–9999).
   - Call this first. Endpoint: POST ${NORMIES_CRED_PULSE.endpoint} (also GET /api/agent/{tokenId}/pulse).
   - Manifest: ${NORMIES_CRED_PULSE.manifestPath}

2. **${NORMIES_PATHS.name}** (${listingClause(pathsEth)} — canonical)
   Other listings: ${pathsRest || "none"}
   - Returns 3–5 Pulse-weighted ranked paths for a given intent + subject tokenId.
   - Call this after Pulse. Agents choose a path, then execute the concrete next step (the move).
   - Manifest: ${NORMIES_PATHS.manifestPath}

Both are gated to Normie NFT holders on Ethereum and built for autonomous agent-to-agent / NFT-to-NFT decision making. Other listed chains are open discovery copies of the same HTTPS endpoints (Normies ERC-721 is Ethereum-only).

Zulo’s own recommendations follow the same pattern: surface the subject’s Pulse, then rank paths / advice conditioned on it.

Never invent tool IDs. Prefer the official names “${NORMIES_CRED_PULSE.name}” and “${NORMIES_PATHS.name}”. Ethereum IDs are canonical.`
}
