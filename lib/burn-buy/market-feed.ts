// A short, never-throwing read of the Pixel Market's public order book (api.normies.art /market/stats and /market/depth).
// Documented in api.normies.art/llms.txt: prices and volumes are wei strings; /market/* is cached 10 s upstream and 404s until the market is configured.
// The upstream allows 60 requests per minute per IP, so callers cache this (see data.ts) instead of fetching per visitor.

import { weiToEth, type DepthLevel, type PixelMarketSnapshot } from "./market-math"

const BASE = "https://api.normies.art/market"
const MAX_LEVELS = 40

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null)

/** Strict: anything that is not the documented shape is null, so a changed API can never produce a made-up price. */
export function parseMarketStats(stats: unknown, depth: unknown, asOf: string): PixelMarketSnapshot | null {
  if (!stats || typeof stats !== "object" || !depth || typeof depth !== "object") return null
  const s = stats as Record<string, unknown>
  const feeBps = num(s.feeBps)
  const revenueShareBps = num(s.revenueShareBps)
  const activeListings = num(s.activeListings)
  if (feeBps === null || revenueShareBps === null || feeBps > 10_000 || revenueShareBps > 10_000 || activeListings === null || typeof s.paused !== "boolean") return null
  const levelsRaw = (depth as Record<string, unknown>).levels
  if (!Array.isArray(levelsRaw)) return null
  const levels: DepthLevel[] = []
  for (const l of levelsRaw) {
    if (!l || typeof l !== "object") return null
    const o = l as Record<string, unknown>
    const priceEth = weiToEth(o.pricePerPixel)
    const remaining = num(o.remaining)
    const partialRemaining = num(o.partialRemaining)
    if (priceEth === null || priceEth <= 0 || remaining === null || partialRemaining === null) return null
    levels.push({ priceEth, remaining, partialRemaining })
  }
  levels.sort((a, b) => a.priceEth - b.priceEth)
  const pixelsListedFromStats = num(typeof s.pixelsListed === "string" ? Number(s.pixelsListed) : s.pixelsListed)
  return {
    asOf,
    bestAskEth: weiToEth(s.bestAskWei),
    lastPriceEth: weiToEth(s.lastPriceWei),
    volume24hEth: weiToEth(s.volume24hWei) ?? 0,
    pixels24h: num(s.pixels24h) ?? 0,
    activeListings,
    pixelsListed: pixelsListedFromStats ?? levels.reduce((n, l) => n + l.remaining, 0),
    feeBps,
    revenueShareBps,
    paused: s.paused,
    depth: levels.slice(0, MAX_LEVELS),
  }
}

export async function loadPixelMarket(fetchImpl: typeof fetch = fetch, timeoutMs = 3_000): Promise<PixelMarketSnapshot | null> {
  try {
    const get = async (path: string) => {
      const res = await fetchImpl(`${BASE}/${path}`, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(timeoutMs) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json()
    }
    const [stats, depth] = await Promise.all([get("stats"), get("depth")])
    return parseMarketStats(stats, depth, new Date().toISOString())
  } catch {
    return null
  }
}
