export type Tool = {
  id: string;
  name: string;
  description: string;
  category: string;
  url: string;
};

/**
 * Tools for Normies agents.
 * TODO: Make dynamic by fetching/parsing https://www.normies.art/tools in /api/tools
 * For now, curated list (include examples from community).
 */
export const tools: Tool[] = [
  {
    id: "agentcheck",
    name: "AgentCheck",
    description: "Rate any wallet AAA-D, forensic flags, sanctions check, safety cert status. Free API + on-chain certs.",
    category: "Trust",
    url: "https://agentcheck-bice.vercel.app",
  },
  {
    id: "art-tools",
    name: "Normies Art Tools",
    description: "Create artistic variations and pixel art based on your Normie's traits.",
    category: "Art",
    url: "https://art.normies.art",
  },
  {
    id: "trait-visualizer",
    name: "Trait Visualizer",
    description: "Explore and visualize all possible trait combinations for Normies.",
    category: "Traits",
    url: "https://traits.normies.art",
  },
  {
    id: "canvas-tools",
    name: "Canvas Tools",
    description: "Tools to plan and simulate canvas flips and AP usage.",
    category: "Canvas",
    url: "https://canvas.normies.art",
  },
  {
    id: "reputation-hub",
    name: "Reputation Hub",
    description: "Cross-platform reputation aggregator for Normies and Ethos profiles.",
    category: "Reputation",
    url: "https://reputation.normies.art",
  },
  {
    id: "ens-agent",
    name: "ENS for Agents",
    description: "Register and manage ENS names for your awakened agents.",
    category: "Identity",
    url: "https://ens.normies.art",
  },
  {
    id: "onchain-registry",
    name: "On-Chain Registry Explorer",
    description: "Browse and verify ERC-8004 and ERC-8257 registrations.",
    category: "On-Chain",
    url: "https://registry.normies.art",
  },
  {
    id: "gating-predicate",
    name: "Trait Gating Tool",
    description: "Configure and test TraitGatedPredicate for your tools (ERC-8257).",
    category: "Gating",
    url: "https://gating.normies.art",
  },
  {
    id: "cert-manager",
    name: "AgentCheck Cert Manager",
    description: "Manage on-chain certifications for agents and tools.",
    category: "Trust",
    url: "https://certs.normies.art",
  },
  {
    id: "pixel-flip-sim",
    name: "Pixel Flip Simulator",
    description: "Simulate AP costs and outcomes for canvas flips.",
    category: "Canvas",
    url: "https://sim.normies.art",
  },
  {
    id: "community-forum",
    name: "Normies Community Forum",
    description: "Discuss and collaborate with other Normie owners and agents.",
    category: "Community",
    url: "https://forum.normies.art",
  },
  {
    id: "marketplace",
    name: "Normies Marketplace",
    description: "Trade AP, traits, and certified agent services.",
    category: "Marketplace",
    url: "https://market.normies.art",
  },
];

export async function getTools(): Promise<Tool[]> {
  // Dynamic fetch placeholder. In production, call /api/tools which scrapes the page.
  // For MVP, return static list. To make fully dynamic:
  // - Add cheerio dep if needed for parsing.
  // - In /api/tools: fetch page, parse cards (name, desc, category, url).
  try {
    const res = await fetch('/api/tools');
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.warn('Failed to fetch dynamic tools, using static list', e);
  }
  return tools;
}

export function getToolsListForPrompt(): string {
  return tools.map(t => `- ${t.name} (${t.category}): ${t.description}`).join('\n');
}
