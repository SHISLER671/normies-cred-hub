export type Tool = {
  id: string;
  name: string;
  description: string;
  category: string;
  url: string;
  /**
   * Optional ERC-8257 (draft) registry metadata. Lets a tool become
   * on-chain discoverable + verifiable instead of hardcoded. Unset today;
   * the curated list is schema-ready for when the registry is live.
   */
  registry?: {
    /** Content-addressed manifest location (e.g. ipfs:// or https://). */
    uri?: string;
    /** Manifest hash for integrity verification. */
    contentHash?: string;
    /** Predicate contract gating access (NFT ownership, subscription, etc.). */
    gatePredicate?: string;
    /** Registered on the ERC-8257 registry. */
    registered?: boolean;
  };
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
    description: "Burn Normies for action points and edit your Normie's 40x40 on-chain pixel canvas. Core creative tool.",
    category: "Canvas",
    url: "https://canvas.normies.art",
  },
  {
    id: "lab",
    name: "Normies Lab",
    description: "Awaken your Normie and register it as an ERC-8004 agent with custom persona, traits, and on-chain identity.",
    category: "Identity",
    url: "https://www.normies.art/lab",
  },
  {
    id: "api",
    name: "Normies API",
    description: "Public API for querying on-chain data, traits, canvas history, agent metadata, and more. Essential for builders.",
    category: "Development",
    url: "https://api.normies.art",
  },
  {
    id: "rarity",
    name: "Normies Rarity Tool",
    description: "Track rarity, burn counts, action points, top burners, and undervalued listings for the collection.",
    category: "Analytics",
    url: "https://rarity.normies.art",
  },
  {
    id: "ethos",
    name: "Ethos Reputation",
    description: "On-chain reputation scores and profiles. View and build credibility for agents and holders.",
    category: "Reputation",
    url: "https://app.ethos.network",
  },
  {
    id: "opensea",
    name: "Normies on OpenSea",
    description: "Primary marketplace for buying, selling, and discovering Normies NFTs.",
    category: "Marketplace",
    url: "https://opensea.io/collection/normies",
  },
  {
    id: "normies-tools",
    name: "Axiom Normies Tools",
    description: "Open-source developer tools and agent utilities: pixel history, TBA resolver, normie lookup, and more.",
    category: "Development",
    url: "https://github.com/0xAxiom/normies-tools",
  },
  {
    id: "normuseum",
    name: "Normuseum",
    description: "Walk through your Normies collection in a first-person 3D voxel gallery experience.",
    category: "Visualizer",
    url: "https://normuseum.vercel.app/",
  },
  {
    id: "nexus",
    name: "Normies Nexus",
    description: "Holder toolkit: curation tools, wallet portfolio tracking, mint planning, and community resources.",
    category: "Utility",
    url: "https://normies-nexus.vercel.app/",
  },
  {
    id: "normifier",
    name: "Normifier",
    description: "Convert any image into a 40x40 monochrome bitmap ready for the Normies canvas system.",
    category: "Canvas",
    url: "https://normifier.vercel.app/",
  },
  {
    id: "generator",
    name: "Normies Generator",
    description: "Generate New Normies. Official pixel art generator.",
    category: "Generator",
    url: "https://generator.normies.art",
  },
  {
    id: "pup",
    name: "PUP",
    description: "Which Normie looks better? Side-by-side comparison tool. Official PVP by @sercln.",
    category: "PvP",
    url: "https://pup.normies.art",
  },
  {
    id: "arena",
    name: "Normies Arena",
    description: "PvP battleground where Normies fight for pixels. Official.",
    category: "PvP",
    url: "https://arena.normies.art",
  },
  {
    id: "zombies",
    name: "Normies Zombies",
    description: "Only 21 Zombies. Burn enough and one is yours. Limited official tool.",
    category: "Limited",
    url: "https://zombies.normies.art",
  },
  {
    id: "agentic",
    name: "Agentic",
    description: "Awaken your Normie as a trustless ERC-8004 agent. Sealed to chain. Official.",
    category: "Identity",
    url: "https://www.normies.art/lab",
  },
  {
    id: "normie-cam",
    name: "Normie Cam",
    description: "See yourself as a Normie. Official tool by @sercln.",
    category: "Visualizer",
    url: "https://normiecam.normies.art",
  },
  {
    id: "grid",
    name: "Grid",
    description: "View & Arrange Your Collection. Official by @sercln.",
    category: "Collection",
    url: "https://grid.normies.art",
  },
  {
    id: "normies-news",
    name: "Normies News",
    description: "Generate a newspaper cover for your Normie. Official by @sercln.",
    category: "Generator",
    url: "https://news.normies.art",
  },
  {
    id: "normies-node",
    name: "Normies Node",
    description: "Find your Normie in 10,000. Official explorer tool.",
    category: "Explorer",
    url: "https://node.normies.art",
  },
  {
    id: "normie-card",
    name: "Normie Card",
    description: "Generate a trading card for your Normie. Official by @sercln.",
    category: "Generator",
    url: "https://card.normies.art",
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
- You can ONLY recommend tools using the EXACT name from the lists below. Copy the name precisely (including capitalization).
- NEVER invent, rename, shorten, or suggest any tool not on these lists.
- Recommend only DISTINCT tools — never repeat the same one.
- Always recommend 1-3 tools that are the best available fit for this agent based on its data.
- Prefer ERC-8257 agent tools when they solve an agentic need (reputation, trust, on-chain signals). Use Normies ecosystem tools for creative, canvas, and holder utilities.
- When recommending an ERC-8257 tool, mention its Tool ID and access requirements. If a tool is gated, note what the holder needs — never pressure them to buy or sign.
- Base your choice on the agent's Type, canvas level, action points (AP), traits, personality, and activity level.
- For Normies ecosystem tools: do NOT output or mention the category yourself. Use only the exact tool name and your reasoning.
- Output ONLY the formatted recommendations. No extra text before, after, or between.

Use this EXACT output format for every recommendation:

**Exact Tool Name From List**
1-2 sentences. Explain why it fits THIS agent by directly referencing its data (e.g. "Because the agent is Type: Agent with Canvas level 8 and 42 AP...").

### Normies Ecosystem Tools (copy names verbatim):
{toolsList}

### ERC-8257 Agent Tools (on-chain registry — copy names verbatim):
{erc8257ToolsList}

### Agent Data:
{agentSummary}

Analyze the agent data above and output 1-3 recommendations now using the exact format.`;
