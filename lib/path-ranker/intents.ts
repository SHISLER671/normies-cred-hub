// Intent tags, chips, and keyword parser (no LLM).

import {
  getAllZuloSkills,
  type ZuloSkillId,
} from "@/lib/agent-recommendations/skillsCatalog"

import type { IntentTag, ParsedIntent } from "./types"

export type IntentChip = {
  tag: IntentTag
  label: string
  /** Short placeholder / hint */
  hint: string
}

/** Closed chip set for the Path Board UI. */
export const INTENT_CHIPS: IntentChip[] = [
  { tag: "pulse", label: "Check Pulse", hint: "Trust score & gaps" },
  { tag: "burn", label: "Burn smarter", hint: "AP per ETH fodder" },
  { tag: "market", label: "Market read", hint: "Floor, whales, volume" },
  { tag: "canvas", label: "Canvas next", hint: "Edits, AP, expansion" },
  { tag: "identity", label: "Agent identity", hint: "Awaken & ERC-8004" },
  { tag: "access", label: "What can I use?", hint: "Gated vs open tools" },
  { tag: "strategy", label: "Highest-signal move", hint: "General next step" },
]

export const ALL_INTENT_TAGS: IntentTag[] = INTENT_CHIPS.map((c) => c.tag)

export function isIntentTag(value: unknown): value is IntentTag {
  return (
    typeof value === "string" &&
    (ALL_INTENT_TAGS as string[]).includes(value)
  )
}

/** Skill id → primary intent tags */
const SKILL_TO_TAGS: Record<ZuloSkillId, IntentTag[]> = {
  "burn-efficiency": ["burn"],
  "market-sentinel": ["market"],
  "gacha-raffle": ["market", "strategy"],
  "canvas-evolution": ["canvas"],
  "pulse-analysis": ["pulse"],
  "holder-chat": ["strategy"],
}

/** Keyword / phrase → intent tag (case-insensitive substring) */
const KEYWORD_MAP: Array<{ tag: IntentTag; patterns: string[] }> = [
  {
    tag: "pulse",
    patterns: [
      "pulse",
      "trust",
      "reputation",
      "cred hub",
      "credhub",
      "credibility",
      "how strong",
      "agent check",
      "agentcheck",
    ],
  },
  {
    tag: "burn",
    patterns: [
      "burn",
      "fodder",
      "ap yield",
      "action points",
      "efficiency",
      "scan burns",
      "reveal",
    ],
  },
  {
    tag: "market",
    patterns: [
      "market",
      "floor",
      "whale",
      "sentinel",
      "listing",
      "opensea",
      "price",
      "gacha",
      "raffle",
    ],
  },
  {
    tag: "canvas",
    patterns: [
      "canvas",
      "transform",
      "pixel",
      "80x80",
      "expansion",
      "normifier",
      "edit my",
      "preview canvas",
    ],
  },
  {
    tag: "identity",
    patterns: [
      "awaken",
      "erc-8004",
      "erc8004",
      "agent card",
      "identity",
      "register",
      "lab",
      "persona",
    ],
  },
  {
    tag: "access",
    patterns: [
      "access",
      "gated",
      "can i use",
      "what can i",
      "holder only",
      "predicate",
      "tools i can",
    ],
  },
  {
    tag: "strategy",
    patterns: [
      "strategy",
      "next move",
      "what should i",
      "highest-signal",
      "highest signal",
      "recommend",
      "help me",
    ],
  },
]

/**
 * Parse free-text intent and/or chip tag into ranked intent tags.
 * Pure — no network, no LLM.
 */
export function parseIntent(input: {
  intent?: string
  intentTag?: IntentTag
}): ParsedIntent {
  const raw = (input.intent ?? "").trim()
  const tags = new Set<IntentTag>()

  if (input.intentTag && isIntentTag(input.intentTag)) {
    tags.add(input.intentTag)
  }

  const lower = raw.toLowerCase()

  if (lower) {
    for (const { tag, patterns } of KEYWORD_MAP) {
      for (const p of patterns) {
        if (lower.includes(p)) {
          tags.add(tag)
          break
        }
      }
    }

    // Skill catalog triggers (reuse product vocabulary)
    for (const skill of getAllZuloSkills()) {
      for (const trigger of skill.triggers) {
        if (trigger && lower.includes(trigger.toLowerCase())) {
          for (const t of SKILL_TO_TAGS[skill.id] ?? ["strategy"]) {
            tags.add(t)
          }
        }
      }
    }
  }

  // Soft fallback so we always have a ranking axis
  if (tags.size === 0) {
    tags.add("strategy")
  }

  const ordered = orderTags([...tags], input.intentTag)
  return {
    raw,
    tags: ordered,
    primary: ordered[0] ?? "strategy",
  }
}

function orderTags(tags: IntentTag[], preferred?: IntentTag): IntentTag[] {
  const priority: IntentTag[] = [
    "pulse",
    "burn",
    "market",
    "canvas",
    "identity",
    "access",
    "strategy",
  ]
  const set = new Set(tags)
  const out: IntentTag[] = []
  if (preferred && set.has(preferred)) {
    out.push(preferred)
    set.delete(preferred)
  }
  for (const t of priority) {
    if (set.has(t)) out.push(t)
  }
  return out
}

/** Tags associated with a Zulo skill id. */
export function tagsForSkill(skillId: ZuloSkillId): IntentTag[] {
  return SKILL_TO_TAGS[skillId] ?? ["strategy"]
}

/**
 * Relevance overlap: how well candidate tags match parsed intent tags.
 * Returns 0–1.
 */
export function tagOverlapScore(
  candidateTags: IntentTag[],
  intentTags: IntentTag[],
): number {
  if (intentTags.length === 0) return 0.3
  if (candidateTags.length === 0) return 0.15

  const intentSet = new Set(intentTags)
  let hits = 0
  for (const t of candidateTags) {
    if (intentSet.has(t)) hits += 1
  }
  // Primary tag match is worth more
  const primary = intentTags[0]
  const primaryHit = primary && candidateTags.includes(primary) ? 0.35 : 0
  const ratio = hits / Math.max(intentTags.length, 1)
  return Math.min(1, primaryHit + ratio * 0.65)
}

/**
 * Soft keyword relevance against free-text intent (0–1).
 */
export function keywordRelevanceScore(
  keywords: string[],
  intentRaw: string,
): number {
  const q = intentRaw.toLowerCase().trim()
  if (!q || keywords.length === 0) return 0

  let hits = 0
  for (const kw of keywords) {
    const k = kw.toLowerCase()
    if (k.length < 2) continue
    if (q.includes(k)) hits += 1
  }
  if (hits === 0) return 0
  return Math.min(1, hits * 0.25)
}
