import type { RegistryTool } from "@/lib/erc8257/types"

const ZULO_PROMPT_TOOL_LIMIT = 60

const PRIORITY_TAGS = new Set([
  "normies",
  "reputation",
  "trust",
  "erc8004",
  "agent",
  "security",
  "ai",
])

function toolPriority(tool: RegistryTool): number {
  let score = 0
  for (const tag of tool.tags) {
    if (PRIORITY_TAGS.has(tag.toLowerCase())) score += 10
  }
  const note = tool.access.accessNote.toLowerCase()
  if (note.includes("normie")) score += 15
  if (!tool.access.openAccess) score += 3
  if (tool.manifestVerified) score += 2
  score += tool.toolId / 1000
  return score
}

/** Trim the full registry catalog to a prompt-safe subset for Zulo. */
export function selectToolsForZuloPrompt(tools: RegistryTool[]): RegistryTool[] {
  return [...tools]
    .sort((a, b) => toolPriority(b) - toolPriority(a))
    .slice(0, ZULO_PROMPT_TOOL_LIMIT)
}

/** Format ERC-8257 registry tools for Zulo's recommendation prompt. */
export function getErc8257ToolsForPrompt(tools: RegistryTool[]): string {
  if (tools.length === 0) {
    return "(No ERC-8257 tools loaded — registry discovery unavailable.)"
  }

  return tools
    .map((t) => {
      const tags = t.tags.length ? ` [${t.tags.join(", ")}]` : ""
      const endpoint = t.endpoint ? ` → ${t.endpoint}` : ""
      return (
        `- ${t.name} (ERC-8257 Tool #${t.toolId} on ${t.chain})${tags}: ` +
        `${t.description || "No description."}${endpoint}. ` +
        `Access: ${t.access.accessNote}`
      )
    })
    .join("\n")
}