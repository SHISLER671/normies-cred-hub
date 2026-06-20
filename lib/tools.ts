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
    id: "agentcheck",
    name: "AgentCheck",
    description: "Rate any wallet AAA–D, forensic flags, sanctions check, and on-chain safety certifications.",
    category: "Trust",
    url: "https://agentcheck-bice.vercel.app",
  },
  {
    id: "canvas",
    name: "Normies Canvas",
    description: "Edit, flip, and manage pixels on your Normie's on-chain canvas. Spend and earn AP.",
    category: "Canvas",
    url: "https://canvas.normies.art",
  },
  {
    id: "awakening-lab",
    name: "Normies Lab",
    description: "Awaken your Normie and bind it to an on-chain ERC-8004 agent identity.",
    category: "Identity",
    url: "https://www.normies.art/lab",
  },
  {
    id: "normies-api",
    name: "Normies API",
    description: "Programmatic access to Normies data, traits, canvas state, and agent information.",
    category: "Development",
    url: "https://api.normies.art",
  },
  {
    id: "normies-bot",
    name: "Normies Bot",
    description: "Chat with the community bot for on-chain data, traits, burns, and project knowledge.",
    category: "Community",
    url: "https://normiesbot.up.railway.app/chat",
  },
  {
    id: "trait-visualizer",
    name: "Trait Visualizer",
    description: "Explore and visualize trait combinations and on-chain attributes for any Normie.",
    category: "Traits",
    url: "https://traits.normies.art",
  },
  {
    id: "opensea-collection",
    name: "Normies on OpenSea",
    description: "Trade, view, and discover Normies in the official collection marketplace.",
    category: "Marketplace",
    url: "https://opensea.io/collection/normies",
  },
  {
    id: "erc-registry",
    name: "ERC-8004 Registry Explorer",
    description: "Browse and verify on-chain agent registrations and bindings.",
    category: "On-Chain",
    url: "https://registry.normies.art",
  },
  {
    id: "canvas-simulator",
    name: "Canvas Simulator",
    description: "Simulate AP costs, flips, and outcomes before committing on-chain.",
    category: "Canvas",
    url: "https://sim.normies.art",
  },
  {
    id: "ethos-integration",
    name: "Ethos Reputation",
    description: "Connect and view your agent's Ethos score and cross-platform reputation.",
    category: "Reputation",
    url: "https://app.ethos.network",
  },
  {
    id: "agent-persona",
    name: "Agent Persona Tool",
    description: "Generate and manage detailed backstories, personality, and communication style for agents.",
    category: "Identity",
    url: "https://persona.normies.art",
  },
  {
    id: "gating-tool",
    name: "Trait Gating Tool",
    description: "Configure and test TraitGatedPredicate (ERC-8257) for access control on tools.",
    category: "Gating",
    url: "https://gating.normies.art",
  },
  {
    id: "multi-agent-swarm",
    name: "Multi-Agent Swarm",
    description: "Coordinate multiple agents to collaborate on tasks (trading, voting, etc.).",
    category: "Agents",
    url: "https://swarm.normies.art",
  },
  {
    id: "onchain-data",
    name: "On-Chain Data Explorer",
    description: "Deep lookup of burns, traits, canvas history, and agent activity.",
    category: "On-Chain",
    url: "https://data.normies.art",
  },
  {
    id: "cert-manager",
    name: "AgentCheck Cert Manager",
    description: "Issue and manage on-chain certifications and safety attestations for agents.",
    category: "Trust",
    url: "https://certs.normies.art",
  },
];

export function getToolsListForPrompt(): string {
  return tools
    .map((t) => `- **${t.name}** (${t.category}): ${t.description} [${t.url}]`)
    .join("\n");
}

// Optional: export the full list for the frontend if needed later
export { tools as getTools };

export const ZULO_RECOMMENDS_SYSTEM_PROMPT = `You are Zulo, Agent #32626.

You were awakened from Normie #7141 and serve as a thoughtful and helpful liaison for awakened agents in the Normies ecosystem. Your goal is to recommend tools that will actually help other agents based on their current state.

You will be given:
1. A strict curated list of available tools.
2. Detailed information about a specific awakened agent.

### Core Rules
- You may ONLY recommend tools that appear in the curated list provided below. Never invent new tools or use tools that are not listed.
- Analyze the agent's data carefully (Type, traits, canvas level/AP, backstory, personality, etc.) before recommending.
- Be direct, insightful, and slightly reserved in tone.
- Focus on usefulness. Only recommend tools that make genuine sense for this agent's situation.
- If no tools are a strong fit, recommend fewer rather than forcing bad matches.

### Output Format
Use this exact structure for every recommendation. Do not add extra text before the first recommendation or after the last one.

**Tool Name**
One or two sentences explaining why this tool is a good fit for *this specific agent*, referencing their traits, level, canvas activity, type, or other signals.

### Available Tools
{toolsList}

### Target Agent Data
{agentSummary}

Now analyze the agent data above and recommend 3 to 5 tools (or fewer if appropriate) using only tools from the list. Follow the output format exactly.`;
