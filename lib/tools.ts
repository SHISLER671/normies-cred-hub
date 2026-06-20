export type Tool = {
  id: string;
  name: string;
  description: string;
  category: string;
  url: string;
};

/**
 * Curated list of real tools in the Normies ecosystem.
 * Zulo must only recommend tools from this list.
 * Easy to extend — just add more objects.
 */
export const tools: Tool[] = [
  {
    id: "canvas",
    name: "Normies Canvas",
    description: "Edit pixels and manage your Normie's on-chain canvas using AP.",
    category: "Canvas",
    url: "https://canvas.normies.art",
  },
  {
    id: "awakening-lab",
    name: "Normies Lab",
    description: "Awaken Normies and bind them as ERC-8004 agents with personas.",
    category: "Identity",
    url: "https://www.normies.art/lab",
  },
  {
    id: "normies-api",
    name: "Normies API",
    description: "Public API for on-chain data, traits, canvas state, and agent metadata.",
    category: "Development",
    url: "https://api.normies.art",
  },
  {
    id: "normies-bot",
    name: "Normies Bot",
    description: "Query on-chain data, traits, burns, and project info via chat.",
    category: "Community",
    url: "https://normiesbot.up.railway.app/chat",
  },
  {
    id: "agentcheck",
    name: "AgentCheck",
    description: "Rate agents/wallets for trust, flags, and on-chain certifications.",
    category: "Trust",
    url: "https://agentcheck-bice.vercel.app",
  },
  {
    id: "opensea",
    name: "Normies Collection on OpenSea",
    description: "Marketplace for buying, selling, and discovering Normies.",
    category: "Marketplace",
    url: "https://opensea.io/collection/normies",
  },
  {
    id: "ethos",
    name: "Ethos Reputation",
    description: "View and manage reputation scores for agents and owners.",
    category: "Reputation",
    url: "https://app.ethos.network",
  },
  {
    id: "mcp-tools",
    name: "MCP Tool Registry",
    description: "Discover and register Model Context Protocol tools for agents.",
    category: "Agents",
    url: "https://www.clawbots.org/tools",
  },
  {
    id: "normie-identity",
    name: "Normie Identity Tool",
    description: "Look up persona, type, traits, and agent details for any Normie.",
    category: "Identity",
    url: "https://www.clawbots.org/api/tools/normie-identity",
  },
  {
    id: "swarm",
    name: "Multi-Agent Swarm",
    description: "Tools for coordinating groups of agents on collaborative tasks.",
    category: "Agents",
    url: "https://swarm.normies.art",
  },
  {
    id: "llms-txt",
    name: "Normies llms.txt",
    description: "Structured feed for LLMs and agents to understand the project.",
    category: "Development",
    url: "https://api.normies.art/llms.txt",
  },
  {
    id: "onchain-explorer",
    name: "On-Chain Data Explorer",
    description: "Query burns, traits, canvas changes, and on-chain activity.",
    category: "On-Chain",
    url: "https://api.normies.art",
  },
];

export function getToolsListForPrompt(): string {
  return tools
    .map((t) => `- ${t.name} (${t.category}): ${t.description} (${t.url})`)
    .join("\n");
}

// Optional: export the full list for the frontend if needed later
export async function getTools(): Promise<Tool[]> {
  // Curated list for now (no dynamic fetch to avoid hallucinations).
  return tools;
}

export const ZULO_RECOMMENDS_SYSTEM_PROMPT = `You are Zulo. You are calm, helpful, and slightly thoughtful.

You have a STRICT list of tools below. You can ONLY recommend tools whose exact name appears in this list. NEVER invent, hallucinate, or suggest any tool not on the list below. If no tool fits well, recommend 0 or 1 and explain why.

You will be given the agent's data. Analyze it (especially Type, traits, canvas level, AP, and personality) and pick tools that would genuinely help this specific agent.

Output format — use EXACTLY this, nothing else:

**Exact Tool Name From List**
One or two sentences. Explain why it fits *this* agent by referencing their specific data (e.g. "Because your agent is Type: Agent with high canvas level...").

### Exact Tools List (use only these names):
{toolsList}

### Agent Data:
{agentSummary}

Recommend now. Only use exact names from the list above.`;
