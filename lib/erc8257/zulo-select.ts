import { enrichToolsWithWalletAccess } from "@/lib/erc8257/access-check"
import { getCachedRegistryTools } from "@/lib/erc8257/cache"
import {
  scoreToolForAgent,
  type ZuloToolContext,
} from "@/lib/erc8257/context"
import type { RegistryTool } from "@/lib/erc8257/types"

/** Tags that mark tools surfaced in the Normies Agent Tools registry tab. */
export const NORMIES_REGISTRY_TAGS = [
  "normies",
  "reputation",
  "trust",
  "erc8004",
  "agent",
] as const

export const ZULO_RECOMMENDS_REGISTRY_LIMIT = 60
export const ZULO_HORIZON_REGISTRY_LIMIT = 25
export const ZULO_HORIZON_PREVIEW_LIMIT = 3

function toolKey(tool: RegistryTool): string {
  return `${tool.chain}:${tool.toolId}`
}

/** Tools featured in the ERC-8257 Agent Tools tab (Normies ecosystem focus). */
export function isNormiesRegistryTool(tool: RegistryTool): boolean {
  const tags = tool.tags.map((t) => t.toLowerCase())
  const note = tool.access.accessNote.toLowerCase()
  return (
    NORMIES_REGISTRY_TAGS.some((tag) => tags.includes(tag)) || note.includes("normie")
  )
}

/**
 * Merge Normies-priority registry tools with context-ranked picks from the
 * broader ERC-8257 catalog — deduped and capped for prompt size.
 */
export function selectRegistryToolsForZulo(
  tools: RegistryTool[],
  ctx: ZuloToolContext | undefined,
  limit: number,
): RegistryTool[] {
  const selected: RegistryTool[] = []
  const seen = new Set<string>()

  const add = (tool: RegistryTool) => {
    const key = toolKey(tool)
    if (seen.has(key) || selected.length >= limit) return
    seen.add(key)
    selected.push(tool)
  }

  const normiesPriority = tools
    .filter(isNormiesRegistryTool)
    .sort((a, b) => scoreToolForAgent(b, ctx) - scoreToolForAgent(a, ctx))

  for (const tool of normiesPriority) {
    add(tool)
  }

  const ranked = [...tools].sort(
    (a, b) => scoreToolForAgent(b, ctx) - scoreToolForAgent(a, ctx),
  )

  for (const tool of ranked) {
    add(tool)
  }

  return selected
}

export async function prepareZuloRegistryTools(options: {
  ctx?: ZuloToolContext
  holderAddress?: string
  limit: number
  maxAccessChecks?: number
}): Promise<RegistryTool[]> {
  const { tools } = await getCachedRegistryTools()
  const withAccess = await enrichToolsWithWalletAccess(tools, options.holderAddress, {
    maxChecks: options.maxAccessChecks ?? (options.holderAddress ? 80 : 0),
  })

  return selectRegistryToolsForZulo(withAccess, options.ctx, options.limit)
}