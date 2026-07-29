// lib/agent-recommendations/canvasEvolution.ts
// Canvas Evolution Advisor — preview transforms + 80×80 expansion readiness.

import { NORMIES_API_BASE } from "@/constants/contracts"
import { fetchWithTimeout } from "@/lib/fetch-with-timeout"

import { ECOSYSTEM_LINKS, ZULO_IDENTITY } from "./constants"
import {
  apTierForPixelCount,
  estimateBurnApFromPixels,
  levelFromActionPoints,
} from "./normiesKnowledge"

/** Current on-chain Normie grid (40×40). */
export const CANVAS_GRID_SIZE = 40
export const CANVAS_PIXEL_CAPACITY = CANVAS_GRID_SIZE * CANVAS_GRID_SIZE // 1600

/** Planned expansion target (80×80). */
export const EXPANSION_GRID_SIZE = 80
export const EXPANSION_PIXEL_CAPACITY = EXPANSION_GRID_SIZE * EXPANSION_GRID_SIZE // 6400

/** Watch interval for Canvas Watch background scans. */
export const CANVAS_WATCH_INTERVAL_MS = 12 * 60 * 60 * 1000

/** Pixel-change fraction that triggers a significant-transform alert. */
export const SIGNIFICANT_TRANSFORM_PCT = 10

/** Canonical Canvas edit cost: 1 AP per pixel add or remove. */
export const AP_PER_PIXEL_EDIT = 1

export const CANVAS_EVOLUTION_DISCLAIMER =
  "Canvas previews are estimates from live Normies API state + your stated changes — not an on-chain simulation. AP cost uses 1 AP per pixel flip (add/remove). Aesthetic/rarity notes are heuristics. 80×80 expansion readiness is forward-looking and not a guarantee of protocol features. DYOR before transforming. Not financial advice."

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

export interface ExpansionReadinessResult {
  scanned: boolean
  tokenId: number
  currentGrid: { size: number; capacity: number; pixelsOn: number; densityPct: number }
  targetGrid: { size: number; capacity: number }
  actionPoints: number
  level: number
  customized: boolean
  /** 0–100 readiness toward 80×80 era utility */
  readinessScore: number
  apReadiness: { score: number; note: string }
  densityReadiness: { score: number; note: string }
  levelReadiness: { score: number; note: string }
  milestones: string[]
  blockers: string[]
  recommendation: string
  disclaimer: string
  summary: string
}

export interface CanvasWatchAlert {
  tokenId: number
  type: "significant_transform" | "first_edit" | "ap_surge" | "expansion_ready"
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
  expansion?: ExpansionReadinessResult
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
    rarityImplications +=
      " High rarity rank piece — market often prices purist/untouched canvases at a premium; edit carefully."
  }
  if (input.isPremium) {
    rarityImplications += " Premium trait combo detected — avoid casual edits that dilute identity."
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
      `ABANDON path: transform costs ${input.totalApCost} AP but only ${input.availableAp} AP available on this Canvas.`,
    )
    reasoning.push("Burn fodder into this Normie or reduce edit scope before transforming.")
    return { verdict: "ABANDON", reasoning, confidence: 88 }
  }

  if (input.isPremium && input.totalFlips > 40) {
    reasoning.push("Premium trait stack + large remodel — high identity risk.")
    return {
      verdict: "ABANDON",
      reasoning: [
        ...reasoning,
        "Recommend ABANDON or shrink to a micro-edit (≤15 flips) with Normifier preview.",
      ],
      confidence: 80,
    }
  }

  if (!input.customized && (input.rarityRank ?? 9999) <= 1000 && input.totalFlips > 25) {
    reasoning.push("Untouched mid/high rarity — purist premium at stake for a non-trivial first edit.")
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
      `Edit uses ${Math.round((input.totalApCost / input.availableAp) * 100)}% of remaining AP — leave headroom for later polish.`,
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
    `Affordable (${input.totalApCost} AP ≤ ${input.availableAp} AP) with acceptable aesthetic risk score ${input.aestheticScore}/100.`,
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
    notes: `On-chain edit fee = ${AP_PER_PIXEL_EDIT} AP × ${totalFlips} flips = ${totalApCost} AP. Tier-rate reference (${tierRef.tierLabel} mid ${tierRef.midPct}%) ≈ ${tierRef.referenceAp} AP is a burn-band planning metric only — not the edit fee.`,
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
  const beforeBurn = estimateBurnApFromPixels(state.pixelCountOn)
  const afterBurn = estimateBurnApFromPixels(afterOn)

  const expansionHint =
    state.actionPoints >= 50
      ? `AP cushion present (${state.actionPoints}) — also review 80×80 expansion readiness.`
      : `Low AP (${state.actionPoints}) — expansion readiness likely blocked until more burns fund this Canvas.`

  const summary = [
    `Canvas Preview #${tokenId}: ${verdict} (confidence ${confidence}%)`,
    `Before ${state.pixelCountOn}/1600 on-px → after ${afterOn}/1600 (add ${actualAdd}, remove ${actualRemove}).`,
    `Cost ${totalApCost} AP (${AP_PER_PIXEL_EDIT}/px) · available ${state.actionPoints} AP · remaining ${remainingApAfter}.`,
    `Burn-tier band before ~${beforeBurn.minAp}–${beforeBurn.maxAp} AP vs after ~${afterBurn.minAp}–${afterBurn.maxAp} AP (if burned as fodder later).`,
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

// ─── Expansion readiness (80×80) ─────────────────────────────────────────────

/**
 * Score readiness for planned 80×80 expansion era (AP stockpile, density, level).
 */
export async function analyzeExpansionReadiness(
  tokenId: number,
): Promise<ExpansionReadinessResult> {
  const state = await fetchCanvasState(tokenId)

  if (!state) {
    return {
      scanned: true,
      tokenId,
      currentGrid: {
        size: CANVAS_GRID_SIZE,
        capacity: CANVAS_PIXEL_CAPACITY,
        pixelsOn: 0,
        densityPct: 0,
      },
      targetGrid: { size: EXPANSION_GRID_SIZE, capacity: EXPANSION_PIXEL_CAPACITY },
      actionPoints: 0,
      level: 1,
      customized: false,
      readinessScore: 0,
      apReadiness: { score: 0, note: "Canvas state unavailable" },
      densityReadiness: { score: 0, note: "n/a" },
      levelReadiness: { score: 0, note: "n/a" },
      milestones: [],
      blockers: ["Could not load Canvas from Normies API"],
      recommendation: "Retry expansion check when API is reachable.",
      disclaimer: CANVAS_EVOLUTION_DISCLAIMER,
      summary: `Expansion readiness #${tokenId}: unavailable.`,
    }
  }

  // Heuristic targets for "expansion-ready" operators
  const AP_TARGET = 200
  const DENSITY_SWEET_MIN = 25
  const DENSITY_SWEET_MAX = 75
  const LEVEL_TARGET = 10

  const apScore = Math.min(100, Math.round((state.actionPoints / AP_TARGET) * 100))
  const dens = state.densityPct
  let densityScore = 100
  if (dens < DENSITY_SWEET_MIN) densityScore = Math.round((dens / DENSITY_SWEET_MIN) * 80)
  else if (dens > DENSITY_SWEET_MAX) {
    densityScore = Math.round(80 - ((dens - DENSITY_SWEET_MAX) / (100 - DENSITY_SWEET_MAX)) * 40)
  }
  densityScore = Math.max(0, Math.min(100, densityScore))

  const levelScore = Math.min(100, Math.round((state.level / LEVEL_TARGET) * 100))

  const readinessScore = Math.round(apScore * 0.5 + densityScore * 0.25 + levelScore * 0.25)

  const milestones: string[] = [
    `Current grid ${CANVAS_GRID_SIZE}×${CANVAS_GRID_SIZE} (${CANVAS_PIXEL_CAPACITY} px) → target ${EXPANSION_GRID_SIZE}×${EXPANSION_GRID_SIZE} (${EXPANSION_PIXEL_CAPACITY} px).`,
    `AP ${state.actionPoints}/${AP_TARGET} planning target (level ${state.level}).`,
    `Density ${dens}% (sweet band ~${DENSITY_SWEET_MIN}–${DENSITY_SWEET_MAX}% for flexible expansion art).`,
  ]

  const blockers: string[] = []
  if (state.actionPoints < 50) {
    blockers.push("Low AP — burn fodder into this Normie to fund future expansion edits.")
  }
  if (dens > 90) {
    blockers.push("Very high density — little headroom; consider subtractive cleanup before expansion era.")
  }
  if (dens < 10) {
    blockers.push("Very sparse canvas — build a coherent base composition first.")
  }
  if (!state.customized && state.actionPoints > 0) {
    milestones.push("Still purist — expansion prep edits will end untouched status.")
  }

  let recommendation: string
  if (readinessScore >= 75) {
    recommendation =
      "Strong expansion readiness — stockpile AP, keep composition modular, watch protocol announcements for 80×80 rails."
  } else if (readinessScore >= 45) {
    recommendation =
      "Moderate readiness — prioritize AP accumulation and a clear 40×40 composition before expansion."
  } else {
    recommendation =
      "Early stage — focus on AP income (strategic burns) and small intentional Canvas practice edits."
  }

  const summary = [
    `80×80 Expansion Readiness #${tokenId}: score ${readinessScore}/100`,
    `AP ${state.actionPoints} (score ${apScore}), density ${dens}% (score ${densityScore}), level ${state.level} (score ${levelScore}).`,
    recommendation,
    blockers[0] ?? "No critical blockers.",
    CANVAS_EVOLUTION_DISCLAIMER,
  ].join("\n")

  return {
    scanned: true,
    tokenId,
    currentGrid: {
      size: CANVAS_GRID_SIZE,
      capacity: CANVAS_PIXEL_CAPACITY,
      pixelsOn: state.pixelCountOn,
      densityPct: dens,
    },
    targetGrid: { size: EXPANSION_GRID_SIZE, capacity: EXPANSION_PIXEL_CAPACITY },
    actionPoints: state.actionPoints,
    level: state.level,
    customized: state.customized,
    readinessScore,
    apReadiness: {
      score: apScore,
      note: `${state.actionPoints} AP vs ${AP_TARGET} planning target`,
    },
    densityReadiness: {
      score: densityScore,
      note: `${dens}% on-pixel density`,
    },
    levelReadiness: {
      score: levelScore,
      note: `Level ${state.level} vs target ${LEVEL_TARGET}`,
    },
    milestones,
    blockers,
    recommendation,
    disclaimer: CANVAS_EVOLUTION_DISCLAIMER,
    summary,
  }
}

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

      // Expansion readiness light check
      if (state.actionPoints >= 200 && state.densityPct >= 25 && state.densityPct <= 75) {
        alerts.push({
          tokenId,
          type: "expansion_ready",
          message: `#${tokenId} looks expansion-ready (AP ${state.actionPoints}, density ${state.densityPct}%).`,
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
    expansion = await analyzeExpansionReadiness(tokenId)
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
