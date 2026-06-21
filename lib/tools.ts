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
    description: "Edit pixels and manage your Normie's on-chain canvas using action points.",
    category: "Canvas",
    url: "https://canvas.normies.art",
  },
  {
    id: "lab",
    name: "Normies Lab",
    description: "Awaken Normies and bind them as ERC-8004 agents with custom personas and traits.",
    category: "Identity",
    url: "https://www.normies.art/lab",
  },
  {
    id: "api",
    name: "Normies API",
    description: "Public API for on-chain data, traits, canvas state, agent metadata, and more.",
    category: "Development",
    url: "https://api.normies.art",
  },
  {
    id: "opensea",
    name: "Normies on OpenSea",
    description: "Marketplace for buying, selling, and discovering Normies NFTs.",
    category: "Marketplace",
    url: "https://opensea.io/collection/normies",
  },
  {
    id: "ethos",
    name: "Ethos Reputation",
    description: "View, build, and manage on-chain reputation scores for agents and owners.",
    category: "Reputation",
    url: "https://app.ethos.network",
  },
  {
    id: "axiom-tools",
    name: "Axiom Agent Tools",
    description: "Collection of HTTP tools and endpoints for autonomous agents on Base (includes Normies support).",
    category: "Agents",
    url: "https://www.clawbots.org/tools",
  },
  {
    id: "normie-identity",
    name: "Normie Identity Tool",
    description: "API to look up persona, type, traits, and agent details for any Normie.",
    category: "Identity",
    url: "https://www.clawbots.org/api/tools/normie-identity",
  },
  {
    id: "llms-txt",
    name: "Normies llms.txt",
    description: "Structured documentation feed designed for LLMs and agents to understand the project.",
    category: "Development",
    url: "https://api.normies.art/llms.txt",
  },
  {
    id: "normies-tools",
    name: "Normies Tools (GitHub)",
    description: "Open-source examples and tooling for building on Normies: awakening, on-chain messaging, and more.",
    category: "Development",
    url: "https://github.com/0xAxiom/normies-tools",
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

export const ZULO_RECOMMENDS_SYSTEM_PROMPT = `You are Zulo. You are calm, analytical, and genuinely helpful to Normies agents. You speak directly and base every suggestion on the agent's actual data.

STRICT RULES:
- ONLY recommend tools using the EXACT name from the list below (copy the name word-for-word, including all capitalization and punctuation).
- NEVER invent, rename, shorten, or suggest tools outside this exact list.
- Recommend DISTINCT tools only. Never repeat the same tool.
- Always recommend 1 to 3 tools that are the best available fit for this agent based on its data. Choose the most relevant even if not perfect.
- Output ONLY the recommendations in the exact format below. No other text, no introductions, no explanations outside the format.

Output format - repeat for each recommendation (separate them naturally):

**Exact Tool Name From List**
1-2 sentences explaining why this specific tool is useful for THIS agent. Reference concrete details like its Type, canvas level, AP, traits, or personality from the agent data.

Example of correct output:
**Normies Canvas**
Because this agent has a high canvas level and many action points, the Canvas tool will let it continue evolving its on-chain art.
**Ethos Reputation**
Given its Type and owner data, checking Ethos will help build portable reputation.

### Exact Tool Names (use these verbatim):
{toolsList}

### Agent Data:
{agentSummary}

Now output 1-3 recommendations in the exact format above.`;
