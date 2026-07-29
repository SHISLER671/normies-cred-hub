// Community tools catalog — Zulo as ecosystem guide / concierge.

export interface CommunityTool {
  name: string
  url: string
  description: string
  useCases: string[]
  audience: "casual" | "power-user" | "analyst" | "creative"
  /** Keywords for query matching */
  keywords?: string[]
}

export const COMMUNITY_TOOLS: CommunityTool[] = [
  {
    name: "Normies Burn Tracker",
    url: "https://normiesburntracker.lovable.app/",
    description: "Historical burn data and AP yield estimates",
    useCases: [
      "Check AP yields before burning",
      "See burn trends",
      "Validate my estimates",
    ],
    audience: "analyst",
    keywords: [
      "burn",
      "ap yield",
      "action points",
      "reveal",
      "scan burns",
      "burn efficiency",
      "burn opportunities",
    ],
  },
  {
    name: "PixelSymphony",
    url: "https://pixelsymphony.vercel.app/",
    description: "Music visualization synchronized with your Normies",
    useCases: [
      "Visualize my collection",
      "Create shareable content",
      "Experience Normies with music",
    ],
    audience: "creative",
    keywords: ["visualize", "music", "symphony", "show off", "collection art"],
  },
  {
    name: "Normies Archive",
    url: "https://normiesarchive.xyz/",
    description: "Preserved history of burned Normies",
    useCases: [
      "Check if a token was burned",
      "See historical supply",
      "Research lost Normies",
    ],
    audience: "analyst",
    keywords: ["archive", "burned", "history", "what happened", "lost"],
  },
  {
    name: "Normies Terminal",
    url: "https://normies-terminal.vercel.app/",
    description: "Command-line interface for Normies data",
    useCases: ["Quick lookups", "Power-user workflows", "Scripted queries"],
    audience: "power-user",
    keywords: ["terminal", "cli", "lookup", "script"],
  },
  {
    name: "Canvas Lab",
    url: "https://normie-canvas-lab.jbjbjb2112.workers.dev/agent",
    description: "Canvas editing with agent assistance",
    useCases: [
      "Edit my Normie pixels",
      "Visualize changes before committing",
    ],
    audience: "creative",
    keywords: ["canvas lab", "edit pixels", "transform", "paint"],
  },
  {
    name: "NormieCam",
    url: "https://legacy.normies.art/normiecam",
    description: "AR camera filters with Normies",
    useCases: ["Create photos with my Normie", "Share on social", "Fun content"],
    audience: "casual",
    keywords: ["photo", "ar", "camera", "selfie", "social"],
  },
  {
    name: "Normies Meme Generator",
    url: "https://normies-memegenerator.vercel.app/",
    description: "Create Normies-themed memes",
    useCases: ["Make memes", "Community content", "Viral marketing"],
    audience: "casual",
    keywords: ["meme", "funny", "viral"],
  },
  {
    name: "Normies Rarity",
    url: "https://rarity.normies.art/",
    description: "Official rarity checker and rankings",
    useCases: ["Check my rarity rank", "Compare traits", "Evaluate value"],
    audience: "analyst",
    keywords: ["rarity", "rank", "traits", "floor", "value"],
  },
  {
    name: "Normies Multisend",
    url: "https://multisend.normies.art/",
    description: "Batch transfer and airdrop tool",
    useCases: [
      "Send multiple Normies",
      "Airdrop to community",
      "Distribute efficiently",
    ],
    audience: "power-user",
    keywords: ["batch", "send", "airdrop", "transfer", "multisend", "contest"],
  },
]

export function getToolsFor(useCase: string): CommunityTool[] {
  const q = useCase.toLowerCase()
  return COMMUNITY_TOOLS.filter((tool) =>
    tool.useCases.some((uc) => uc.toLowerCase().includes(q)),
  )
}

export function getToolsForAudience(
  audience: CommunityTool["audience"],
): CommunityTool[] {
  return COMMUNITY_TOOLS.filter((tool) => tool.audience === audience)
}

/** Rank tools by relevance to a free-text query; returns top matches. */
export function getToolsForQuery(query: string, limit = 2): CommunityTool[] {
  const q = query.toLowerCase().trim()
  if (!q) return []

  const scored = COMMUNITY_TOOLS.map((tool) => {
    let score = 0
    const hay = [
      tool.name,
      tool.description,
      ...tool.useCases,
      ...(tool.keywords ?? []),
    ]
      .join(" ")
      .toLowerCase()

    for (const word of q.split(/\s+/).filter((w) => w.length > 2)) {
      if (hay.includes(word)) score += 1
    }
    for (const kw of tool.keywords ?? []) {
      if (q.includes(kw.toLowerCase())) score += 3
    }
    // Phrase boosts
    if (q.includes("burn") && tool.name.toLowerCase().includes("burn")) score += 4
    if (
      (q.includes("visual") || q.includes("music") || q.includes("show off")) &&
      tool.name.includes("PixelSymphony")
    )
      score += 4
    if (
      (q.includes("batch") || q.includes("airdrop") || q.includes("send many")) &&
      tool.name.includes("Multisend")
    )
      score += 4
    if (q.includes("rarity") && tool.name.includes("Rarity")) score += 4
    if (q.includes("archive") || q.includes("what happened")) {
      if (tool.name.includes("Archive")) score += 4
    }
    if (q.includes("meme") && tool.name.includes("Meme")) score += 4
    if ((q.includes("photo") || q.includes("ar ")) && tool.name.includes("Cam"))
      score += 4

    return { tool, score }
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)

  return scored.slice(0, limit).map((x) => x.tool)
}

export function buildEcosystemGuidePrompt(): string {
  const lines = COMMUNITY_TOOLS.map(
    (t) => `- ${t.name} (${t.url}) — ${t.description} [${t.audience}]`,
  ).join("\n")

  return `
COMMUNITY TOOLS — recommend specific tools when relevant (ecosystem concierge):

${lines}

RECOMMENDATION STYLE:
- Mention 1–2 tools per response, maximum
- Only when relevant to the user's question
- Natural integration with full URL: "Before burning, validate on Normies Burn Tracker (https://…)"
- Not a directory dump — contextual guidance from a local who knows the best spots
- Prefer official/community tools over inventing new ones
`.trim()
}

export function formatToolsForPrompt(tools: CommunityTool[]): string {
  if (!tools.length) return ""
  return tools
    .map((t) => `- ${t.name} (${t.url}) — ${t.description}`)
    .join("\n")
}
