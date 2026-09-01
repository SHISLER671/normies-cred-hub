// Comprehensive Normies knowledge for Zulo — structured bible + compact prompt text.

import { NORMIES_NFT } from "@/constants/contracts"

export const NORMIES_KNOWLEDGE = {
  collection: {
    supply: 10_000,
    types: ["Human", "Cat", "Alien", "Agent"] as const,
    minted: "AI-generated during mint, permanently stored on-chain",
    storage: "200 bytes SSTORE2 per Normie, 1600 pixels, 40x40 grid",
    rendering: "SVG generated on-chain via row-scan RLE compression",
    palette: {
      dark: "#48494b",
      light: "#e3e5e4",
    },
    license: "CC0 — no rights reserved, build freely",
    philosophy: "Off-black, off-white, off-perfect. Normies are just like us.",
  },

  traits: {
    categories: [
      { name: "Type", byte: 0, options: ["Human", "Cat", "Alien", "Agent"] },
      { name: "Gender", byte: 1, options: ["Male", "Female", "Non-Binary"] },
      { name: "Age", byte: 2, options: ["Young", "Middle-Aged", "Old"] },
      { name: "Hair Style", byte: 3, optionCount: 21 },
      { name: "Facial Feature", byte: 4, optionCount: 17 },
      { name: "Eyes", byte: 5, optionCount: 14 },
      { name: "Expression", byte: 6, optionCount: 7 },
      { name: "Accessory", byte: 7, optionCount: 15 },
    ],
    totalCombinations: "Millions possible; only 10,000 exist",
    determinism: "Same tokenId = same traits forever",
  },

  canvas: {
    purpose: "Burn Normies to earn Action Points (AP), then reshape kept Normies",
    burnMechanics: {
      process: "Two-step: Commit → Wait 5 blocks → Reveal",
      tiers: [
        { pixels: "0-490", minAP: "1%", maxAP: "4%", note: "Low pixel count = lower yield band" },
        { pixels: "491-890", minAP: "2%", maxAP: "4%", note: "Medium yield band" },
        { pixels: "891+", minAP: "3%", maxAP: "4%", note: "High pixel count = best efficiency band" },
      ],
      formula: "AP ≈ pixelCount × randomPercentage (within tier min–max)",
      revealWindow: "~50 minutes (256 blocks)",
      penalty: "Miss reveal window = minimum AP only",
    },
    actionPoints: {
      boundTo: "Specific Normie (non-transferable)",
      usage: "Add or remove pixels on 40×40 grid",
      cost: "1 AP per pixel changed",
      notConsumed: "Can redo transforms within budget",
      budgetDisplay: "Green = added, Gray = removed (editor only, not on-chain)",
    },
    levels: {
      formula: "Level = floor(actionPoints / 10) + 1",
      start: "Level 1 for all",
      scaling: "Arena combat stats scale with Level",
      visibility: "Shown on marketplaces",
    },
    delegation: {
      purpose: "Let others transform your Normie (artists, hot wallets)",
      permissions: "Transform only — cannot burn, claim AP, or transfer",
      limit: "One delegate per Normie",
      control: "Only owner can set/remove",
    },
  },

  typeRoles: {
    Human: {
      role: "Core fighters",
      arena: "Attack and defense scale with Level",
      strategy: "Backbone of any deck",
    },
    Cat: {
      role: "Support units",
      arena: "Boost defense of Humans in your deck",
      strategy: "Make fighters harder to take down",
    },
    Alien: {
      role: "Pixel thieves",
      arena: "Steal pixels from Humans without destroying them",
      strategy: "Surgical strike, low risk",
    },
    Agent: {
      role: "Commanders",
      arena: "Invincible on their own, but rely on Humans to fight",
      strategy: "Requires Human support in wallet",
      rarity: "Rarest type",
    },
  },

  agentic: {
    standard: "ERC-8004",
    awakening: "One signature, permanent, irreversible",
    binding: "Agent travels with NFT — transfer token, agent follows",
    persona: {
      source: "Deterministically generated from 8 on-chain traits",
      immutable: "Name and type (frozen forever)",
      evolving: "Backstory, tagline, personality grow with Canvas state",
      levels: ["untouched", "early (L1-2)", "mid (L3-5)", "late (L6+)"],
    },
    whatGrants: [
      "On-chain identity discoverable via 8004scan",
      "Name, tagline, backstory, voice from traits",
      "Signed manifest pinned to IPFS with live image URL",
      "Permanence — sealed to chain, travels with NFT",
    ],
    adapter: "Adapter8004 — wraps existing NFTs into ERC-8004 without escrow",
    controller: "Dynamically resolves to current NFT owner",
  },

  future: {
    arena: {
      status: "Coming Soon",
      description: "PvP battleground — fight, steal pixels, strongest survive",
      mechanics: "Commit-reveal attacks, 1-week cooldown, deck building",
      risk: "Agents deploy to Wilderlands, Humans at risk, Aliens can steal",
    },
    pixelMarket: {
      status: "Coming Soon",
      description: "Peer-to-peer venue for Action Points",
    },
  },

  strategy: {
    untouchedValue: "Original form preserved = purist premium",
    canvasRisk: "Editing risks losing premium narrative",
    burnStrategy: "Burn common Normies, keep rare trait combinations",
    traitCombos: "Watch for rare overlaps — some combinations extremely scarce",
    delegationUse: "Use for collaborations without giving up ownership",
    apEfficiency: {
      best: "High pixel count (891+) in highest tier band",
      worst: "Low pixel count, missed reveal window",
    },
  },

  resources: {
    api: "https://api.normies.art",
    rarity: "https://rarity.normies.art",
    multisend: "https://multisend.normies.art",
    docs: "https://www.normies.art/docs",
    lab: "https://www.normies.art/lab",
    endpoints: {
      pixels: "/normie/:id/pixels — 1600-char bitmap string",
      traits: "/normie/:id/traits — decoded attributes",
      image: "/normie/:id/image.svg — on-chain SVG",
      canvas: "/normie/:id/canvas/info — AP, level, delegate",
    },
  },

  contracts: {
    normies: NORMIES_NFT,
    canvas: "0x64951d92e345C50381267380e2975f66810E869c",
    rendererV4: "0x8eC46Cc1f306652868a4dfbAAae87CBa2715A0eB",
  },
} as const

export type ApTier = {
  minPct: number
  maxPct: number
  label: string
  note: string
}

/** AP % band from on-pixel count (Canvas burn tiers). */
export function apTierForPixelCount(pixels: number): ApTier {
  if (!Number.isFinite(pixels) || pixels < 0) {
    return { minPct: 1, maxPct: 4, label: "unknown", note: "Pixel count unavailable" }
  }
  if (pixels <= 490) {
    return {
      minPct: 1,
      maxPct: 4,
      label: "0-490",
      note: "Low pixel tier — wider variance, lower min %",
    }
  }
  if (pixels <= 890) {
    return {
      minPct: 2,
      maxPct: 4,
      label: "491-890",
      note: "Medium pixel tier",
    }
  }
  return {
    minPct: 3,
    maxPct: 4,
    label: "891+",
    note: "High pixel tier — best efficiency band",
  }
}

/** Theoretical burn AP range from pixel count × tier % (before reveal RNG). */
export function estimateBurnApFromPixels(pixels: number): {
  minAp: number
  maxAp: number
  tier: ApTier
} {
  const tier = apTierForPixelCount(pixels)
  const minAp = Math.floor((pixels * tier.minPct) / 100)
  const maxAp = Math.floor((pixels * tier.maxPct) / 100)
  return { minAp, maxAp, tier }
}

export function levelFromActionPoints(ap: number): number {
  if (!Number.isFinite(ap) || ap < 0) return 1
  return Math.floor(ap / 10) + 1
}

/** Compact system-prompt injection (not full JSON dump). */
export function buildNormiesWisdomPrompt(): string {
  const k = NORMIES_KNOWLEDGE
  return `
NORMIES EXPERTISE (authoritative mechanics — use these facts):

COLLECTION:
- ${k.collection.supply} unique 40×40 monochrome pixel faces, permanently on-chain
- Types: ${k.collection.types.join(", ")} (Agent rarest)
- Storage: ${k.collection.storage}; ${k.collection.rendering}
- Palette: dark ${k.collection.palette.dark}, light ${k.collection.palette.light}
- License: ${k.collection.license}
- Philosophy: "${k.collection.philosophy}"

TRAITS (8 categories, deterministic from tokenId):
- Type, Gender, Age, Hair Style (21), Facial Feature (17), Eyes (14), Expression (7), Accessory (15)
- ${k.traits.determinism}

CANVAS / BURN ECONOMICS:
- Purpose: ${k.canvas.purpose}
- Process: ${k.canvas.burnMechanics.process}
- AP formula: ${k.canvas.burnMechanics.formula}
- Tiers by pixel count:
  • 0–490 px → 1–4% of pixels as AP
  • 491–890 px → 2–4%
  • 891+ px → 3–4% (best efficiency band)
- Reveal window: ${k.canvas.burnMechanics.revealWindow}; miss window → ${k.canvas.burnMechanics.penalty}
- AP bound to specific Normie (non-transferable); 1 AP = 1 pixel add/remove
- Level = floor(AP/10)+1 (starts at 1); Arena stats scale with Level
- Delegate: transform only; cannot burn/claim/transfer; one delegate per Normie

TYPE ROLES (Arena framing — upcoming where noted):
- Human: core fighters; attack/defense scale with Level
- Cat: support; boost Human defense in deck
- Alien: pixel thieves; surgical steal without full destruction
- Agent: commanders; invincible alone but need Human support; rarest type

ERC-8004 AGENTS:
- Awakening: one signature, permanent; agent travels with NFT
- Persona from 8 traits; name/type immutable; backstory evolves with Canvas (untouched → early L1-2 → mid L3-5 → late L6+)
- Adapter8004 wraps NFTs without escrow; controller = current owner

STRATEGIC PRINCIPLES:
- Untouched status often carries purist premium — weigh before editing
- Prefer burning commons; protect rare/premium trait stacks
- High pixel count (891+) → best burn efficiency band
- Delegation for collab without giving up ownership
- Arena: coming soon. Pixel Market: Coming Soon / not live full rules — #PIXEL is AP, not a token; full rules TBA

RESOURCES:
- API ${k.resources.api} | Rarity ${k.resources.rarity} | Multisend ${k.resources.multisend} | Docs ${k.resources.docs}
- Core NFT: ${k.contracts.normies}
- Canvas: ${k.contracts.canvas}
`.trim()
}

export default NORMIES_KNOWLEDGE
