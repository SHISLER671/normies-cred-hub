import type { AgentPulseResponse } from "@/lib/api/agent-pulse"
import {
  derivePulseGaps,
  scoreToolForAgent,
  type ZuloToolContext,
} from "@/lib/erc8257/context"
import type { RegistryTool } from "@/lib/erc8257/types"
import { tools, type Tool } from "@/lib/tools"

export type ZuloRecommendationSource = "normies" | "agent-tools"

export type ZuloRecommendation = {
  name: string
  reason: string
  pulseRationale: string
  category: string
  url: string
  source: ZuloRecommendationSource
  toolId?: number
  chain?: string
  accessNote?: string
}

export type ZuloPulseContext = {
  level: number
  maxLevel: number
  status: string
  breakdown: string[]
  gaps: string[]
}

export type ZuloRecommendsPayload = {
  summary: string
  pulseContext?: ZuloPulseContext
  recommendations: ZuloRecommendation[]
}

type ToolCatalogEntry = {
  name: string
  source: ZuloRecommendationSource
  category: string
  url: string
  toolId?: number
  chain?: string
  accessNote?: string
  description?: string
}

/** Maps pulse gap labels to Normies ecosystem tools that help close them. */
const GAP_TO_NORMIES_TOOLS: Record<string, string[]> = {
  "ERC-8004 registered": ["Normies Lab", "Agentic", "Ethos Reputation"],
  "Has active agent card": ["Normies Lab", "Agentic", "Normies API"],
  "Canvas activity detected": ["Normies Canvas", "Normifier", "Normies Arena"],
  "Clean ownership & delegation": ["Normies Nexus", "Normies API"],
}

function normiesToolAddressesGaps(toolName: string, gaps: string[]): string[] {
  return gaps.filter((gap) => GAP_TO_NORMIES_TOOLS[gap]?.includes(toolName))
}

export function scoreNormiesToolForAgent(tool: Tool, ctx?: ZuloToolContext): number {
  let score = 0
  const category = tool.category.toLowerCase()
  const gaps = ctx?.pulseGaps ?? []

  if (category === "identity") score += 8
  if (category === "reputation") score += 6
  if (category === "canvas") score += 5

  const addressed = normiesToolAddressesGaps(tool.name, gaps)
  score += addressed.length * 20

  const pulse = ctx?.pulseLevel ?? 0
  if (pulse <= 2) {
    if (category === "identity" || category === "reputation") score += 15
  }
  if (pulse >= 4) {
    if (category === "canvas" || category === "generator" || category === "utility") score += 12
  }

  if ((ctx?.canvasLevel ?? 0) === 0 && (ctx?.actionPoints ?? 0) > 0) {
    if (category === "canvas") score += 14
  }

  if (ctx?.agentType?.toLowerCase() === "agent") {
    if (category === "identity" || category === "development") score += 8
  }

  if (ctx?.ethosScore != null && ctx.ethosScore < 1200 && category === "reputation") {
    score += 10
  }

  return score
}

export function rankNormiesTools(ctx?: ZuloToolContext, limit = 12): Tool[] {
  return [...tools]
    .sort((a, b) => scoreNormiesToolForAgent(b, ctx) - scoreNormiesToolForAgent(a, ctx))
    .slice(0, limit)
}

export function rankRegistryTools(
  registryTools: RegistryTool[],
  ctx?: ZuloToolContext,
  limit = 12,
): RegistryTool[] {
  return [...registryTools]
    .sort((a, b) => scoreToolForAgent(b, ctx) - scoreToolForAgent(a, ctx))
    .slice(0, limit)
}

export function buildToolCatalog(
  normiesList: Tool[],
  registryTools: RegistryTool[],
): Map<string, ToolCatalogEntry> {
  const catalog = new Map<string, ToolCatalogEntry>()

  for (const tool of normiesList) {
    catalog.set(tool.name.toLowerCase(), {
      name: tool.name,
      source: "normies",
      category: tool.category,
      url: tool.url,
      description: tool.description,
    })
  }

  for (const tool of registryTools) {
    catalog.set(tool.name.toLowerCase(), {
      name: tool.name,
      source: "agent-tools",
      category: "Agent Tools",
      url: tool.endpoint || tool.openseaUrl,
      toolId: tool.toolId,
      chain: tool.chain,
      accessNote: tool.access.accessNote,
      description: tool.description,
    })
  }

  return catalog
}

export function buildPulseContext(
  pulse: AgentPulseResponse | null | undefined,
): ZuloPulseContext | undefined {
  if (!pulse) return undefined

  return {
    level: pulse.pulse_level,
    maxLevel: pulse.max_level,
    status: pulse.status,
    breakdown: pulse.breakdown,
    gaps: derivePulseGaps(pulse.breakdown),
  }
}

export function buildRecommendationBrief(
  ctx: ZuloToolContext,
  pulse: AgentPulseResponse | null | undefined,
  rankedNormies: Tool[],
  rankedRegistry: RegistryTool[],
): string {
  const lines: string[] = ["=== RECOMMENDATION BRIEF (reason from this before picking tools) ==="]

  if (pulse) {
    lines.push(buildPulseSummaryLine(pulse))
    const gaps = derivePulseGaps(pulse.breakdown)
    if (gaps.length) {
      lines.push(`Pulse gaps to address: ${gaps.join(", ")}`)
    } else {
      lines.push("Pulse gaps: none — agent has all four current signals.")
    }
  } else {
    lines.push("Pulse: unavailable — lean on traits, canvas, and awakening status.")
  }

  if (ctx.pulseLevel != null && ctx.pulseLevel <= 2) {
    lines.push("Strategy: low pulse — prioritize identity, reputation, and trust-building tools.")
  } else if (ctx.pulseLevel != null && ctx.pulseLevel >= 4) {
    lines.push("Strategy: strong pulse — creative, canvas, and ecosystem utilities are fair game.")
  }

  lines.push("")
  lines.push("Pre-ranked shortlist (strongest pulse/context fit — you may still pick from full lists):")

  for (const tool of rankedNormies.slice(0, 6)) {
    const gaps = normiesToolAddressesGaps(tool.name, ctx.pulseGaps ?? [])
    const gapNote = gaps.length ? ` → closes: ${gaps.join(", ")}` : ""
    lines.push(`[normies] ${tool.name}${gapNote}`)
  }

  for (const tool of rankedRegistry.slice(0, 6)) {
    const access =
      tool.access.accessGranted === true
        ? "holder can use"
        : tool.access.accessGranted === false
          ? "gated"
          : "access unchecked"
    lines.push(`[agent-tools] ${tool.name} (Tool #${tool.toolId}, ${access})`)
  }

  return lines.join("\n")
}

function buildPulseSummaryLine(pulse: AgentPulseResponse): string {
  const breakdown =
    pulse.breakdown.length > 0 ? pulse.breakdown.join(", ") : "no signals yet"
  return `Pulse: ${pulse.pulse_level}/${pulse.max_level} (${pulse.status}) — ${breakdown}`
}

export function buildShortlistForPrompt(
  rankedNormies: Tool[],
  rankedRegistry: RegistryTool[],
): string {
  const normiesLines = rankedNormies
    .slice(0, 8)
    .map((t) => `- ${t.name} (${t.category})`)
    .join("\n")

  const registryLines = rankedRegistry
    .slice(0, 8)
    .map(
      (t) =>
        `- ${t.name} (Tool #${t.toolId} on ${t.chain})${
          t.access.accessGranted === true ? " — holder can use" : ""
        }`,
    )
    .join("\n")

  return `
Pre-ranked Normies shortlist:
${normiesLines || "(none)"}

Pre-ranked Agent Tools shortlist:
${registryLines || "(none)"}
`.trim()
}

type RawZuloRecommendation = {
  name?: string
  source?: string
  reason?: string
  pulseRationale?: string
}

type RawZuloResponse = {
  summary?: string
  recommendations?: RawZuloRecommendation[]
}

export function extractJsonPayload(text: string): RawZuloResponse | null {
  const trimmed = text.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = (fenced?.[1] ?? trimmed).trim()

  try {
    const parsed = JSON.parse(candidate) as RawZuloResponse
    if (parsed && typeof parsed === "object" && Array.isArray(parsed.recommendations)) {
      return parsed
    }
  } catch {
    // fall through to markdown parser
  }

  return null
}

/** Fallback when the model returns markdown instead of JSON. */
export function parseMarkdownRecommendations(
  text: string,
  catalog: Map<string, ToolCatalogEntry>,
): ZuloRecommendation[] {
  const recs: ZuloRecommendation[] = []
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean)
  let current: { name: string; reason: string } | null = null

  const flush = () => {
    if (!current?.name) return
    const enriched = enrichSingleRecommendation(current, catalog)
    if (enriched) recs.push(enriched)
  }

  for (const line of lines) {
    if (line.startsWith("**") && line.endsWith("**")) {
      flush()
      current = { name: line.replace(/\*\*/g, "").trim(), reason: "" }
    } else if (current) {
      current.reason = `${current.reason} ${line}`.trim()
    }
  }

  flush()
  return dedupeRecommendations(recs)
}

function enrichSingleRecommendation(
  raw: { name: string; reason: string; pulseRationale?: string; source?: string },
  catalog: Map<string, ToolCatalogEntry>,
): ZuloRecommendation | null {
  const entry = resolveCatalogEntry(raw.name, catalog)
  if (!entry) return null

  const source: ZuloRecommendationSource =
    raw.source === "agent-tools" || entry.source === "agent-tools"
      ? "agent-tools"
      : "normies"

  return {
    name: entry.name,
    reason: raw.reason.trim(),
    pulseRationale: raw.pulseRationale?.trim() || "",
    category: entry.category,
    url: entry.url,
    source,
    toolId: entry.toolId,
    chain: entry.chain,
    accessNote: entry.accessNote,
  }
}

function resolveCatalogEntry(
  name: string,
  catalog: Map<string, ToolCatalogEntry>,
): ToolCatalogEntry | null {
  const exact = catalog.get(name.toLowerCase().trim())
  if (exact) return exact

  const nameLower = name.toLowerCase().trim()
  const recWords = nameLower.split(/\s+/).filter((w) => w.length > 2)

  let best: { entry: ToolCatalogEntry; score: number } | null = null
  for (const entry of catalog.values()) {
    const tLower = entry.name.toLowerCase()
    const overlap = recWords.filter((w) => tLower.includes(w)).length
    const mutual = tLower.includes(nameLower) || nameLower.includes(tLower) ? 5 : 0
    const score = overlap + mutual
    if (score >= 2 && (!best || score > best.score)) {
      best = { entry, score }
    }
  }

  return best?.entry ?? null
}

export function enrichRecommendationsFromCatalog(
  raw: RawZuloResponse,
  catalog: Map<string, ToolCatalogEntry>,
): ZuloRecommendation[] {
  const items = (raw.recommendations ?? [])
    .map((item) => {
      if (!item.name?.trim()) return null
      return enrichSingleRecommendation(
        {
          name: item.name.trim(),
          reason: item.reason?.trim() || "",
          pulseRationale: item.pulseRationale?.trim(),
          source: item.source,
        },
        catalog,
      )
    })
    .filter((item): item is ZuloRecommendation => item != null)

  return dedupeRecommendations(items)
}

function dedupeRecommendations(items: ZuloRecommendation[]): ZuloRecommendation[] {
  const seen = new Set<string>()
  const unique: ZuloRecommendation[] = []

  for (const item of items) {
    const key = item.name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(item)
  }

  return unique.slice(0, 3)
}

export function parseZuloRecommendations(
  text: string,
  catalog: Map<string, ToolCatalogEntry>,
): { summary: string; recommendations: ZuloRecommendation[] } {
  const json = extractJsonPayload(text)
  if (json) {
    return {
      summary: json.summary?.trim() || "",
      recommendations: enrichRecommendationsFromCatalog(json, catalog),
    }
  }

  return {
    summary: "",
    recommendations: parseMarkdownRecommendations(text, catalog),
  }
}