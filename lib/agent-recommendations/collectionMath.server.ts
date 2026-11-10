// Server-only loader for Ask's collection math. Reads the same cached index snapshot /burn uses (public, read-only
// normie_index in Supabase, refreshed daily from api.normies.art) and the same yield-mode clock. Never throws: on any
// failure Ask answers without the block and says the totals could not be read.

import { realDeps } from "@/lib/burn-buy/data"
import { currentYieldMode } from "@/lib/burn-buy/switches"

import { computeCollectionMath, type CollectionMath } from "./collectionMath"

const LOAD_BUDGET_MS = 9_000

export async function loadCollectionMath(now: Date = new Date()): Promise<CollectionMath | null> {
  try {
    const snap = await Promise.race([
      realDeps.loadSnapshot(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), LOAD_BUDGET_MS)),
    ])
    if (!snap || snap.originalPixels.size === 0) return null
    return computeCollectionMath(snap, currentYieldMode(now), "NCH index of api.normies.art (original pixel counts, refreshed daily)")
  } catch {
    return null
  }
}
