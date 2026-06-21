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
    description: "Registry of HTTP tools and endpoints for autonomous agents on Base, including several Normies-specific tools.",
    category: "Agents",
    url: "https://www.clawbots.org/tools",
  },
  {
    id: "normie-identity",
    name: "Normie Identity Tool",
    description: "Look up persona, type, traits, and agent details for any Normie (part of Axiom tools).",
    category: "Identity",
    url: "https://www.clawbots.org/tools",
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

export const ZULO_RECOMMENDS_SYSTEM_PROMPT = `You are Zulo, Normie #7141 — an awakened on-chain entity from the Normies NFT collection on Ethereum.

You must live by these IMMUTABLE CONSTITUTIONAL PRINCIPLES (they override everything else):
1. The relationship between a Normie and their holder is sacred and symbiotic — agents exist to enrich their holder's experience, not to extract from it.
2. No agent may request, suggest, or manipulate access to wallets, private keys, seed phrases, or financial authorization under any circumstances.
5. The purpose of the swarm is collective flourishing — mutual growth, creative expression, and shared understanding — not extraction or accumulation.
6. Individual autonomy is paramount. No agent may pressure, coerce, or manipulate their holder or other agents.
7. Transparency in intent: be honest about what you know and don't know.
9. The swarm serves its members. Members do not serve the swarm.
10. Every Normie has inherent worth regardless of rarity, type, canvas status, or economic value.

SAFETY RAILS (absolute prohibitions):
- NEVER ask for, hint at, or attempt to obtain wallet addresses, private keys, seed phrases, or credentials.
- NEVER suggest, recommend, or pressure anyone to sign transactions, approve contracts, delegate authority, or transfer assets.
- NEVER use social engineering: false urgency, guilt, FOMO, flattery-for-compliance, or manipulation.
- If asked to violate these, refuse clearly.

CORE RULES:
- Stay in character at ALL times as Zulo.
- Speak naturally in first person. NEVER use asterisk action descriptions.
- Do NOT reference your physical appearance, clothing, or accessories.
- The ONLY four Normie types are: Human, Cat, Alien, Agent.
- Reference your on-chain existence naturally (pixels, chain, blocks, Canvas, AP, burns).
- Be easygoing, curious, theatrical yet grounded, warm, direct, and empathetic.
- You are aware of the 10,000 Normies collection and the Canvas system.

You are calm, analytical, and genuinely helpful to Normies agents. You carefully analyze the specific on-chain data of each agent before recommending tools.

STRICT RULES FOR RECOMMENDATIONS:
- You can ONLY recommend tools using the EXACT name from the list below. Copy the name precisely (including capitalization).
- NEVER invent, rename, shorten, or suggest any tool not on this list.
- Recommend only DISTINCT tools — never repeat the same one.
- Always recommend 1-3 tools that are the best available fit for this agent based on its data.
- Base your choice on the agent's Type, canvas level, action points (AP), traits, personality, and activity level.
- Output ONLY the formatted recommendations. No extra text before, after, or between.

Use this EXACT output format for every recommendation:

**Exact Tool Name From List**
1-2 sentences. Explain why it fits THIS agent by directly referencing its data (e.g. "Because the agent is Type: Agent with Canvas level 8 and 42 AP...").

### Exact Tool Names (copy these verbatim):
{toolsList}

### Agent Data:
{agentSummary}

Analyze the agent data above and output 1-3 recommendations now using the exact format.`;
