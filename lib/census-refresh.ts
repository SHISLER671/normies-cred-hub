// Plan a refresh of normie_index's moving columns (action points, edited-art flag, burned) from the official bulk rarity list.
// Pure: no I/O. The script (scripts/refresh-census.ts) fetches, calls this, and only then writes.
//
// What it refreshes: action_points, level, customized, and burned (a living Normie that is absent from a COMPLETE bulk list has been burned).
// What it does NOT touch: owner (the bulk list carries no owners), delegate, on_pixels (immutable), indexed_at.

export interface BulkRow {
  id: number
  actionPoints: number
  level: number | null
  customized: boolean
}

export interface IndexRowLite {
  token_id: number
  action_points: number | null
  level: number | null
  customized: boolean | null
  burned: boolean
}

export interface CensusUpdate {
  token_id: number
  action_points: number
  level: number | null
  customized: boolean
}

export interface CensusPlan {
  updates: CensusUpdate[]
  /** Living in the index, absent from the complete bulk list: burned since the index was built. */
  burned: number[]
  unchanged: number
  /** In the bulk list but not in the index as living: reported, never invented. */
  notInIndex: number[]
  /** False means: write NOTHING that depends on the bulk list being complete (the burned flags). AP updates are still safe. */
  burnedGuardOk: boolean
  burnedGuardWhy: string
}

/** Never mark more than this share of the living index as burned in one run: anything bigger smells like a truncated list. */
export const MAX_BURNED_SHARE = 0.05

export function planCensusRefresh(
  bulk: BulkRow[],
  index: IndexRowLite[],
  opts: { expectedLiving: number; pagesOk: boolean },
): CensusPlan {
  const livingIndex = index.filter((r) => !r.burned)
  const byId = new Map(livingIndex.map((r) => [r.token_id, r]))
  const bulkIds = new Set<number>()
  const updates: CensusUpdate[] = []
  const notInIndex: number[] = []
  let unchanged = 0

  for (const b of bulk) {
    bulkIds.add(b.id)
    const row = byId.get(b.id)
    if (!row) { notInIndex.push(b.id); continue }
    const same = (row.action_points ?? 0) === b.actionPoints && Boolean(row.customized) === b.customized && (row.level ?? null) === (b.level ?? null)
    if (same) unchanged++
    else updates.push({ token_id: b.id, action_points: b.actionPoints, level: b.level, customized: b.customized })
  }

  const burned = livingIndex.filter((r) => !bulkIds.has(r.token_id)).map((r) => r.token_id).sort((a, b) => a - b)

  let burnedGuardOk = true
  let burnedGuardWhy = "bulk list complete and consistent"
  if (!opts.pagesOk) { burnedGuardOk = false; burnedGuardWhy = "a page of the bulk list failed" }
  else if (bulkIds.size !== bulk.length) { burnedGuardOk = false; burnedGuardWhy = "the bulk list has duplicate tokens" }
  else if (bulk.length !== opts.expectedLiving) { burnedGuardOk = false; burnedGuardWhy = `bulk list has ${bulk.length} tokens but the API says ${opts.expectedLiving} are living` }
  else if (burned.length > MAX_BURNED_SHARE * Math.max(1, livingIndex.length)) { burnedGuardOk = false; burnedGuardWhy = `${burned.length} would be marked burned, more than ${MAX_BURNED_SHARE * 100}% of the index` }

  return { updates, burned, unchanged, notInIndex: notInIndex.sort((a, b) => a - b), burnedGuardOk, burnedGuardWhy }
}

/** The rows as they would look after the plan (used to compute the census before and after, without writing anything). */
export function applyPlanToRows<T extends IndexRowLite & { owner: string | null }>(rows: T[], plan: CensusPlan): T[] {
  const up = new Map(plan.updates.map((u) => [u.token_id, u]))
  const dead = plan.burnedGuardOk ? new Set(plan.burned) : new Set<number>()
  return rows
    .filter((r) => !dead.has(r.token_id))
    .map((r) => {
      const u = up.get(r.token_id)
      return u ? { ...r, action_points: u.action_points, level: u.level, customized: u.customized } : r
    })
}
