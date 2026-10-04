// Jev (TypeSafe System One) as a cautious SECOND OPINION on burn candidates. Dark by default: nothing here runs unless
// PIXEL_MARKET=live AND a TYPESAFE_API_KEY exists (see lib/burn-buy/data.ts).
//
// Design rules (Ryan, 2026-10-04: prep it so going live is a switch flip):
//  - Jev is a TRIPWIRE, never a decider. It can only add caution ("you might regret this, double-check"). It never turns a
//    keep into a burn, and it never changes a verdict. The doctrine and the rules stay the source of truth.
//  - Only PUBLIC facts about a Normie are sent (traits, pixel counts, rarity). Never a wallet address or ENS name.
//  - It fails safe: any error means no opinion, and the page answers exactly as it does without Jev.
//  - One request covers all candidates (the docs recommend asking questions together; they run in parallel).
//
// API contract (docs.typesafe.ai/api, read 2026-10-04): POST https://api.typesafe.ai/v1/systemone,
// Authorization: Bearer <key>, body { state, model, questions }. A noul answer is { type: "noul", noul: 0..1 }.
// Not stated by the docs (so UNKNOWN here): pricing, latency limits, data retention, request size limits.

import { fetchWithRetry } from "@/lib/fetch-with-retry"

export const JEV_ENDPOINT = "https://api.typesafe.ai/v1/systemone"
/**
 * Optional TYPESAFE_BASE_URL (the name TypeSafe's own SDK uses) overrides the API root, for an AI gateway, a proxy or a local
 * stand-in when testing. It must follow the TypeSafe API spec (same /v1/systemone path). Unset = the official API.
 */
export const jevEndpoint = () => {
  const base = process.env.TYPESAFE_BASE_URL?.trim().replace(/\/+$/, "")
  return base ? `${base}/v1/systemone` : JEV_ENDPOINT
}
export const JEV_MODEL = "jev-latest"
/** One request, at most this many Normies: keeps cost, latency and request size small. */
export const JEV_MAX_TOKENS = 8
/**
 * One try, 4 s. Jev is optional and the page has 20 s in total: 8 s x 2 tries plus a retry wait (about 18 s) could
 * outlast the page after slow holder and token lookups. A missed second opinion costs nothing; a timed-out page costs the answer.
 */
export const JEV_TIMEOUT_MS = 4_000
export const JEV_ATTEMPTS = 1
const CACHE_TTL_MS = 6 * 60 * 60 * 1000

/**
 * Starting thresholds, NOT tuned: the docs say to test on your own data. They lean cautious on purpose because a burn
 * is permanent: a false alarm costs a second look, a missed one costs a Normie.
 */
export const REGRET_DOUBLE_CHECK = 0.5
export const REGRET_AGREES_BELOW = 0.2

export type JevVerdict = "double-check" | "unsure" | "agrees"
export interface JevOpinion {
  /** Jev's probability (0 to 1) that the holder would regret burning this Normie. */
  pRegret: number
  verdict: JevVerdict
}

/** Public facts about one Normie. Deliberately has no wallet field. */
export interface JevToken {
  tokenId: number
  traits: Record<string, string | number>
  originalPixels: number
  /** How many living Normies share this exact original pixel count. */
  pixelSupply: number
  actionPoints: number
  level: number
  rank: number | null
  awakenedAgent: boolean
  customized: boolean
}

export function verdictFor(pRegret: number): JevVerdict {
  if (pRegret >= REGRET_DOUBLE_CHECK) return "double-check"
  if (pRegret < REGRET_AGREES_BELOW) return "agrees"
  return "unsure"
}

const TRAIT_KEYS: Array<[string, string]> = [
  ["Type", "type"], ["Gender", "gender"], ["Age", "age"], ["Hair Style", "hairStyle"], ["Facial Feature", "facialFeature"],
  ["Eyes", "eyes"], ["Expression", "expression"], ["Accessory", "accessory"],
]

export const questionId = (tokenId: number) => `n${tokenId}`

export function buildJevRequest(tokens: JevToken[]) {
  const normies = tokens.map((t) => {
    const traits: Record<string, string | number> = {}
    for (const [from, to] of TRAIT_KEYS) if (t.traits[from] !== undefined) traits[to] = t.traits[from]
    return {
      id: t.tokenId,
      ...traits,
      originalPixelCount: t.originalPixels,
      livingNormiesWithThatExactPixelCount: t.pixelSupply,
      actionPoints: t.actionPoints,
      level: t.level,
      rarityRankOutOf10000: t.rank,
      awakenedAgent: t.awakenedAgent,
      customizedByItsOwner: t.customized,
    }
  })
  const questions: Record<string, unknown> = {}
  for (const t of tokens) {
    questions[questionId(t.tokenId)] = {
      type: "noul",
      instructions:
        `Would the holder of Normie #${t.tokenId} plausibly regret burning it? Burning destroys a Normie for good. ` +
        "Consider whether this specific face is distinctive or charming, whether its pixel count or rarity is unusual, " +
        "and whether its owner has customized it.",
      criteria: {
        true: "Yes: it is distinctive, unusual, customized or otherwise likely to be missed.",
        false: "No: it is an ordinary, interchangeable face with nothing unusual about it.",
      },
    }
  }
  return {
    state: {
      situation:
        "A Normie holder is deciding whether to burn some of their Normies (small on-chain pixel faces) to earn #PIXEL. " +
        "A burn is permanent. Each Normie below is a burn candidate that the usual rules did not flag as a keeper.",
      normies,
    },
    model: JEV_MODEL,
    questions,
  }
}

export class JevError extends Error {
  constructor(public kind: "auth" | "rate" | "overloaded" | "invalid" | "network" | "bad-response", message: string) {
    super(message)
  }
}

/** Reads each noul answer; anything missing or outside 0..1 is skipped (no opinion), never guessed. */
export function parseJevResponse(json: unknown, tokenIds: number[]): Record<number, JevOpinion> {
  const out: Record<number, JevOpinion> = {}
  const answers = (json as { answers?: Record<string, { type?: string; noul?: unknown }> } | null)?.answers
  if (!answers || typeof answers !== "object") throw new JevError("bad-response", "Jev returned no answers")
  for (const id of tokenIds) {
    const a = answers[questionId(id)]
    const p = a && a.type === "noul" ? Number(a.noul) : NaN
    if (Number.isFinite(p) && p >= 0 && p <= 1) out[id] = { pRegret: Math.round(p * 1000) / 1000, verdict: verdictFor(p) }
  }
  return out
}

type CacheEntry = { at: number; opinion: JevOpinion }
const sharedCache = new Map<string, CacheEntry>()
const cacheKey = (t: JevToken) => `${t.tokenId}|${t.originalPixels}|${t.actionPoints}|${t.customized ? 1 : 0}|${t.pixelSupply}`

export interface JevDeps {
  apiKey: string
  fetcher?: typeof fetchWithRetry
  now?: () => number
  cache?: Map<string, CacheEntry>
}

export async function fetchJevOpinions(
  allTokens: JevToken[],
  { apiKey, fetcher = fetchWithRetry, now = Date.now, cache = sharedCache }: JevDeps,
): Promise<{ opinions: Record<number, JevOpinion> }> {
  const tokens = allTokens.slice(0, JEV_MAX_TOKENS)
  const opinions: Record<number, JevOpinion> = {}
  const missing: JevToken[] = []
  for (const t of tokens) {
    const hit = cache.get(cacheKey(t))
    if (hit && now() - hit.at < CACHE_TTL_MS) opinions[t.tokenId] = hit.opinion
    else missing.push(t)
  }
  if (missing.length === 0) return { opinions }

  let res: Response
  try {
    res = await fetcher(
      jevEndpoint(),
      { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify(buildJevRequest(missing)) },
      JEV_TIMEOUT_MS,
      { attempts: JEV_ATTEMPTS },
    )
  } catch (e) {
    throw new JevError("network", `Jev could not be reached: ${e instanceof Error ? e.message : e}`)
  }
  if (res.status === 401) throw new JevError("auth", "Jev rejected the API key")
  if (res.status === 422) throw new JevError("invalid", "Jev rejected the request")
  if (res.status === 429) throw new JevError("rate", "Jev is rate limiting us")
  if (res.status === 529) throw new JevError("overloaded", "Jev is overloaded")
  if (!res.ok) throw new JevError("bad-response", `Jev returned HTTP ${res.status}`)

  let json: unknown
  try { json = await res.json() } catch { throw new JevError("bad-response", "Jev returned something that is not JSON") }
  const fresh = parseJevResponse(json, missing.map((t) => t.tokenId))
  for (const t of missing) {
    const o = fresh[t.tokenId]
    if (o) { opinions[t.tokenId] = o; cache.set(cacheKey(t), { at: now(), opinion: o }) }
  }
  return { opinions }
}
