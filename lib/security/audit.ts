// Immutable security event logging with HMAC signature + hash chain.

import { createHash, createHmac, randomBytes } from "crypto"

import { Redis } from "@upstash/redis"

export type SecurityEventType =
  | "PAYMENT_VERIFIED"
  | "PAYMENT_REJECTED"
  | "RATE_LIMIT_HIT"
  | "CIRCUIT_BREAKER_TRIP"
  | "CIRCUIT_BREAKER_UNPAUSE"
  | "VALIDATION_FAIL"
  | "SECURITY_REPORT"
  | "ANOMALY"
  | "HEALTH_PROBE"

export interface SecurityAuditEvent {
  id: string
  type: SecurityEventType
  timestamp: string
  caller?: string
  txHash?: string
  amount?: string
  service?: string
  detail?: string
  /** SHA-256 of previous entry payload (hash chain) */
  prevHash: string
  /** SHA-256 of this entry fields (excluding signature) */
  entryHash: string
  /** HMAC-SHA256 of entryHash */
  signature: string
}

const GENESIS = "0".repeat(64)
const MEM_LOG: SecurityAuditEvent[] = []
const MEM_MAX = 500

let redis: Redis | null | undefined
let memPrevHash = GENESIS

function getRedis(): Redis | null {
  if (redis !== undefined) return redis
  const url = process.env.KV_REST_API_URL
  const token = process.env.KV_REST_API_TOKEN
  if (!url || !token) {
    redis = null
    return null
  }
  redis = new Redis({ url, token })
  return redis
}

function hmacSecret(): string {
  return (
    process.env.AUDIT_LOG_HMAC_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    "dev-only-audit-secret-change-me"
  )
}

function sha256Hex(data: string): string {
  return createHash("sha256").update(data, "utf8").digest("hex")
}

function hmacHex(data: string): string {
  return createHmac("sha256", hmacSecret()).update(data, "utf8").digest("hex")
}

/**
 * Append a security event to the append-only log.
 * Uses Redis list when available; in-memory fallback for local/dev.
 * "Atomicity" for serverless: RPUSH after computing chain tip via GET/SET of tip hash.
 */
export async function appendSecurityEvent(input: {
  type: SecurityEventType
  caller?: string
  txHash?: string
  amount?: string | number | bigint
  service?: string
  detail?: string
}): Promise<SecurityAuditEvent> {
  const id = `evt_${Date.now().toString(36)}_${randomBytes(6).toString("hex")}`
  const timestamp = new Date().toISOString()
  const amount =
    input.amount === undefined || input.amount === null
      ? undefined
      : String(input.amount)

  const client = getRedis()
  let prevHash = memPrevHash

  if (client) {
    try {
      const tip = await client.get<string>("zulo:audit:tip")
      if (typeof tip === "string" && /^[a-f0-9]{64}$/i.test(tip)) {
        prevHash = tip
      }
    } catch {
      /* use mem */
    }
  }

  const body = {
    id,
    type: input.type,
    timestamp,
    caller: input.caller,
    txHash: input.txHash,
    amount,
    service: input.service,
    detail: input.detail,
    prevHash,
  }

  const entryHash = sha256Hex(JSON.stringify(body))
  const signature = hmacHex(entryHash)

  const event: SecurityAuditEvent = {
    ...body,
    entryHash,
    signature,
  }

  // Merkle-ish leaf for batch proofs (single-leaf tree = entryHash)
  if (client) {
    try {
      // Append then advance tip — Redis single-key ops; best-effort atomicity in serverless
      await client.rpush("zulo:audit:log", JSON.stringify(event))
      await client.set("zulo:audit:tip", entryHash)
      await client.ltrim("zulo:audit:log", -5000, -1)
    } catch (e) {
      console.warn("[audit] redis append failed, memory fallback", e)
      pushMem(event)
    }
  } else {
    pushMem(event)
  }

  memPrevHash = entryHash
  return event
}

function pushMem(event: SecurityAuditEvent) {
  MEM_LOG.push(event)
  if (MEM_LOG.length > MEM_MAX) MEM_LOG.splice(0, MEM_LOG.length - MEM_MAX)
}

/** Recent events for operators (not a public dump of secrets). */
export async function listRecentSecurityEvents(limit = 20): Promise<SecurityAuditEvent[]> {
  const n = Math.min(100, Math.max(1, limit))
  const client = getRedis()
  if (client) {
    try {
      const rows = await client.lrange<string>("zulo:audit:log", -n, -1)
      return rows
        .map((r) => {
          try {
            return JSON.parse(r) as SecurityAuditEvent
          } catch {
            return null
          }
        })
        .filter((e): e is SecurityAuditEvent => !!e)
        .reverse()
    } catch {
      /* fall through */
    }
  }
  return [...MEM_LOG].slice(-n).reverse()
}

/** Verify HMAC signature of a stored event. */
export function verifyEventSignature(event: SecurityAuditEvent): boolean {
  const body = {
    id: event.id,
    type: event.type,
    timestamp: event.timestamp,
    caller: event.caller,
    txHash: event.txHash,
    amount: event.amount,
    service: event.service,
    detail: event.detail,
    prevHash: event.prevHash,
  }
  const entryHash = sha256Hex(JSON.stringify(body))
  if (entryHash !== event.entryHash) return false
  return hmacHex(entryHash) === event.signature
}

/** Simple inclusion proof for one event (leaf = entryHash). */
export function merkleLeafProof(event: SecurityAuditEvent): {
  leaf: string
  root: string
  algorithm: string
} {
  return {
    leaf: event.entryHash,
    root: event.entryHash,
    algorithm: "sha256-single-leaf",
  }
}
