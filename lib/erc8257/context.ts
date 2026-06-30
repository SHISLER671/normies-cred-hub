import type { AgentPulseResponse } from "@/lib/api/agent-pulse"
import type { RegistryTool } from "@/lib/erc8257/types"
import type { HorizonAgentContext } from "@/lib/zulo-horizon"

/** Agent context used to rank ERC-8257 tools for Zulo. */
export type ZuloToolContext = {
  tokenId: number
  agentType?: string
  isAwakened: boolean
  pulseLevel?: number
  pulseStatus?: string
  canvasLevel?: number
  actionPoints?: number
  ethosScore?: number
}

export function buildPulseSummary(pulse: AgentPulseResponse): string {
  const breakdown =
    pulse.breakdown.length > 0 ? pulse.breakdown.join(", ") : "no signals yet"
  return `Pulse ${pulse.pulse_level}/${pulse.max_level} (${pulse.status}) — ${breakdown}`
}

export function horizonAgentToToolContext(
  agent: HorizonAgentContext | null | undefined,
): ZuloToolContext | undefined {
  if (!agent) return undefined
  return {
    tokenId: agent.tokenId,
    agentType: agent.type,
    isAwakened: agent.isAwakened,
    pulseLevel: agent.pulseLevel,
    pulseStatus: agent.pulseStatus,
    canvasLevel: agent.canvasLevel,
    actionPoints: agent.actionPoints,
    ethosScore: agent.ethosScore,
  }
}

export function buildZuloToolContext(input: {
  tokenId: number
  agentType?: string
  isAwakened: boolean
  pulse?: AgentPulseResponse | null
  canvasLevel?: number
  actionPoints?: number
  ethosScore?: number
}): ZuloToolContext {
  return {
    tokenId: input.tokenId,
    agentType: input.agentType,
    isAwakened: input.isAwakened,
    pulseLevel: input.pulse?.pulse_level,
    pulseStatus: input.pulse?.status,
    canvasLevel: input.canvasLevel,
    actionPoints: input.actionPoints,
    ethosScore: input.ethosScore,
  }
}

const PRIORITY_TAGS = new Set([
  "normies",
  "reputation",
  "trust",
  "erc8004",
  "agent",
  "security",
  "ai",
])

const REPUTATION_TAGS = new Set([
  "reputation",
  "trust",
  "erc8004",
  "security",
  "agent",
])

const CANVAS_TAGS = new Set(["canvas", "image", "generator", "nft"])

/** Pulse- and trait-aware score boost on top of base tool priority. */
export function scoreToolForAgent(tool: RegistryTool, ctx?: ZuloToolContext): number {
  let score = 0
  const tags = tool.tags.map((t) => t.toLowerCase())
  const note = tool.access.accessNote.toLowerCase()
  const type = (ctx?.agentType ?? "").toLowerCase()

  for (const tag of tags) {
    if (PRIORITY_TAGS.has(tag)) score += 10
    if (REPUTATION_TAGS.has(tag)) score += 4
    if (CANVAS_TAGS.has(tag)) score += 3
  }

  if (note.includes("normie")) score += 15
  if (!tool.access.openAccess) score += 3
  if (tool.manifestVerified) score += 2
  score += tool.toolId / 1000

  if (!ctx) return score

  const pulse = ctx.pulseLevel ?? 0

  if (pulse <= 2) {
    for (const tag of tags) {
      if (REPUTATION_TAGS.has(tag)) score += 18
    }
    if (note.includes("trust") || note.includes("reputation")) score += 12
    if (!ctx.isAwakened) score += tags.includes("identity") ? 15 : 0
  }

  if (pulse >= 4) {
    for (const tag of tags) {
      if (CANVAS_TAGS.has(tag)) score += 8
    }
  }

  if (type === "agent") {
    if (tags.includes("agent") || tags.includes("erc8004")) score += 12
  }

  if ((ctx.canvasLevel ?? 0) === 0 && (ctx.actionPoints ?? 0) > 0) {
    if (tags.includes("canvas")) score += 10
  }

  if (ctx.ethosScore != null && ctx.ethosScore < 1200) {
    for (const tag of tags) {
      if (REPUTATION_TAGS.has(tag)) score += 8
    }
  }

  return score
}

export function selectToolsForAgent(
  tools: RegistryTool[],
  ctx?: ZuloToolContext,
  limit = 60,
): RegistryTool[] {
  return [...tools]
    .sort((a, b) => scoreToolForAgent(b, ctx) - scoreToolForAgent(a, ctx))
    .slice(0, limit)
}

export function buildAgentRecommendationHints(ctx: ZuloToolContext): string {
  const hints: string[] = []

  if (!ctx.isAwakened) {
    hints.push(
      "This agent is not awakened yet — prioritize identity/awakening and reputation-building tools.",
    )
  }

  if (ctx.pulseLevel != null && ctx.pulseLevel <= 2) {
    hints.push(
      `Low pulse (${ctx.pulseStatus ?? "early"}) — favor trust, reputation, and ERC-8004 tools over advanced utilities.`,
    )
  }

  if (ctx.pulseLevel != null && ctx.pulseLevel >= 4) {
    hints.push(
      "Strong pulse — canvas, creative, and ecosystem utility tools are reasonable fits.",
    )
  }

  if (ctx.agentType?.toLowerCase() === "agent") {
    hints.push("Agent-type Normie — ERC-8257 agentic endpoints are especially relevant.")
  }

  return hints.length ? hints.join("\n") : "No special ranking hints — use best judgment from agent data."
}