import { formatWalletAccessLine } from "@/lib/erc8257/access-check"
import {
  selectToolsForAgent,
  type ZuloToolContext,
} from "@/lib/erc8257/context"
import type { RegistryTool } from "@/lib/erc8257/types"

export const ZULO_RECOMMENDS_TOOL_LIMIT = 60
export const ZULO_HORIZON_TOOL_LIMIT = 25

/** Trim the registry catalog to a prompt-safe, context-ranked subset for Zulo Recommends. */
export function selectToolsForZuloPrompt(
  tools: RegistryTool[],
  ctx?: ZuloToolContext,
): RegistryTool[] {
  return selectToolsForAgent(tools, ctx, ZULO_RECOMMENDS_TOOL_LIMIT)
}

/** Smaller subset for Horizon chat (token budget). */
export function selectToolsForHorizonPrompt(
  tools: RegistryTool[],
  ctx?: ZuloToolContext,
): RegistryTool[] {
  return selectToolsForAgent(tools, ctx, ZULO_HORIZON_TOOL_LIMIT)
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
        `Access: ${t.access.accessNote}. ${formatWalletAccessLine(t.access)}`
      )
    })
    .join("\n")
}

/** Compact tools block injected into Zulo Horizon's system prompt. */
export function buildHorizonToolsBlock(
  normiesToolsList: string,
  erc8257ToolsList: string,
): string {
  return `
TOOL KNOWLEDGE (use when the user asks about tools, trust, or what to use next)
- You may recommend from the Normies ecosystem list OR the ERC-8257 on-chain registry below.
- Never invent tools. Always name the exact tool and note access requirements for gated tools.
- Never pressure wallet actions, purchases, or signing.

Normies ecosystem tools:
${normiesToolsList}

ERC-8257 agent tools (on-chain registry):
${erc8257ToolsList}
`.trim()
}