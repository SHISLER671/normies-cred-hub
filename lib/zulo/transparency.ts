import type { ZuloPulseContext, ZuloRecommendation } from "@/lib/zulo/recommendations"

export type ZuloFlowStepStatus = "ok" | "skipped" | "unavailable"

export type ZuloFlowStep = {
  id: string
  label: string
  detail: string
  status: ZuloFlowStepStatus
}

export type ZuloTransparency = {
  steps: ZuloFlowStep[]
  generatedAt: string
  cached: boolean
  pulseEndpoint: string
  registryToolsConsidered: number
  normiesShortlist: string[]
  agentToolsShortlist: string[]
}

export function buildZuloTransparency(input: {
  tokenId: number
  pulseAvailable: boolean
  pulseContext?: ZuloPulseContext
  registryToolsConsidered: number
  normiesShortlist: string[]
  agentToolsShortlist: string[]
  cached: boolean
  generatedAt?: string
}): ZuloTransparency {
  const pulseDetail = input.pulseContext
    ? `Level ${input.pulseContext.level}/${input.pulseContext.maxLevel} (${input.pulseContext.status})${
        input.pulseContext.gaps.length
          ? ` — gaps: ${input.pulseContext.gaps.join(", ")}`
          : " — all four signals present"
      }`
    : "Pulse endpoint unreachable"

  const steps: ZuloFlowStep[] = [
    {
      id: "pulse",
      label: "1. Read Pulse",
      detail: input.pulseAvailable
        ? pulseDetail
        : "Normies Cred Pulse (Tool #53) could not be reached",
      status: input.pulseAvailable ? "ok" : "unavailable",
    },
    {
      id: "registry",
      label: "2. Discover Agent Tools",
      detail:
        input.registryToolsConsidered > 0
          ? `${input.registryToolsConsidered} ERC-8257 tools loaded from registry cache`
          : "Registry discovery unavailable — Normies ecosystem tools only",
      status: input.registryToolsConsidered > 0 ? "ok" : "unavailable",
    },
    {
      id: "rank",
      label: "3. Rank by context",
      detail: `Normies shortlist: ${input.normiesShortlist.slice(0, 3).join(", ") || "n/a"}${
        input.agentToolsShortlist.length
          ? ` · Agent Tools shortlist: ${input.agentToolsShortlist.slice(0, 3).join(", ")}`
          : ""
      }`,
      status: "ok",
    },
    {
      id: "reason",
      label: "4. Zulo reasons",
      detail: input.cached
        ? "Returned from cache — same Pulse + wallet context within TTL"
        : "Venice AI analyzed Pulse gaps, traits, and ranked shortlists",
      status: "ok",
    },
  ]

  return {
    steps,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    cached: input.cached,
    pulseEndpoint: `/api/agent/${input.tokenId}/pulse`,
    registryToolsConsidered: input.registryToolsConsidered,
    normiesShortlist: input.normiesShortlist,
    agentToolsShortlist: input.agentToolsShortlist,
  }
}

export type ZuloRecommendsApiResponse = {
  summary: string
  pulseContext?: ZuloPulseContext
  recommendations: ZuloRecommendation[]
  transparency: ZuloTransparency
}