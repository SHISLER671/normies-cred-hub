// lib/agent-recommendations/traitAnalysis.ts
// Premium trait combination heuristics (curated, not exhaustive).

export interface TraitCombo {
  traits: string[]
  /** Soft estimate / community note — not a live census */
  occurrenceNote: string
  rarityScore: number
  marketPremiumNote: string
}

/** Curated “do not casually burn” combinations. */
export const PREMIUM_COMBOS: TraitCombo[] = [
  {
    traits: ["Shadow Beard", "Big Shades", "Bow Tie"],
    occurrenceNote: "Iconic Zulo-like stack; treat as high narrative value",
    rarityScore: 95,
    marketPremiumNote: "Often held as purist / identity pieces — premium over floor narrative",
  },
  {
    traits: ["Big Shades", "Bow Tie"],
    occurrenceNote: "Strong accessory pair frequently collected together",
    rarityScore: 88,
    marketPremiumNote: "May command premium vs bare commons",
  },
]

export interface TraitComboAdvice {
  isPremium: boolean
  premiumFactor: number
  matchedTraits: string[]
  advice: string
}

export function analyzeTraitCombo(
  traits: string[] | Record<string, string | number | boolean | null | undefined>,
): TraitComboAdvice {
  const list = Array.isArray(traits)
    ? traits.map(String)
    : Object.values(traits)
        .filter((v) => v != null && v !== "")
        .map(String)

  const listLower = list.map((t) => t.toLowerCase())

  for (const combo of PREMIUM_COMBOS) {
    const matched = combo.traits.every((t) =>
      listLower.some((owned) => owned.includes(t.toLowerCase()) || t.toLowerCase().includes(owned)),
    )
    if (matched) {
      return {
        isPremium: true,
        premiumFactor: 2,
        matchedTraits: combo.traits,
        advice: `Premium combo detected (${combo.traits.join(" + ")}). ${combo.occurrenceNote}. ${combo.marketPremiumNote}. DO NOT BURN without explicit intent.`,
      }
    }
  }

  return {
    isPremium: false,
    premiumFactor: 1,
    matchedTraits: [],
    advice:
      "No curated premium combo matched. Safe to evaluate for burns if rank is common and user goals favor AP over holding.",
  }
}
