import { formatWalletAccessLine } from "@/lib/erc8257/access-check"
import type { ZuloToolContext } from "@/lib/erc8257/context"
import type { RegistryTool } from "@/lib/erc8257/types"
import {
  selectRegistryToolsForZulo,
  ZULO_HORIZON_REGISTRY_LIMIT,
  ZULO_RECOMMENDS_REGISTRY_LIMIT,
} from "@/lib/erc8257/zulo-select"

/** Trim the registry catalog to a prompt-safe, context-ranked subset for Zulo Recommends. */
export function selectToolsForZuloPrompt(
  tools: RegistryTool[],
  ctx?: ZuloToolContext,
): RegistryTool[] {
  return selectRegistryToolsForZulo(tools, ctx, ZULO_RECOMMENDS_REGISTRY_LIMIT)
}

/** Smaller subset for Horizon chat (token budget). */
export function selectToolsForHorizonPrompt(
  tools: RegistryTool[],
  ctx?: ZuloToolContext,
): RegistryTool[] {
  return selectRegistryToolsForZulo(tools, ctx, ZULO_HORIZON_REGISTRY_LIMIT)
}

/** Format ERC-8257 registry tools for Zulo's recommendation prompt. */
export function getAgentToolsForPrompt(tools: RegistryTool[]): string {
  if (tools.length === 0) {
    return "(No agent tools loaded — ERC-8257 registry discovery unavailable.)"
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

/** @deprecated Use getAgentToolsForPrompt */
export const getErc8257ToolsForPrompt = getAgentToolsForPrompt

/** Compact tools block injected into Zulo Horizon's system prompt. */
export function buildHorizonToolsBlock(
  normiesToolsList: string,
  agentToolsList: string,
  hints?: string,
): string {
  const hintsBlock = hints
    ? `\n\nRecommendation hints for the loaded agent:\n${hints}`
    : ""

  return `
TOOL KNOWLEDGE (use when the user asks about tools, trust, or what to use next)
- You may recommend from the Normies ecosystem list OR the Agent Tools registry below.
- Never invent tools. Always name the exact tool and note access requirements for gated tools.
- Never pressure wallet actions, purchases, or signing.
- DYOR: on-chain tools can change; mention access gates honestly.

### Normies Ecosystem Tools
${normiesToolsList}

### Agent Tools (ERC-8257 on-chain registry)
${agentToolsList}${hintsBlock}
`.trim()
}