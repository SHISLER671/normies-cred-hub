import type { EthosLevel } from "@/lib/types"

/**
 * Ethos credibility score levels (0–2800 scale).
 * Source: developers.ethos.network
 */
export const ETHOS_LEVELS: {
  level: EthosLevel
  min: number
  max: number
  /** tailwind-friendly token class names for the badge */
  className: string
  description: string
}[] = [
  {
    level: "Untrusted",
    min: 0,
    max: 799,
    className: "bg-destructive/15 text-destructive border-destructive/30",
    description: "Little to no established credibility.",
  },
  {
    level: "Questionable",
    min: 800,
    max: 1199,
    className: "bg-chart-4/15 text-chart-4 border-chart-4/30",
    description: "Emerging reputation with limited signals.",
  },
  {
    level: "Neutral",
    min: 1200,
    max: 1599,
    className: "bg-muted text-muted-foreground border-border",
    description: "A baseline, balanced standing.",
  },
  {
    level: "Reputable",
    min: 1600,
    max: 1999,
    className: "bg-primary/15 text-primary border-primary/30",
    description: "Trusted with a solid track record.",
  },
  {
    level: "Exemplary",
    min: 2000,
    max: 2399,
    className: "bg-accent/20 text-accent-foreground border-accent/40",
    description: "Highly trusted across the network.",
  },
  {
    level: "Revered",
    min: 2400,
    max: 2800,
    className: "bg-primary/25 text-primary border-primary/50",
    description: "Among the most credible identities.",
  },
]

export function getEthosLevel(score: number): EthosLevel {
  const match = ETHOS_LEVELS.find((l) => score >= l.min && score <= l.max)
  return match?.level ?? "Neutral"
}

export function getEthosLevelMeta(level: EthosLevel) {
  return ETHOS_LEVELS.find((l) => l.level === level) ?? ETHOS_LEVELS[2]
}

/** Returns 0–100 progress of the score across the full 0–2800 scale. */
export function getEthosScorePercent(score: number): number {
  return Math.max(0, Math.min(100, (score / 2800) * 100))
}
