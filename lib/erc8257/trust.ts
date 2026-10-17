// Trust tiers for ERC-8257 registry tools shown as Moves / Paths.
//
// The ERC-8257 registry is permissionless: anyone can register a tool with any name, description, tags and endpoint. A tool's
// manifest hash matching on chain proves only that the manifest was not altered after registration, NOT that the tool is safe.
// So a registry tool is only ever "executable" (an agent is invited to call its endpoint) when it is on this allowlist, its
// manifest verified, and the endpoint it serves is exactly the endpoint we reviewed. Everything else is labelled
// third-party / unvetted and offered as a link to its public listing, never as a callable endpoint.

import type { Erc8257Chain, RegistryTool } from "./types"
import { OUR_AGENT_TOOLS, type AgentToolChain } from "./our-tools"

export type ToolTrust = "official" | "reviewed" | "unvetted"

export type ReviewedTool = {
  chain: Erc8257Chain
  toolId: number
  /** Exact endpoint that was reviewed. A manifest that now points anywhere else is treated as unvetted. */
  endpoint: string
  trust: Exclude<ToolTrust, "unvetted">
  name: string
}

const REGISTRY_CHAIN: Partial<Record<AgentToolChain, Erc8257Chain>> = {
  ethereum: "mainnet",
  base: "base",
}

/** CredHub's own registered tools, derived from our-tools.ts so the IDs cannot drift. */
export const OFFICIAL_REGISTRY_TOOLS: readonly ReviewedTool[] = OUR_AGENT_TOOLS.flatMap((tool) =>
  tool.listings.flatMap((l) => {
    const chain = REGISTRY_CHAIN[l.chain]
    return chain ? [{ chain, toolId: l.toolId, endpoint: tool.endpoint, trust: "official" as const, name: tool.name }] : []
  }),
)

/**
 * Third-party tools that a human (Ryan) has reviewed. Empty on purpose: add an entry only after reviewing the tool's
 * manifest, endpoint and publisher, and pin the exact endpoint.
 */
export const REVIEWED_THIRD_PARTY_TOOLS: readonly ReviewedTool[] = []

const ALLOWLIST: readonly ReviewedTool[] = [...OFFICIAL_REGISTRY_TOOLS, ...REVIEWED_THIRD_PARTY_TOOLS]

export function findReviewedTool(chain: Erc8257Chain, toolId: number): ReviewedTool | null {
  return ALLOWLIST.find((t) => t.chain === chain && t.toolId === toolId) ?? null
}

function normalizeEndpoint(raw: string): string | null {
  try {
    const u = new URL(raw.trim())
    if (u.protocol !== "https:") return null
    return `${u.origin}${u.pathname.replace(/\/+$/, "")}`
  } catch {
    return null
  }
}

/** Only https URLs survive; anything else (javascript:, data:, http:, junk) becomes null. */
export function safeHttpsUrl(raw: string | null | undefined): string | null {
  if (!raw) return null
  try {
    const u = new URL(raw.trim())
    return u.protocol === "https:" ? u.toString() : null
  } catch {
    return null
  }
}

export type ToolTrustDecision = {
  trust: ToolTrust
  executable: boolean
  /** Why it is (not) executable, for the card note. */
  reason: string
  reviewed: ReviewedTool | null
}

export function classifyRegistryTool(tool: Pick<RegistryTool, "chain" | "toolId" | "endpoint" | "manifestVerified">): ToolTrustDecision {
  const reviewed = findReviewedTool(tool.chain, tool.toolId)
  if (!reviewed) {
    return { trust: "unvetted", executable: false, reason: "Third-party tool, not reviewed by CredHub", reviewed: null }
  }
  if (!tool.manifestVerified) {
    return { trust: "unvetted", executable: false, reason: "Manifest hash does not match the on-chain hash", reviewed }
  }
  const served = tool.endpoint ? normalizeEndpoint(tool.endpoint) : null
  if (!served || served !== normalizeEndpoint(reviewed.endpoint)) {
    return { trust: "unvetted", executable: false, reason: "Endpoint differs from the reviewed endpoint", reviewed }
  }
  return {
    trust: reviewed.trust,
    executable: true,
    reason: reviewed.trust === "official" ? "Official CredHub tool" : "Reviewed third-party tool",
    reviewed,
  }
}

export function trustLabel(trust: ToolTrust): string {
  return trust === "official" ? "Official · CredHub" : trust === "reviewed" ? "Reviewed third-party" : "Third-party · unvetted"
}
