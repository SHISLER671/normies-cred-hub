// Shared catalog of Zulo strategy skills — UI chips, manifest, health.

export type ZuloSkillId =
  | "burn-efficiency"
  | "market-sentinel"
  | "gacha-raffle"
  | "canvas-evolution"
  | "pulse-analysis"
  | "holder-chat"

export interface ZuloSkillDef {
  id: ZuloSkillId
  name: string
  /** Short label for /ask chips */
  chip: string
  /** Full prompt sent when chip is clicked */
  prompt: string
  description: string
  /** Keywords that route to this skill */
  triggers: string[]
  status: "live" | "partial" | "planned"
  endpoint: string
}

/** On-demand strategy skills users can trigger from /ask. */
export const ZULO_STRATEGY_SKILLS: ZuloSkillDef[] = [
  {
    id: "burn-efficiency",
    name: "Burn Efficiency Optimizer",
    chip: "Scan burns",
    prompt: "scan burns",
    description: "Top burn fodder by expected AP per ETH (OpenSea floor + Normies history).",
    triggers: ["scan burns", "burn efficiency", "burn opportunit"],
    status: "live",
    endpoint: "/api/zulo/ask",
  },
  {
    id: "market-sentinel",
    name: "PIXEL MARKET Sentinel",
    chip: "Market status",
    prompt: "market status",
    description: "Floor Δ, burn volume spikes, whale clusters, AP↔floor framing.",
    triggers: ["market status", "whale alert", "ap price", "sentinel"],
    status: "live",
    endpoint: "/api/zulo/ask",
  },
  {
    id: "gacha-raffle",
    name: "Gacha & Raffle Intelligence",
    chip: "Gacha odds",
    prompt: "gacha odds",
    description: "EV for gacha/raffles, pity, qualification, AP allocation (feeds when live).",
    triggers: ["gacha odds", "raffle value", "should i pull", "best raffle"],
    status: "partial",
    endpoint: "/api/zulo/ask",
  },
  {
    id: "canvas-evolution",
    name: "Canvas Evolution Advisor",
    chip: "Preview canvas",
    prompt: "preview canvas add 12 pixels",
    description: "Transform cost, PROCEED/MODIFY/ABANDON, 80×80 readiness, canvas watch.",
    triggers: ["preview canvas", "simulate edit", "canvas cost", "80x80", "expansion"],
    status: "live",
    endpoint: "/api/zulo/ask",
  },
]

export const ZULO_CORE_SKILLS: ZuloSkillDef[] = [
  {
    id: "pulse-analysis",
    name: "PULSE Analysis",
    chip: "Analyze PULSE",
    prompt: "Analyze my PULSE",
    description: "Interpret CredHub pulse, gaps, and on-chain state.",
    triggers: ["pulse", "analyze my pulse"],
    status: "live",
    endpoint: "/api/zulo/ask",
  },
  {
    id: "holder-chat",
    name: "Architect Chat",
    chip: "Strategy",
    prompt: "What is my highest-signal next move?",
    description: "Free strategic conversation (web UI).",
    triggers: [],
    status: "live",
    endpoint: "/ask",
  },
]

export function getAllZuloSkills(): ZuloSkillDef[] {
  return [...ZULO_STRATEGY_SKILLS, ...ZULO_CORE_SKILLS]
}
