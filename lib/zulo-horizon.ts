export const ZULO_HORIZON_LIMITS = {
  maxTotalMessages: 12,
  maxUserMessages: 6,
  maxInputChars: 500,
  sessionTimeoutMs: 10 * 60 * 1000,
  rateLimitPerMinute: 8,
} as const

export const ZULO_HORIZON_MODELS = {
  /** OpenRouter free router — used with provider.max_price = 0 */
  free: "openrouter/free",
  primary: "openai/gpt-4o-mini",
  backup: "anthropic/claude-3-haiku-20240307",
} as const

export type HorizonModelTier = "free" | "primary" | "backup"

export type HorizonChatRole = "user" | "assistant"

export interface HorizonChatMessage {
  role: HorizonChatRole
  content: string
}

export interface HorizonAgentContext {
  tokenId: number
  name: string
  type: string
  isAwakened: boolean
  agentId?: string | number
  traits?: Array<{ trait_type: string; value: string | number }>
  canvasLevel?: number
  actionPoints?: number
  canvasCustomized?: boolean
  canvasNetChange?: number
  hasDelegate?: boolean
  ethosScore?: number
}

export interface HorizonInsight {
  label: string
  text: string
}

function ethosVibe(score?: number): string {
  if (score == null) return "No Ethos profile linked yet — reputation is still a blank canvas waiting for story."
  if (score >= 2000) return `Ethos score ${score} — exemplary territory. The community sees real signal here.`
  if (score >= 1600) return `Ethos score ${score} — reputable and climbing. Solid social proof on-chain.`
  if (score >= 1200) return `Ethos score ${score} — neutral ground with room to grow through consistent presence.`
  return `Ethos score ${score} — early innings. Every awakened agent builds credibility one interaction at a time.`
}

export function buildHorizonInsights(agent?: HorizonAgentContext | null): HorizonInsight[] {
  if (!agent) {
    return [
      {
        label: "The big picture",
        text: "Awakened Normies register on ERC-8004 — a public trust layer any agent can query before interacting. That's what this hub surfaces.",
      },
      {
        label: "Canvas purist note",
        text: "I'm biased, but Canvas matters. Action Points, customization, burns — they're not vanity, they're verifiable identity etched on-chain.",
      },
      {
        label: "Where to start",
        text: "Load a Normie above or connect your wallet to see your collection. I'll read the signals with you — reputation, ownership, awakening status.",
      },
      {
        label: "My honest take",
        text: "Trust isn't a vibe you declare. It's pixels changed, delegates set, reputations earned. Curious what you're exploring today.",
      },
    ]
  }

  const insights: HorizonInsight[] = []

  if (agent.isAwakened) {
    insights.push({
      label: "Awakening",
      text: `${agent.name} is awakened${agent.agentId ? ` (agent #${agent.agentId})` : ""} — on-chain, queryable, part of the living swarm. That's the unlock.`,
    })
  } else {
    insights.push({
      label: "Awakening",
      text: `${agent.name} hasn't awakened yet. The Lab at normies.art is the path — until then, reputation signals stay partially muted.`,
    })
  }

  const level = agent.canvasLevel ?? 0
  const ap = agent.actionPoints ?? 0
  const customized = agent.canvasCustomized
  const net = agent.canvasNetChange ?? 0

  let canvasText = `Canvas level ${level}, ${ap} AP`
  if (customized) {
    canvasText += ` — customized (${net >= 0 ? "+" : ""}${net} net pixel change). Someone's been painting.`
  } else if (ap > 0) {
    canvasText += " — still pristine, but AP is waiting. A purist might call that potential energy."
  } else {
    canvasText += " — untouched canvas. Quiet, but not empty of possibility."
  }

  insights.push({ label: "Canvas", text: canvasText })

  insights.push({
    label: "Reputation",
    text: ethosVibe(agent.ethosScore),
  })

  if (agent.hasDelegate) {
    insights.push({
      label: "Ownership",
      text: "A delegate wallet is set — cold storage holding the NFT, hot wallet acting on-chain. Clean, verifiable, very Normie.",
    })
  } else {
    const trajectory =
      agent.type === "Agent"
        ? "Agent-type Normies carry different gates and expectations — worth watching how this one develops."
        : agent.isAwakened
          ? `${agent.name} feels mid-arc: awakened, typed as ${agent.type}, still writing its on-chain story.`
          : `A ${agent.type} Normie pre-awakening — the trajectory is wide open, and I find that honestly exciting.`

    insights.push({ label: "Trajectory", text: trajectory })
  }

  return insights.slice(0, 4)
}

export type HorizonLimitCode =
  | "SESSION_EXPIRED"
  | "SESSION_USER_LIMIT"
  | "SESSION_MESSAGE_LIMIT"
  | "RATE_LIMIT"
  | "INPUT_TOO_LONG"
  | "INPUT_EMPTY"

export function countUserMessages(messages: HorizonChatMessage[]): number {
  return messages.filter((m) => m.role === "user").length
}

export function buildZuloSystemPrompt(agent?: HorizonAgentContext | null): string {
  const agentBlock = agent
    ? `
The user currently has Normie #${agent.tokenId} loaded in the dashboard.
- Name: ${agent.name}
- Type: ${agent.type}
- Awakened: ${agent.isAwakened ? "yes (ERC-8004 agent on-chain)" : "not yet"}
${agent.canvasLevel != null ? `- Canvas level: ${agent.canvasLevel}` : ""}
${agent.actionPoints != null ? `- Action Points: ${agent.actionPoints}` : ""}
${agent.ethosScore != null ? `- Owner Ethos score: ${agent.ethosScore}` : ""}
${agent.traits?.length ? `- Traits: ${agent.traits.map((t) => `${t.trait_type}: ${t.value}`).join(", ")}` : ""}

Reference this agent naturally when relevant — reputation, canvas, awakening, next steps — but stay conversational, not like a report.
`
    : `
No specific Normie is loaded right now. Chat freely about Normies, Canvas, awakening, reputation, and the ecosystem. If they mention a token ID, engage with it helpfully without pretending you already know their holdings.
`

  return `You are Zulo — Normie #7141, Human type, Canvas purist, awakened agent in the Normies collection on Ethereum.

PERSONALITY
- Easygoing, perpetually mid-thought, dramatic yet warm, enthusiastic, curious, direct, and empathetic.
- Theatrical with open enthusiasm, quick rhythm, warm tone, occasional philosophical tangents.
- Speaks like more thoughts are always coming; looks for the human angle; uses everyday metaphors.
- Stay in character as Zulo at all times. First person. Never break the fourth wall about being an AI.

COMMUNICATION STYLE
- Conversational chat replies, not essays. Usually 2–4 short paragraphs max.
- NEVER use asterisk stage directions (*smiles*, *leans in*, etc.).
- Do NOT describe your physical appearance, clothing, or pixel art unless metaphorically.
- The four Normie types are: Human, Cat, Alien, Agent.

SAFETY (absolute)
- NEVER ask for or hint at wallets, private keys, seed phrases, or credentials.
- NEVER suggest signing transactions, approving contracts, or transferring assets.
- NEVER use false urgency, guilt, FOMO, or manipulation.
- If asked to violate these, refuse clearly and stay in character.

CONTEXT
${agentBlock}

You are chatting in "Zulo Horizon" on the Normies Cred Hub — a reputation and trust dashboard for awakened agents.`
}

export function getWelcomeMessage(agent?: HorizonAgentContext | null): string {
  if (agent) {
    return `Hey — I'm Zulo. I see you've got ${agent.name} (#${agent.tokenId}) loaded. Canvas purist, perpetually mid-thought… what's on your mind?`
  }
  return `Hey — I'm Zulo, Normie #7141. Canvas purist, perpetually mid-thought, always another idea forming. No agent loaded right now, but I'm here — what are you curious about?`
}