// lib/agent-recommendations/canvasEvolution.ts
// Canvas Evolution Advisor — preview transforms + official bigger / blank canvas costs (facts, no score).

import { NORMIES_API_BASE } from "@/constants/contracts"
import { fetchWithTimeout } from "@/lib/fetch-with-timeout"

import {
  buildCanvasCostTable,
  CANON_CANVAS_PRICES,
  CANVAS_COST_SOURCES,
  describeCanvasCosts,
  enlargeCoveredNow,
  nextEnlargeCost,
  pricesFromStatus,
  type CanvasCostTable,
  type CanvasPrices,
} from "./canvasCosts"
import { ECOSYSTEM_LINKS, ZULO_IDENTITY } from "./constants"
import {
  apTierForPixelCount,
  levelFromActionPoints,
} from "./normiesKnowledge"

/** Current on-chain Normie grid (40×40). */
export const CANVAS_GRID_SIZE = 40
export const CANVAS_PIXEL_CAPACITY = CANVAS_GRID_SIZE * CANVAS_GRID_SIZE // 1600

/** Largest official canvas size (80×80, live since the Pixel Market launch). */
export const EXPANSION_GRID_SIZE = 80
export const EXPANSION_PIXEL_CAPACITY = EXPANSION_GRID_SIZE * EXPANSION_GRID_SIZE // 6400

/** Watch interval for Canvas Watch background scans. */
export const CANVAS_WATCH_INTERVAL_MS = 12 * 60 * 60 * 1000

/** Pixel-change fraction that triggers a significant-transform alert. */
export const SIGNIFICANT_TRANSFORM_PCT = 10

/** Canonical Canvas edit cost: 1 AP per pixel add or remove. */
export const AP_PER_PIXEL_EDIT = 1

export const CANVAS_EVOLUTION_DISCLAIMER =
  "Canvas previews are estimates from live Normies API state + your stated changes — not an on-chain simulation. Official customize uses #PIXEL as pixel budget (1 PIXEL = 1 pixel) in official Normies UI — not an AP debit. AP stays on the keeper; not spent when you draw or preview. CredHub / Normifier preview is not a spend rail. Aesthetic notes are heuristics. Bigger-canvas costs are the official prices (api.normies.art/canvas/status, NormiesCanvasV2): 900 / 2,000 / 3,300 / 4,800 #PIXEL in total for 50 / 60 / 70 / 80 per side; nothing here is scored. DYOR before transforming. Not financial advice."

export type CanvasVerdict = "PROCEED" | "MODIFY" | "ABANDON"

export interface ProposedCanvasChanges {
  /** Pixels to turn on (add dark pixels) */
  pixelsToAdd: number
  /** Pixels to turn off (remove dark pixels) */
  pixelsToRemove: number
  /** Free-text intent from user (optional) */
  description?: string
  /** Explicit token override from query */
  tokenId?: number
}

export interface CanvasInfoState {
  tokenId: number
  actionPoints: number
  level: number
  customized: boolean
  delegate?: string
  pixelCountOn: number
  pixelCountOff: number
  capacity: number
  originalPixelCountOn?: number
  /** Canvas side length from canvas/info (40 until enlarged). */
  gridSize: number
  /** Base art cleared (blank canvas bought). Null when the API did not say. */
  baseCleared: boolean | null
  /** Attached pixels backing the paint / not backing it (canvas/info). Null when the API did not say. */
  lockedPixels: number | null
  freePixels: number | null
  diff: {
    addedCount: number
    removedCount: number
    netChange: number
  }
  densityPct: number
}

export interface CanvasCostBreakdown {
  pixelsToAdd: number
  pixelsToRemove: number
  totalFlips: number
  apPerPixel: number
  /** Primary transform cost (1 AP × flips) */
  totalApCost: number
  availableAp: number
  remainingApAfter: number
  canAfford: boolean
  /**
   * Reference “tier rate” framing: mid-tier % of flip count
   * (burn-tier band applied as a secondary planning metric — not the on-chain edit fee).
   */
  tierRateMidPct: number
  tierRateReferenceAp: number
  notes: string
}

export interface AestheticAssessment {
  placementStrategy: string
  visualCoherence: string
  rarityImplications: string
  puristStatusImpact: string
  densityBeforePct: number
  densityAfterPct: number
  score: number // 0–100 heuristic quality of plan
}

export interface CanvasPreviewResult {
  scanned: boolean
  tokenId: number
  before: {
    pixelCountOn: number
    pixelCountOff: number
    actionPoints: number
    level: number
    customized: boolean
    densityPct: number
  }
  after: {
    pixelCountOn: number
    pixelCountOff: number
    actionPoints: number
    level: number
    customized: boolean
    densityPct: number
  }
  costBreakdown: CanvasCostBreakdown
  aesthetic: AestheticAssessment
  recommendation: CanvasVerdict
  reasoning: string[]
  confidence: number
  expansionHint?: string
  editorUrl: string
  disclaimer: string
  summary: string
  sources: string[]
}

/**
 * Official bigger / blank canvas costs for one Normie (replaces the old 0–100 planning score, 2026-11-10).
 * Every number is a price or a balance from api.normies.art; nothing is scored or judged.
 */
export interface CanvasCostsResult {
  scanned: boolean
  tokenId: number
  currentGrid: { size: number; capacity: number; baseCleared: boolean | null }
  actionPoints: number
  level: number
  customized: boolean
  pixels: { attached: number; locked: number | null; free: number | null }
  /** Wallet #PIXEL, only when the visitor's own wallet was given. */
  walletPixels: number | null
  costTable: CanvasCostTable | null
  facts: string[]
  sources: string[]
  asOf: string
  disclaimer: string
  summary: string
}

/** @deprecated Old name; the result is a cost table now, not a score. */
export type ExpansionReadinessResult = CanvasCostsResult

export interface CanvasWatchAlert {
  tokenId: number
  type: "significant_transform" | "first_edit" | "ap_surge" | "can_enlarge"
  message: string
  pixelChangePct: number | null
  beforePixelsOn: number | null
  afterPixelsOn: number
  at: string
}

export interface CanvasWatchResult {
  scanned: boolean
  intervalMs: number
  watched: number
  alerts: CanvasWatchAlert[]
  snapshots: Array<{
    tokenId: number
    pixelsOn: number
    actionPoints: number
    customized: boolean
    densityPct: number
    lastChecked: string
  }>
  nextDueAt: string | null
  summary: string
}

export interface CanvasEvolutionResult {
  scanned: boolean
  mode: "preview" | "expansion" | "watch" | "overview"
  preview?: CanvasPreviewResult
  expansion?: CanvasCostsResult
  watch?: CanvasWatchResult
  canvasState?: CanvasInfoState
  disclaimer: string
  summary: string
}

// ─── Query detection ─────────────────────────────────────────────────────────

const PREVIEW_PHRASES = [
  "preview canvas",
  "simulate edit",
  "canvas cost",
  "preview edit",
  "simulate transform",
  "canvas preview",
]

export function isCanvasEvolutionQuery(userQuery: string): boolean {
  const q = userQuery.toLowerCase().trim()
  if (!q) return false
  if (PREVIEW_PHRASES.some((p) => q.includes(p))) return true

  const keys = [
    "preview",
    "canvas",
    "edit",
    "transform",
    "simulate",
    "pixel",
    "expansion",
    "80x80",
    "80×80",
  ]
  if (keys.some((k) => q.includes(k))) return true
  return false
}

export function isCanvasPreviewQuery(userQuery: string): boolean {
  const q = userQuery.toLowerCase().trim()
  if (PREVIEW_PHRASES.some((p) => q.includes(p))) return true
  if (q.includes("simulate") || q.includes("preview")) return true
  if (q.includes("canvas cost") || q.includes("edit cost") || q.includes("transform cost")) {
    return true
  }
  // proposed change language
  if (
    (q.includes("add") || q.includes("remove") || q.includes("flip") || q.includes("paint")) &&
    (q.includes("pixel") || q.includes("canvas") || q.includes("edit"))
  ) {
    return true
  }
  return false
}

export function isCanvasExpansionQuery(userQuery: string): boolean {
  const q = userQuery.toLowerCase().trim()
  return (
    q.includes("expansion") ||
    q.includes("80x80") ||
    q.includes("80×80") ||
    q.includes("expand canvas") ||
    q.includes("bigger canvas") ||
    q.includes("enlarge") ||
    q.includes("blank canvas") ||
    q.includes("readiness")
  )
}

export function isCanvasWatchQuery(userQuery: string): boolean {
  const q = userQuery.toLowerCase().trim()
  return (
    q.includes("canvas watch") ||
    q.includes("watch canvas") ||
    q.includes("watchlist") ||
    (q.includes("monitor") && q.includes("canvas"))
  )
}

/** Extract token id and proposed add/remove counts from free text. */
export function parseProposedChanges(
  userQuery: string,
  fallbackTokenId?: number,
): ProposedCanvasChanges {
  const q = userQuery.toLowerCase()
  let tokenId = fallbackTokenId

  const tokenMatch =
    q.match(/(?:token\s*(?:id)?|normie|#)\s*(\d{1,4})\b/) ||
    q.match(/\b(\d{1,4})\b\s*(?:canvas|edit|transform|preview)/)
  if (tokenMatch) {
    const n = Number(tokenMatch[1])
    if (Number.isFinite(n) && n >= 0 && n <= 9999) tokenId = n
  }

  let pixelsToAdd = 0
  let pixelsToRemove = 0

  const addMatch = q.match(
    /(?:add|paint|draw|turn on|flip on)\s+(\d{1,4})\s*(?:px|pixels?|dots?)?/,
  )
  const remMatch = q.match(
    /(?:remove|erase|delete|turn off|flip off)\s+(\d{1,4})\s*(?:px|pixels?|dots?)?/,
  )
  const flipMatch = q.match(
    /(?:flip|change|edit|transform)\s+(\d{1,4})\s*(?:px|pixels?|dots?)?/,
  )
  const costMatch = q.match(/(?:cost|for)\s+(\d{1,4})\s*(?:px|pixels?)/)

  if (addMatch) pixelsToAdd = Number(addMatch[1]) || 0
  if (remMatch) pixelsToRemove = Number(remMatch[1]) || 0
  if (!pixelsToAdd && !pixelsToRemove && flipMatch) {
    // ambiguous flips — split evenly as add-heavy default
    const n = Number(flipMatch[1]) || 0
    pixelsToAdd = Math.ceil(n * 0.6)
    pixelsToRemove = Math.floor(n * 0.4)
  }
  if (!pixelsToAdd && !pixelsToRemove && costMatch) {
    pixelsToAdd = Number(costMatch[1]) || 0
  }

  // Default simulation when user asks preview without numbers
  if (
    !pixelsToAdd &&
    !pixelsToRemove &&
    (isCanvasPreviewQuery(userQuery) || userQuery.toLowerCase().includes("canvas"))
  ) {
    pixelsToAdd = 10
    pixelsToRemove = 0
  }

  return {
    pixelsToAdd: Math.max(0, Math.min(CANVAS_PIXEL_CAPACITY, pixelsToAdd)),
    pixelsToRemove: Math.max(0, Math.min(CANVAS_PIXEL_CAPACITY, pixelsToRemove)),
    description: userQuery.slice(0, 200),
    tokenId,
  }
}

// ─── Pixel helpers ───────────────────────────────────────────────────────────

export function countOnPixels(bitmap: string): number {
  let on = 0
  for (let i = 0; i < bitmap.length; i++) {
    if (bitmap[i] === "1") on++
  }
  return on
}

export function densityPct(pixelsOn: number, capacity = CANVAS_PIXEL_CAPACITY): number {
  if (capacity <= 0) return 0
  return Math.round((pixelsOn / capacity) * 1000) / 10
}

export function clampPixelsOn(on: number, capacity = CANVAS_PIXEL_CAPACITY): number {
  return Math.max(0, Math.min(capacity, Math.round(on)))
}

export function applyProposedPixelDelta(
  currentOn: number,
  changes: ProposedCanvasChanges,
  capacity = CANVAS_PIXEL_CAPACITY,
): { afterOn: number; actualAdd: number; actualRemove: number } {
  const room = capacity - currentOn
  const actualAdd = Math.min(changes.pixelsToAdd, room)
  const actualRemove = Math.min(changes.pixelsToRemove, currentOn)
  const afterOn = clampPixelsOn(currentOn + actualAdd - actualRemove, capacity)
  return { afterOn, actualAdd, actualRemove }
}

export function transformApCost(flips: number): number {
  return Math.max(0, Math.round(flips) * AP_PER_PIXEL_EDIT)
}

/** Tier-rate reference AP (planning metric, not edit fee). */
export function tierRateReferenceAp(flipCount: number, currentPixelsOn: number): {
  midPct: number
  referenceAp: number
  tierLabel: string
} {
  const tier = apTierForPixelCount(currentPixelsOn)
  const midPct = (tier.minPct + tier.maxPct) / 2
  const referenceAp = Math.floor((flipCount * midPct) / 100)
  return { midPct, referenceAp, tierLabel: tier.label }
}

// ─── Fetch live canvas ───────────────────────────────────────────────────────

type CanvasInfoPayload = {
  actionPoints?: number
  level?: number
  customized?: boolean
  delegate?: string
  gridSize?: number
  baseCleared?: boolean
  lockedPixels?: number
  freePixels?: number
}

type CanvasDiffPayload = {
  added?: Array<{ x?: number; y?: number }>
  removed?: Array<{ x?: number; y?: number }>
  addedCount?: number
  removedCount?: number
  netChange?: number
}

async function fetchText(url: string, timeoutMs = 6_000): Promise<string | null> {
  try {
    const res = await fetchWithTimeout(url, {}, timeoutMs)
    if (!res.ok) return null
    return (await res.text()).trim()
  } catch {
    return null
  }
}

async function fetchJson<T>(url: string, timeoutMs = 6_000): Promise<T | null> {
  try {
    const res = await fetchWithTimeout(url, { headers: { Accept: "application/json" } }, timeoutMs)
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

export async function fetchCanvasState(tokenId: number): Promise<CanvasInfoState | null> {
  if (!Number.isFinite(tokenId) || tokenId < 0 || tokenId > 9999) return null

  const [info, diff, pixels, original] = await Promise.all([
    fetchJson<CanvasInfoPayload>(`${NORMIES_API_BASE}/normie/${tokenId}/canvas/info`),
    fetchJson<CanvasDiffPayload>(`${NORMIES_API_BASE}/normie/${tokenId}/canvas/diff`),
    fetchText(`${NORMIES_API_BASE}/normie/${tokenId}/pixels`),
    fetchText(`${NORMIES_API_BASE}/normie/${tokenId}/original/pixels`),
  ])

  if (!info && !pixels) return null

  const pixelCountOn = pixels ? countOnPixels(pixels) : 0
  const originalOn = original ? countOnPixels(original) : undefined
  const addedCount =
    typeof diff?.addedCount === "number"
      ? diff.addedCount
      : Array.isArray(diff?.added)
        ? diff.added.length
        : 0
  const removedCount =
    typeof diff?.removedCount === "number"
      ? diff.removedCount
      : Array.isArray(diff?.removed)
        ? diff.removed.length
        : 0
  const netChange =
    typeof diff?.netChange === "number" ? diff.netChange : addedCount - removedCount

  const actionPoints = typeof info?.actionPoints === "number" ? info.actionPoints : 0
  const level =
    typeof info?.level === "number" ? info.level : levelFromActionPoints(actionPoints)

  return {
    tokenId,
    actionPoints,
    level,
    customized: !!info?.customized || addedCount > 0 || removedCount > 0,
    delegate: info?.delegate,
    pixelCountOn,
    pixelCountOff: CANVAS_PIXEL_CAPACITY - pixelCountOn,
    capacity: CANVAS_PIXEL_CAPACITY,
    originalPixelCountOn: originalOn,
    gridSize: typeof info?.gridSize === "number" && info.gridSize > 0 ? info.gridSize : CANVAS_GRID_SIZE,
    baseCleared: typeof info?.baseCleared === "boolean" ? info.baseCleared : null,
    lockedPixels: typeof info?.lockedPixels === "number" ? info.lockedPixels : null,
    freePixels: typeof info?.freePixels === "number" ? info.freePixels : null,
    diff: { addedCount, removedCount, netChange },
    densityPct: densityPct(pixelCountOn),
  }
}

// ─── Preview ─────────────────────────────────────────────────────────────────

function assessAesthetic(input: {
  beforeOn: number
  afterOn: number
  add: number
  remove: number
  customized: boolean
  rarityRank?: number | null
  isPremium?: boolean
}): AestheticAssessment {
  const densityBeforePct = densityPct(input.beforeOn)
  const densityAfterPct = densityPct(input.afterOn)
  const delta = input.afterOn - input.beforeOn
  const totalOps = input.add + input.remove

  let placementStrategy: string
  if (input.add > 0 && input.remove === 0) {
    placementStrategy =
      "Additive pass — densifying silhouette. Prefer contiguous strokes (eyes/hair edges) over scatter noise."
  } else if (input.remove > 0 && input.add === 0) {
    placementStrategy =
      "Subtractive carve — opening negative space. Keep facial landmarks readable; avoid swiss-cheese faces."
  } else if (input.add > 0 && input.remove > 0) {
    placementStrategy =
      "Balanced remodel — relocating mass. Treat as composition rewrite; preview in Normifier before commit."
  } else {
    placementStrategy = "No pixel delta proposed — state review only."
  }

  let coherenceScore = 70
  if (totalOps > 200) coherenceScore -= 20
  else if (totalOps > 50) coherenceScore -= 10
  if (Math.abs(delta) > 100) coherenceScore -= 10
  if (input.add > 0 && input.remove > 0) coherenceScore -= 5
  if (totalOps > 0 && totalOps <= 20) coherenceScore += 10

  const visualCoherence =
    coherenceScore >= 75
      ? "Plan looks surgically small — high chance of coherent micro-edit."
      : coherenceScore >= 55
        ? "Moderate remodel — visual identity may shift; stage edits in batches."
        : "Large transform — high risk of losing recognizable Normie silhouette."

  let rarityImplications =
    "Trait rarity (Type/Hair/etc.) is on-chain deterministic and not changed by Canvas pixels — impact is narrative/aesthetic, not trait rank."
  if (input.rarityRank != null && input.rarityRank <= 500) {
    rarityImplications += ` Rarity rank #${input.rarityRank} (normies.art rarity, from the original Pixel Count and traits; editing never changes it).`
  }
  if (input.isPremium) {
    rarityImplications += " Trait combo on Zulo's curated list (see trait supply facts); edits change the art, not the traits."
  }

  const puristStatusImpact = !input.customized
    ? totalOps > 0
      ? "First edit will end untouched/purist status permanently for this Normie."
      : "Still untouched — purist status intact until first transform."
    : "Already customized — purist premium already forfeited; optimize for aesthetic utility."

  let score = coherenceScore
  if (!input.customized && totalOps > 0) score -= 8
  if (input.isPremium && totalOps > 30) score -= 12
  score = Math.max(0, Math.min(100, score))

  return {
    placementStrategy,
    visualCoherence,
    rarityImplications,
    puristStatusImpact,
    densityBeforePct,
    densityAfterPct,
    score,
  }
}

function decideVerdict(input: {
  canAfford: boolean
  totalApCost: number
  availableAp: number
  customized: boolean
  totalFlips: number
  isPremium?: boolean
  rarityRank?: number | null
  aestheticScore: number
}): { verdict: CanvasVerdict; reasoning: string[]; confidence: number } {
  const reasoning: string[] = []
  let confidence = 72

  if (input.totalFlips <= 0) {
    return {
      verdict: "MODIFY",
      reasoning: [
        "No pixel changes specified — describe adds/removes (e.g. “add 12 pixels, remove 3”) for a concrete preview.",
      ],
      confidence: 55,
    }
  }

  if (!input.canAfford) {
    reasoning.push(
      `ABANDON path: this preview is ${input.totalApCost} px of official #PIXEL budget; AP holdings on this token are ${input.availableAp} (holdings, not a canvas price). AP is not spent when you draw.`,
    )
    reasoning.push("Pixels on the Normie set how many pixels may differ from the original; this edit needs more than it has. A smaller edit fits; #PIXEL comes from burns or the Pixel Market (vibe check on /burn, not financial advice).")
    return { verdict: "ABANDON", reasoning, confidence: 88 }
  }

  if (input.isPremium && input.totalFlips > 40) {
    reasoning.push("Trait combo on Zulo's curated list + a large remodel: the face will look very different (traits stay the same).")
    return {
      verdict: "ABANDON",
      reasoning: [
        ...reasoning,
        "A micro-edit (≤15 flips) keeps the face recognisable; preview it on Normifier first.",
      ],
      confidence: 80,
    }
  }

  if (!input.customized && (input.rarityRank ?? 9999) <= 1000 && input.totalFlips > 25) {
    reasoning.push("Untouched so far, rarity rank in the top 1,000: a non-trivial first edit ends its untouched status for good.")
    return {
      verdict: "MODIFY",
      reasoning: [
        ...reasoning,
        "Shrink scope or confirm intentional art direction before first transform.",
      ],
      confidence: 78,
    }
  }

  if (input.totalApCost > input.availableAp * 0.5 && input.availableAp > 0) {
    reasoning.push(
      `This preview is ${input.totalApCost} px of official #PIXEL budget against ${input.availableAp} AP holdings on the keeper — not an AP debit. Stage smaller commits if you want more room to iterate.`,
    )
    return {
      verdict: "MODIFY",
      reasoning: [
        ...reasoning,
        "Stage into smaller commits or lower flip count.",
      ],
      confidence: 74,
    }
  }

  if (input.aestheticScore < 50) {
    reasoning.push("Aesthetic coherence score is low for this magnitude of change.")
    return {
      verdict: "MODIFY",
      reasoning: [...reasoning, "Batch edits and preview each stage in Normifier."],
      confidence: 70,
    }
  }

  reasoning.push(
    `Official #PIXEL budget ${input.totalApCost} px vs ${input.availableAp} AP holdings on the keeper (not an AP debit) with acceptable aesthetic risk score ${input.aestheticScore}/100.`,
  )
  if (!input.customized) {
    reasoning.push("Note: first transform ends purist/untouched status.")
    confidence -= 5
  }
  reasoning.push("PROCEED only after Normifier visual check and intentional composition plan.")
  return { verdict: "PROCEED", reasoning, confidence: Math.max(60, Math.min(92, confidence)) }
}

/**
 * On-demand Canvas Preview: live state + proposed changes → cost, aesthetics, verdict.
 */
export async function previewCanvas(
  tokenId: number,
  changes: ProposedCanvasChanges,
  opts?: { rarityRank?: number | null; isPremium?: boolean },
): Promise<CanvasPreviewResult> {
  const sources = [
    `${NORMIES_API_BASE}/normie/${tokenId}/canvas/info`,
    `${NORMIES_API_BASE}/normie/${tokenId}/canvas/diff`,
    `${NORMIES_API_BASE}/normie/${tokenId}/pixels`,
    ECOSYSTEM_LINKS.canvasEdit(tokenId),
    ECOSYSTEM_LINKS.normifier,
  ]

  const state = await fetchCanvasState(tokenId)
  if (!state) {
    return {
      scanned: true,
      tokenId,
      before: {
        pixelCountOn: 0,
        pixelCountOff: CANVAS_PIXEL_CAPACITY,
        actionPoints: 0,
        level: 1,
        customized: false,
        densityPct: 0,
      },
      after: {
        pixelCountOn: 0,
        pixelCountOff: CANVAS_PIXEL_CAPACITY,
        actionPoints: 0,
        level: 1,
        customized: false,
        densityPct: 0,
      },
      costBreakdown: {
        pixelsToAdd: changes.pixelsToAdd,
        pixelsToRemove: changes.pixelsToRemove,
        totalFlips: changes.pixelsToAdd + changes.pixelsToRemove,
        apPerPixel: AP_PER_PIXEL_EDIT,
        totalApCost: transformApCost(changes.pixelsToAdd + changes.pixelsToRemove),
        availableAp: 0,
        remainingApAfter: 0,
        canAfford: false,
        tierRateMidPct: 2.5,
        tierRateReferenceAp: 0,
        notes: "Could not load Canvas state from Normies API.",
      },
      aesthetic: {
        placementStrategy: "n/a",
        visualCoherence: "n/a",
        rarityImplications: "n/a",
        puristStatusImpact: "n/a",
        densityBeforePct: 0,
        densityAfterPct: 0,
        score: 0,
      },
      recommendation: "ABANDON",
      reasoning: ["Canvas state unavailable — retry later or check api.normies.art."],
      confidence: 20,
      editorUrl: ECOSYSTEM_LINKS.canvasEdit(tokenId),
      disclaimer: CANVAS_EVOLUTION_DISCLAIMER,
      summary: `Canvas Preview #${tokenId}: API unavailable.`,
      sources,
    }
  }

  const { afterOn, actualAdd, actualRemove } = applyProposedPixelDelta(
    state.pixelCountOn,
    changes,
  )
  const totalFlips = actualAdd + actualRemove
  const totalApCost = transformApCost(totalFlips)
  const remainingApAfter = state.actionPoints - totalApCost
  const canAfford = remainingApAfter >= 0
  const tierRef = tierRateReferenceAp(totalFlips, state.pixelCountOn)

  const costBreakdown: CanvasCostBreakdown = {
    pixelsToAdd: actualAdd,
    pixelsToRemove: actualRemove,
    totalFlips,
    apPerPixel: AP_PER_PIXEL_EDIT,
    totalApCost,
    availableAp: state.actionPoints,
    remainingApAfter,
    canAfford,
    tierRateMidPct: tierRef.midPct,
    tierRateReferenceAp: tierRef.referenceAp,
    notes: `Official customize uses #PIXEL as pixel budget (${totalFlips} px if committed in official UI) — not an AP debit. AP holdings on this token: ${state.actionPoints} (stay on the keeper). CredHub / Normifier preview is not a spend rail. Tier-rate reference (${tierRef.tierLabel} mid ${tierRef.midPct}%) ≈ ${tierRef.referenceAp} is a burn-band planning metric only.`,
  }

  const aesthetic = assessAesthetic({
    beforeOn: state.pixelCountOn,
    afterOn,
    add: actualAdd,
    remove: actualRemove,
    customized: state.customized,
    rarityRank: opts?.rarityRank,
    isPremium: opts?.isPremium,
  })

  const { verdict, reasoning, confidence } = decideVerdict({
    canAfford,
    totalApCost,
    availableAp: state.actionPoints,
    customized: state.customized,
    totalFlips,
    isPremium: opts?.isPremium,
    rarityRank: opts?.rarityRank,
    aestheticScore: aesthetic.score,
  })

  const afterAp = Math.max(0, remainingApAfter)
  const next = nextEnlargeCost(state.gridSize)
  const expansionHint = next
    ? `${state.actionPoints} #PIXEL attached${state.freePixels != null ? ` (${state.freePixels} free)` : ""}; the next canvas size, ${next.size}×${next.size}, costs ${next.cost.toLocaleString("en-US")} #PIXEL (official). Wallet #PIXEL can also pay.`
    : `Already at ${state.gridSize}×${state.gridSize}, the largest official size.`

  const summary = [
    `Canvas Preview #${tokenId}: ${verdict} (confidence ${confidence}%)`,
    `Before ${state.pixelCountOn}/1600 on-px → after ${afterOn}/1600 (add ${actualAdd}, remove ${actualRemove}).`,
    `Official #PIXEL budget ${totalFlips} px (1 PIXEL = 1 pixel) · AP holdings ${state.actionPoints} stay on the keeper · not an AP debit.`,
    "Burn yield is set by the original Pixel Count (contract), so editing the art does not change what a burn would pay.",
    aesthetic.puristStatusImpact,
    ...reasoning.slice(0, 3),
    CANVAS_EVOLUTION_DISCLAIMER,
  ].join("\n")

  return {
    scanned: true,
    tokenId,
    before: {
      pixelCountOn: state.pixelCountOn,
      pixelCountOff: state.pixelCountOff,
      actionPoints: state.actionPoints,
      level: state.level,
      customized: state.customized,
      densityPct: state.densityPct,
    },
    after: {
      pixelCountOn: afterOn,
      pixelCountOff: CANVAS_PIXEL_CAPACITY - afterOn,
      actionPoints: afterAp,
      level: levelFromActionPoints(afterAp),
      customized: state.customized || totalFlips > 0,
      densityPct: densityPct(afterOn),
    },
    costBreakdown,
    aesthetic,
    recommendation: verdict,
    reasoning,
    confidence,
    expansionHint,
    editorUrl: ECOSYSTEM_LINKS.canvasEdit(tokenId),
    disclaimer: CANVAS_EVOLUTION_DISCLAIMER,
    summary,
    sources,
  }
}

// ─── Bigger / blank canvas costs (official) ──────────────────────────────────

const PRICE_TTL_MS = 5 * 60_000
let priceCache: { at: number; prices: CanvasPrices } | null = null

/** Official prices read from the chain via api.normies.art/canvas/status (5-minute cache); canon if the read fails. */
export async function fetchCanvasPrices(): Promise<CanvasPrices> {
  if (priceCache && Date.now() - priceCache.at < PRICE_TTL_MS) return priceCache.prices
  const raw = await fetchJson<unknown>(CANVAS_COST_SOURCES.prices)
  const prices = pricesFromStatus(raw) ?? CANON_CANVAS_PRICES
  if (prices.from === "chain") priceCache = { at: Date.now(), prices }
  return prices
}

/** The wallet's loose #PIXEL (api.normies.art/pixels/balance). Null when no wallet or the read fails. */
async function fetchWalletPixels(address?: string | null): Promise<number | null> {
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) return null
  const raw = await fetchJson<{ balance?: unknown }>(`${NORMIES_API_BASE}/pixels/balance/${address}`)
  const b = raw?.balance
  const v = typeof b === "number" ? b : typeof b === "string" && /^\d+$/.test(b) ? Number(b) : null
  return v != null && Number.isFinite(v) ? v : null
}

/**
 * Official cost of every bigger size (and the blank canvas) from where this Normie is now, with the gap to its free
 * pixels, its attached pixels and (only for the visitor's own wallet) the wallet's #PIXEL, and the Level after paying
 * from the Normie. Facts only: no score, no "ready", no advice on where #PIXEL should come from.
 */
export async function analyzeCanvasCosts(
  tokenId: number,
  opts?: { walletAddress?: string | null; isZombie?: boolean },
): Promise<CanvasCostsResult> {
  const [state, prices, walletPixels] = await Promise.all([
    fetchCanvasState(tokenId),
    fetchCanvasPrices(),
    fetchWalletPixels(opts?.walletAddress),
  ])
  const asOf = new Date().toISOString()
  const sources = [CANVAS_COST_SOURCES.info(tokenId), CANVAS_COST_SOURCES.prices, CANVAS_COST_SOURCES.docs, CANVAS_COST_SOURCES.contract]

  if (!state) {
    return {
      scanned: true,
      tokenId,
      currentGrid: { size: CANVAS_GRID_SIZE, capacity: CANVAS_PIXEL_CAPACITY, baseCleared: null },
      actionPoints: 0,
      level: 1,
      customized: false,
      pixels: { attached: 0, locked: null, free: null },
      walletPixels,
      costTable: null,
      facts: ["Could not load this Normie's canvas from the Normies API, so no costs are shown. Try again in a minute."],
      sources,
      asOf,
      disclaimer: CANVAS_EVOLUTION_DISCLAIMER,
      summary: `Canvas costs #${tokenId}: unavailable (Normies API unreachable).`,
    }
  }

  const pixels = { attached: state.actionPoints, locked: state.lockedPixels, free: state.freePixels }
  const costTable = buildCanvasCostTable({
    gridSize: state.gridSize,
    baseCleared: state.baseCleared,
    isZombie: opts?.isZombie,
    pixels,
    walletPixels,
    prices,
  })
  const facts = describeCanvasCosts(costTable, tokenId, asOf)

  return {
    scanned: true,
    tokenId,
    currentGrid: { size: state.gridSize, capacity: state.gridSize * state.gridSize, baseCleared: state.baseCleared },
    actionPoints: state.actionPoints,
    level: state.level,
    customized: state.customized,
    pixels,
    walletPixels,
    costTable,
    facts,
    sources,
    asOf,
    disclaimer: CANVAS_EVOLUTION_DISCLAIMER,
    summary: [`Canvas costs #${tokenId} (official prices):`, ...facts, CANVAS_EVOLUTION_DISCLAIMER].join("\n"),
  }
}

/** @deprecated Old name: it returns official costs now, not a score. */
export const analyzeExpansionReadiness = analyzeCanvasCosts

// ─── Canvas Watch (12h monitoring) ───────────────────────────────────────────

type WatchSnapshot = {
  tokenId: number
  pixelsOn: number
  actionPoints: number
  customized: boolean
  densityPct: number
  at: number
}

const watchStore = new Map<number, WatchSnapshot>()
let lastWatchRunAt = 0

export function getDefaultWatchlist(): number[] {
  const fromEnv = process.env.CANVAS_WATCHLIST?.split(/[,\s]+/)
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n >= 0 && n <= 9999)
  const base = fromEnv?.length ? fromEnv : [ZULO_IDENTITY.tokenId]
  return [...new Set(base)].slice(0, 25)
}

export function addToCanvasWatchlist(tokenId: number): void {
  if (!Number.isFinite(tokenId) || tokenId < 0 || tokenId > 9999) return
  if (!watchStore.has(tokenId)) {
    // placeholder until first scan
    watchStore.set(tokenId, {
      tokenId,
      pixelsOn: -1,
      actionPoints: 0,
      customized: false,
      densityPct: 0,
      at: 0,
    })
  }
}

/**
 * Scan watchlist for significant Canvas activity.
 * Intended for cron every 12h or on-demand "canvas watch" queries.
 */
export async function runCanvasWatch(options?: {
  tokenIds?: number[]
  force?: boolean
}): Promise<CanvasWatchResult> {
  const now = Date.now()
  if (
    !options?.force &&
    lastWatchRunAt > 0 &&
    now - lastWatchRunAt < CANVAS_WATCH_INTERVAL_MS
  ) {
    const snapshots = [...watchStore.values()]
      .filter((s) => s.pixelsOn >= 0)
      .map((s) => ({
        tokenId: s.tokenId,
        pixelsOn: s.pixelsOn,
        actionPoints: s.actionPoints,
        customized: s.customized,
        densityPct: s.densityPct,
        lastChecked: new Date(s.at).toISOString(),
      }))
    return {
      scanned: true,
      intervalMs: CANVAS_WATCH_INTERVAL_MS,
      watched: snapshots.length,
      alerts: [],
      snapshots,
      nextDueAt: new Date(lastWatchRunAt + CANVAS_WATCH_INTERVAL_MS).toISOString(),
      summary: `Canvas Watch: next full scan due ${new Date(lastWatchRunAt + CANVAS_WATCH_INTERVAL_MS).toISOString()} (12h cadence). ${snapshots.length} snapshot(s) cached.`,
    }
  }

  const ids = options?.tokenIds?.length ? options.tokenIds : getDefaultWatchlist()
  for (const id of ids) addToCanvasWatchlist(id)

  const alerts: CanvasWatchAlert[] = []
  const snapshots: CanvasWatchResult["snapshots"] = []

  await Promise.all(
    ids.map(async (tokenId) => {
      const state = await fetchCanvasState(tokenId)
      if (!state) return

      const prev = watchStore.get(tokenId)
      const prevPixels = prev && prev.pixelsOn >= 0 ? prev.pixelsOn : null
      const prevCustomized = prev?.customized

      let pixelChangePct: number | null = null
      if (prevPixels != null && prevPixels > 0) {
        pixelChangePct =
          Math.round((Math.abs(state.pixelCountOn - prevPixels) / prevPixels) * 1000) / 10
      } else if (prevPixels === 0 && state.pixelCountOn > 0) {
        pixelChangePct = 100
      }

      if (
        pixelChangePct != null &&
        pixelChangePct >= SIGNIFICANT_TRANSFORM_PCT
      ) {
        alerts.push({
          tokenId,
          type: "significant_transform",
          message: `Significant Canvas transform on #${tokenId}: ~${pixelChangePct}% pixel change (${prevPixels} → ${state.pixelCountOn} on-px).`,
          pixelChangePct,
          beforePixelsOn: prevPixels,
          afterPixelsOn: state.pixelCountOn,
          at: new Date().toISOString(),
        })
      }

      if (prevCustomized === false && state.customized) {
        alerts.push({
          tokenId,
          type: "first_edit",
          message: `#${tokenId} lost purist/untouched status (first Canvas edit detected).`,
          pixelChangePct,
          beforePixelsOn: prevPixels,
          afterPixelsOn: state.pixelCountOn,
          at: new Date().toISOString(),
        })
      }

      if (prev && prev.actionPoints >= 0 && state.actionPoints >= prev.actionPoints + 50) {
        alerts.push({
          tokenId,
          type: "ap_surge",
          message: `#${tokenId} AP surged ${prev.actionPoints} → ${state.actionPoints}.`,
          pixelChangePct: null,
          beforePixelsOn: prevPixels,
          afterPixelsOn: state.pixelCountOn,
          at: new Date().toISOString(),
        })
      }

      // Official cost of the next size up (900 from 40×40). Alerts when the attached pixels first cover it.
      const next = enlargeCoveredNow(state.actionPoints, state.gridSize, prev?.actionPoints)
      if (next) {
        alerts.push({
          tokenId,
          type: "can_enlarge",
          message: `#${tokenId} has ${state.actionPoints} #PIXEL attached; the next canvas size, ${next.size}×${next.size}, costs ${next.cost.toLocaleString("en-US")} (official).`,
          pixelChangePct: null,
          beforePixelsOn: prevPixels,
          afterPixelsOn: state.pixelCountOn,
          at: new Date().toISOString(),
        })
      }

      watchStore.set(tokenId, {
        tokenId,
        pixelsOn: state.pixelCountOn,
        actionPoints: state.actionPoints,
        customized: state.customized,
        densityPct: state.densityPct,
        at: now,
      })

      snapshots.push({
        tokenId,
        pixelsOn: state.pixelCountOn,
        actionPoints: state.actionPoints,
        customized: state.customized,
        densityPct: state.densityPct,
        lastChecked: new Date(now).toISOString(),
      })
    }),
  )

  lastWatchRunAt = now
  const nextDueAt = new Date(now + CANVAS_WATCH_INTERVAL_MS).toISOString()

  const summary = [
    `Canvas Watch: scanned ${snapshots.length} token(s); ${alerts.length} alert(s).`,
    alerts.length
      ? alerts.map((a) => a.message).join(" ")
      : "No significant transforms (≥10% pixel change) since last snapshot.",
    `Next scheduled cadence: 12h (due ${nextDueAt}).`,
    CANVAS_EVOLUTION_DISCLAIMER,
  ].join("\n")

  return {
    scanned: true,
    intervalMs: CANVAS_WATCH_INTERVAL_MS,
    watched: snapshots.length,
    alerts,
    snapshots,
    nextDueAt,
    summary,
  }
}

/**
 * Unified advisor entry used by strategy skill routing.
 */
export async function runCanvasEvolution(input: {
  userQuery: string
  focusTokenId: number
  rarityRank?: number | null
  isPremium?: boolean
  watchlist?: number[]
  /** The visitor's own wallet, only when it owns the focus Normie: adds a wallet #PIXEL line to the cost table. */
  walletAddress?: string | null
  isZombie?: boolean
}): Promise<CanvasEvolutionResult> {
  const q = input.userQuery
  const proposed = parseProposedChanges(q, input.focusTokenId)
  const tokenId = proposed.tokenId ?? input.focusTokenId

  const wantPreview = isCanvasPreviewQuery(q)
  const wantExpansion = isCanvasExpansionQuery(q)
  const wantWatch = isCanvasWatchQuery(q)

  // Default: if general canvas keywords, provide overview (state + expansion + light preview)
  const mode: CanvasEvolutionResult["mode"] = wantWatch
    ? "watch"
    : wantExpansion && !wantPreview
      ? "expansion"
      : wantPreview
        ? "preview"
        : "overview"

  const canvasState = await fetchCanvasState(tokenId)

  let preview: CanvasPreviewResult | undefined
  let expansion: ExpansionReadinessResult | undefined
  let watch: CanvasWatchResult | undefined

  if (mode === "preview" || mode === "overview") {
    preview = await previewCanvas(tokenId, proposed, {
      rarityRank: input.rarityRank,
      isPremium: input.isPremium,
    })
  }
  if (mode === "expansion" || mode === "overview" || mode === "watch") {
    expansion = await analyzeCanvasCosts(tokenId, { walletAddress: input.walletAddress, isZombie: input.isZombie })
  }
  if (mode === "watch" || mode === "overview") {
    const list = [
      ...(input.watchlist ?? getDefaultWatchlist()),
      tokenId,
      ...(input.focusTokenId !== tokenId ? [input.focusTokenId] : []),
    ]
    watch = await runCanvasWatch({
      tokenIds: [...new Set(list)].slice(0, 15),
      force: wantWatch || mode === "overview",
    })
  }

  const parts: string[] = [`Canvas Evolution Advisor (${mode}) · #${tokenId}`]
  if (canvasState) {
    parts.push(
      `Live: ${canvasState.pixelCountOn}/1600 on-px, ${canvasState.actionPoints} AP, L${canvasState.level}, ${canvasState.customized ? "customized" : "untouched"}, density ${canvasState.densityPct}%. Diff +${canvasState.diff.addedCount}/-${canvasState.diff.removedCount}.`,
    )
  }
  if (preview) parts.push(preview.summary)
  if (expansion) parts.push(expansion.summary)
  if (watch) parts.push(watch.summary)

  return {
    scanned: true,
    mode,
    preview,
    expansion,
    watch,
    canvasState: canvasState ?? undefined,
    disclaimer: CANVAS_EVOLUTION_DISCLAIMER,
    summary: parts.join("\n\n"),
  }
}
