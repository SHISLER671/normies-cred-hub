// lib/agent-recommendations/traitAnalysis.ts
// Curated trait combinations (Zulo's own list, not exhaustive), reported as neutral trait-supply FACTS.
// No value, premium or burn/keep language here (AGENTS.md: burn and keep views are fenced to /burn).

export interface TraitCombo {
  traits: string[]
  /** Why the combo is on the list: a description, never a value claim. */
  note: string
  /** @deprecated Kept for old imports; not shown anywhere. */
  rarityScore: number
}

/** Zulo's curated combos. Being on this list says nothing about price or whether to burn or keep. */
export const PREMIUM_COMBOS: TraitCombo[] = [
  { traits: ["Shadow Beard", "Big Shades", "Bow Tie"], note: "the same three traits as Zulo's own Normie, #7141", rarityScore: 95 },
  { traits: ["Big Shades", "Bow Tie"], note: "an accessory pair Zulo tracks", rarityScore: 88 },
]

export interface TraitSupply {
  trait_type?: string
  value?: string
  /** Live Normies with this trait (normies.art rarity traitBreakdown). */
  count?: number
  /** Percent of live supply. */
  frequency?: number
}

export interface TraitComboAdvice {
  /** True when the traits match a combo on the curated list (a label, not a value judgment). */
  isPremium: boolean
  /** @deprecated Always 1; no trait combo is weighted as "worth more". */
  premiumFactor: number
  matchedTraits: string[]
  /** Neutral facts: which combo matched and how many live Normies carry each trait. */
  advice: string
}

function supplyLine(traits: string[], supply?: TraitSupply[]): string {
  if (!supply?.length) return "Trait supply: see normies.art rarity."
  const parts = traits.map((t) => {
    const row = supply.find((s) => String(s.value ?? "").toLowerCase() === t.toLowerCase())
    return row && typeof row.count === "number"
      ? `${t} ${row.count.toLocaleString("en-US")}${typeof row.frequency === "number" ? ` (${row.frequency}%)` : ""}`
      : `${t} (count not reported)`
  })
  return `Live Normies with each trait (normies.art rarity, from original traits): ${parts.join(", ")}.`
}

export function analyzeTraitCombo(
  traits: string[] | Record<string, string | number | boolean | null | undefined>,
  supply?: TraitSupply[],
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
        premiumFactor: 1,
        matchedTraits: combo.traits,
        advice: `Trait combo on Zulo's curated list (${combo.traits.join(" + ")}): ${combo.note}. ${supplyLine(combo.traits, supply)} The list is Zulo's own and says nothing about price; burn or keep is the holder's call (vibe check on /burn, not financial advice).`,
      }
    }
  }

  return {
    isPremium: false,
    premiumFactor: 1,
    matchedTraits: [],
    advice: "No combo from Zulo's curated list matched. Trait supply: see normies.art rarity.",
  }
}
