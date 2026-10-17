// Chat ratings — server loader. Read-only: one view call to the ERC-8004 Reputation Registry,
// one best-effort log scan for timestamps, and best-effort rater reads (Normie balance, tx count).
// Never signs, never writes. Every enrichment fails open to neutral weight, and the whole read is
// capped by CHAT_RATINGS_CONFIG.limits.timeoutMs so Pulse and Ask never wait on it.

import {
  ERC721_ENUMERABLE_ABI,
  ERC8004,
  IDENTITY_REGISTRY_READ_ABI,
  NORMIES_NFT,
  REPUTATION_REGISTRY_DEPLOY_BLOCK,
  REPUTATION_REGISTRY_READ_ABI,
} from "@/constants/contracts"
import { publicClient } from "@/lib/viem-client"

import { CHAT_RATINGS_CONFIG } from "./config"
import { rankChatRatings, type ChatRatingsScore, type RaterInfo, type RawChatRating } from "./score"

/** Mainnet seconds per block since the Merge. Used to turn a block number into an age without a getBlock per rating. */
const SECONDS_PER_BLOCK = 12

export type ChatRatingsSummary = ChatRatingsScore & {
  agent_id: number
  /** Plain-word label for UIs. Always "Chat rating", never "Reputation". */
  label: string
  /** Where the ratings come from. */
  source: { tag1: string; tag2: string; registry: string }
  /** False when the registry read itself failed — show "unavailable", not "no ratings". */
  available: boolean
  /** True when per-rating timestamps were read, so recency weighting is live. */
  recency_available: boolean
  /** One sentence for humans and agents explaining what this number is. */
  note: string
}

const NOTE =
  "Chat rating = how good chats with this agent were (Hive chat, normies.art). One averaged vote per wallet, weighted by Normie holding, wallet history and recency. Not a trust score for the owner."

const isAddr = (a: unknown): a is `0x${string}` => typeof a === "string" && /^0x[a-fA-F0-9]{40}$/.test(a)

function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms)
    p.then(
      (v) => {
        clearTimeout(timer)
        resolve(v)
      },
      () => {
        clearTimeout(timer)
        resolve(fallback)
      },
    )
  })
}

type FeedbackRow = { rater: string; index: bigint; value: number; decimals: number }

async function readHiveFeedback(agentId: number): Promise<FeedbackRow[] | null> {
  try {
    const [clients, indexes, values, decimals, , tag2s, revoked] = await publicClient.readContract({
      address: ERC8004.REPUTATION_REGISTRY as `0x${string}`,
      abi: REPUTATION_REGISTRY_READ_ABI,
      functionName: "readAllFeedback",
      // Filter on tag2 "hive-chat" only (empty tag1 = any), so a change to Hive's tag1 can't silently hide ratings.
      // tag2 is re-checked below so a registry that ignores filters can't leak other feedback in.
      args: [BigInt(agentId), [], "", CHAT_RATINGS_CONFIG.source.tag2, false],
    })

    const rows: FeedbackRow[] = []
    for (let i = 0; i < clients.length; i++) {
      if (revoked[i]) continue
      if (tag2s[i] !== CHAT_RATINGS_CONFIG.source.tag2) continue
      const value = Number(values[i])
      if (!Number.isSafeInteger(value)) continue
      rows.push({ rater: clients[i], index: indexes[i], value, decimals: Number(decimals[i]) })
    }
    return rows
  } catch {
    return null
  }
}

/** rater:index → block number, from NewFeedback logs. Null when the RPC refuses the scan. */
async function readFeedbackBlocks(agentId: number): Promise<Map<string, bigint> | null> {
  try {
    const logs = await publicClient.getLogs({
      address: ERC8004.REPUTATION_REGISTRY as `0x${string}`,
      event: REPUTATION_REGISTRY_READ_ABI[1],
      args: { agentId: BigInt(agentId) },
      fromBlock: REPUTATION_REGISTRY_DEPLOY_BLOCK,
      toBlock: "latest",
    })
    const out = new Map<string, bigint>()
    for (const log of logs) {
      const client = log.args.clientAddress
      const index = log.args.feedbackIndex
      if (!client || index == null || log.blockNumber == null) continue
      out.set(`${client.toLowerCase()}:${index.toString()}`, log.blockNumber)
    }
    return out
  } catch {
    return null
  }
}

async function readRaterInfo(raters: string[]): Promise<Map<string, RaterInfo>> {
  const out = new Map<string, RaterInfo>()
  const list = raters.filter(isAddr).slice(0, CHAT_RATINGS_CONFIG.limits.maxRatersEnriched)
  if (!list.length) return out

  const [balances, counts] = await Promise.all([
    publicClient
      .multicall({
        contracts: list.map((a) => ({
          address: NORMIES_NFT,
          abi: ERC721_ENUMERABLE_ABI,
          functionName: "balanceOf" as const,
          args: [a] as const,
        })),
        allowFailure: true,
      })
      .catch(() => null),
    Promise.all(list.map((a) => publicClient.getTransactionCount({ address: a }).catch(() => undefined))),
  ])

  list.forEach((a, i) => {
    const bal = balances?.[i]
    out.set(a.toLowerCase(), {
      holder: bal && bal.status === "success" ? (bal.result as bigint) > BigInt(0) : undefined,
      txCount: counts[i],
    })
  })
  return out
}

async function readAgentOwner(agentId: number): Promise<string | null> {
  try {
    const owner = (await publicClient.readContract({
      address: ERC8004.IDENTITY_REGISTRY as `0x${string}`,
      abi: IDENTITY_REGISTRY_READ_ABI,
      functionName: "ownerOf",
      args: [BigInt(agentId)],
    })) as string
    return isAddr(owner) ? owner : null
  } catch {
    return null
  }
}

function emptySummary(agentId: number, available: boolean): ChatRatingsSummary {
  return {
    agent_id: agentId,
    label: CHAT_RATINGS_CONFIG.source.label,
    source: {
      tag1: CHAT_RATINGS_CONFIG.source.tag1,
      tag2: CHAT_RATINGS_CONFIG.source.tag2,
      registry: ERC8004.REPUTATION_REGISTRY,
    },
    available,
    recency_available: false,
    note: NOTE,
    ...rankChatRatings([]),
  }
}

async function loadUncached(agentId: number): Promise<ChatRatingsSummary> {
  const t = CHAT_RATINGS_CONFIG.limits.timeoutMs
  const deadline = Date.now() + t

  const [rows, blocks, latest, owner] = await Promise.all([
    withTimeout(readHiveFeedback(agentId), t, null),
    withTimeout(readFeedbackBlocks(agentId), t, null),
    withTimeout(publicClient.getBlockNumber().catch(() => null), t, null),
    withTimeout(readAgentOwner(agentId), t, null),
  ])

  if (!rows) return emptySummary(agentId, false)
  if (!rows.length) return emptySummary(agentId, true)

  const recencyAvailable = !!blocks && blocks.size > 0 && latest != null
  const ratings: RawChatRating[] = rows.map((r) => {
    const block = blocks?.get(`${r.rater.toLowerCase()}:${r.index.toString()}`)
    const ageDays =
      recencyAvailable && block != null && latest != null && latest >= block
        ? (Number(latest - block) * SECONDS_PER_BLOCK) / 86_400
        : null
    return { rater: r.rater, value: r.value, decimals: r.decimals, ageDays }
  })

  const raters = Array.from(new Set(rows.map((r) => r.rater.toLowerCase())))
  // Rater enrichment gets whatever is left of the same budget; if time is up, everyone counts at neutral weight.
  const left = deadline - Date.now()
  const info =
    left > 250 ? await withTimeout(readRaterInfo(raters), left, new Map<string, RaterInfo>()) : new Map<string, RaterInfo>()

  return {
    ...emptySummary(agentId, true),
    recency_available: recencyAvailable,
    ...rankChatRatings(ratings, info, { excludeRaters: owner ? [owner] : [] }),
  }
}

const cache = new Map<number, { at: number; value: ChatRatingsSummary }>()
const inflight = new Map<number, Promise<ChatRatingsSummary>>()

/** Valid ERC-8004 agent id (positive safe integer). */
export function parseAgentId(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number.parseInt(value, 10) : Number.NaN
  return Number.isSafeInteger(n) && n > 0 ? n : null
}

/**
 * Ranked Hive chat ratings for one ERC-8004 agent. Cached per agent; a failed read is never cached.
 * Always resolves (never throws) — callers can drop it straight into a response.
 */
export async function getChatRatings(agentId: number): Promise<ChatRatingsSummary> {
  const hit = cache.get(agentId)
  if (hit && Date.now() - hit.at < CHAT_RATINGS_CONFIG.limits.cacheMs) return hit.value

  let p = inflight.get(agentId)
  if (!p) {
    p = loadUncached(agentId)
      .catch(() => emptySummary(agentId, false))
      .then((value) => {
        if (value.available) cache.set(agentId, { at: Date.now(), value })
        return value
      })
      .finally(() => inflight.delete(agentId))
    inflight.set(agentId, p)
  }
  return p
}
