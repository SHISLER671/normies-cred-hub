// Live Arena feed: the reads (Claude, 2026-11-18). Three GETs through the polite Arena-site reader (./api.ts), in
// parallel. Any read that fails makes the whole block "live Arena data unavailable". Never throws.

import type { ArenaLive } from "@/lib/record-card/types"

import { arenaLiveGet, type ArenaLiveResult } from "./api"
import { arenaLiveUnavailable, buildArenaLive } from "./core"

export type ArenaLiveGet = (path: string) => Promise<ArenaLiveResult>

export async function loadArenaLive(tokenId: number, asOf: string, get: ArenaLiveGet = arenaLiveGet): Promise<ArenaLive> {
  if (!Number.isInteger(tokenId) || tokenId < 0 || tokenId > 9999) return arenaLiveUnavailable(tokenId, asOf)
  const read = (path: string) => get(path).catch((): ArenaLiveResult => ({ ok: false, status: 0, reason: "error" }))
  const [standing, normie, week] = await Promise.all([
    read(`/api/world/standing?ids=${tokenId}`),
    read(`/api/world/normie/${tokenId}`),
    read("/api/world/arena-week"),
  ])
  if (!standing.ok || !normie.ok || !week.ok) return arenaLiveUnavailable(tokenId, asOf)
  return buildArenaLive(tokenId, { standing: standing.data, normie: normie.data, week: week.data }, asOf)
}
