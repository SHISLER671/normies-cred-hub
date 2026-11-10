// Google Wallet API calls for the record-card pass. Server-only.
// Fixed Google URLs only (nothing built from user input except the validated token id inside our own object id).
// Every call has a timeout. Upstream error text is never returned to callers: failures throw a plain WalletPassError.

import { fetchWithTimeout } from "@/lib/fetch-with-timeout"
import type { RecordCard } from "@/lib/record-card/types"

import {
  buildPassClass,
  buildPassObject,
  GOOGLE_TOKEN_URL,
  passObjectId,
  serviceAccountAssertion,
  type GoogleWalletConfig,
} from "./google-pass"

const WALLET_API = "https://walletobjects.googleapis.com/walletobjects/v1"
const TIMEOUT_MS = 8_000

export class WalletPassError extends Error {
  constructor(step: string) {
    super(`Google Wallet ${step} failed`)
    this.name = "WalletPassError"
  }
}

let cachedToken: { token: string; expiresAtMs: number } | null = null
let classReady = false

async function accessToken(cfg: GoogleWalletConfig): Promise<string> {
  if (cachedToken && cachedToken.expiresAtMs - 60_000 > Date.now()) return cachedToken.token
  const res = await fetchWithTimeout(
    GOOGLE_TOKEN_URL,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: serviceAccountAssertion(cfg, Math.floor(Date.now() / 1000)),
      }),
      cache: "no-store",
    },
    TIMEOUT_MS,
  )
  if (!res.ok) throw new WalletPassError("sign-in")
  const json = (await res.json()) as { access_token?: string; expires_in?: number }
  if (!json.access_token) throw new WalletPassError("sign-in")
  cachedToken = { token: json.access_token, expiresAtMs: Date.now() + (json.expires_in ?? 3600) * 1000 }
  return json.access_token
}

async function call(token: string, method: "POST" | "PUT", path: string, body: unknown): Promise<Response> {
  return fetchWithTimeout(
    `${WALLET_API}${path}`,
    {
      method,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    },
    TIMEOUT_MS,
  )
}

/** Create the shared class once per server instance. 409 means it already exists, which is fine. */
async function ensureClass(cfg: GoogleWalletConfig, token: string): Promise<void> {
  if (classReady) return
  const res = await call(token, "POST", "/genericClass", buildPassClass(cfg.issuerId))
  if (!res.ok && res.status !== 409) throw new WalletPassError("class setup")
  classReady = true
}

// Skip re-sending the same Normie's pass for a few minutes: the record card itself is cached for 5 minutes.
const FRESH_MS = 5 * 60_000
const lastPushed = new Map<number, number>()

/**
 * Write the latest snapshot of this record card to the Normie's one pass (update, or create if new).
 * Never sets notifications, so people who already saved the pass are not pinged.
 */
export async function upsertRecordPass(cfg: GoogleWalletConfig, card: RecordCard, origin: string): Promise<void> {
  const pushedAt = lastPushed.get(card.token_id)
  if (pushedAt && Date.now() - pushedAt < FRESH_MS) return

  const token = await accessToken(cfg)
  await ensureClass(cfg, token)

  const object = buildPassObject(card, cfg.issuerId, origin)
  const id = encodeURIComponent(passObjectId(cfg.issuerId, card.token_id))
  let res = await call(token, "PUT", `/genericObject/${id}`, object)
  if (res.status === 404) res = await call(token, "POST", "/genericObject", object)
  if (!res.ok) throw new WalletPassError("pass update")

  if (lastPushed.size > 2_000) lastPushed.clear()
  lastPushed.set(card.token_id, Date.now())
}
