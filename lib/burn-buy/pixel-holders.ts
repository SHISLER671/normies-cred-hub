// Loose #PIXEL: pixels a wallet holds OUTSIDE its Normies (in the wallet itself, or locked in an open Pixel Market listing).
// The official rule (normies.art Pixel Market > Revenue share, and /docs): "A #PIXEL weighs the same on a Normie, in the wallet
// or in a listing." The census and per-wallet score used to count only pixels attached to Normies, which undercounted every
// wallet that had taken pixels off, bought some, or listed some. api.normies.art /pixels/holders reports exactly
// balance = wallet + listed + attached; we take wallet + listed from it and keep reading attached pixels ourselves.

import { NORMIES_API_BASE } from "@/constants/contracts"

const ADDRESS = /^0x[0-9a-fA-F]{40}$/
const COUNT = /^\d{1,15}$/

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v)
const count = (v: unknown): number | null => (typeof v === "string" && COUNT.test(v) ? Number(v) : typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : null)

/** wallet + listed for one holder row, or null when the row is not the documented shape. */
export function loosePixelsOf(row: unknown): { address: string; loose: number } | null {
  if (!isObj(row) || typeof row.address !== "string" || !ADDRESS.test(row.address)) return null
  const wallet = count(row.wallet)
  const listed = count(row.listed)
  if (wallet === null || listed === null) return null
  return { address: row.address.toLowerCase(), loose: wallet + listed }
}

/** One page of GET /pixels/holders: { holders: [...], hasMore }. Null when the body is not that shape. */
export function parseHoldersPage(raw: unknown): { rows: Array<{ address: string; loose: number }>; hasMore: boolean } | null {
  if (!isObj(raw) || !Array.isArray(raw.holders)) return null
  const rows: Array<{ address: string; loose: number }> = []
  for (const h of raw.holders) {
    const r = loosePixelsOf(h)
    if (r) rows.push(r)
  }
  return { rows, hasMore: raw.hasMore === true }
}

const PAGE = 100
const MAX_PAGES = 20

function get(url: string, timeoutMs: number): Promise<unknown | null> {
  return fetch(url, { headers: { Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(timeoutMs) })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null)
}

/**
 * Every holder's loose #PIXEL (only wallets with some). Null when the first page failed, so a caller can tell
 * "nobody has loose pixels" from "could not find out". A failure after the first page keeps what was read.
 */
export async function loadLoosePixels(timeoutMs = 4_000): Promise<Map<string, number> | null> {
  const out = new Map<string, number>()
  for (let page = 0; page < MAX_PAGES; page++) {
    const parsed = parseHoldersPage(await get(`${NORMIES_API_BASE}/pixels/holders?limit=${PAGE}&offset=${page * PAGE}`, timeoutMs))
    if (!parsed) return page === 0 ? null : out
    for (const r of parsed.rows) if (r.loose > 0) out.set(r.address, r.loose)
    if (!parsed.hasMore) break
  }
  return out
}

/** One wallet's loose #PIXEL (0 when it holds none). Null when it could not be read. */
export async function loadLoosePixelsFor(address: string, timeoutMs = 3_000): Promise<number | null> {
  if (!ADDRESS.test(address)) return null
  // A wallet with no pixels at all still gets a normal row of zeros (checked live 2026-10-06), so anything else is "unknown".
  const raw = await get(`${NORMIES_API_BASE}/pixels/holders/${address.toLowerCase()}`, timeoutMs)
  return loosePixelsOf(raw)?.loose ?? null
}

/** The official revenue-share standing of one wallet (api.normies.art /revshare/wallet/{address}). */
export interface OfficialShare {
  /** Share of the pool in percent (the API reports parts per million). */
  sharePct: number
  /** #PIXEL the official scorer counted (wallet + listed + attached). */
  pixels: number
  tokens: number
}

/** Strict parse; null when the body is not the documented shape. Seen live 2026-10-06: { sharePpm: 116, breakdown: { tokens: 1, pixels: "12" } }. */
export function parseOfficialShare(raw: unknown): OfficialShare | null {
  if (!isObj(raw) || typeof raw.sharePpm !== "number" || !Number.isFinite(raw.sharePpm) || raw.sharePpm < 0) return null
  const b = isObj(raw.breakdown) ? raw.breakdown : null
  const pixels = b ? count(b.pixels) : null
  const tokens = b && typeof b.tokens === "number" && Number.isInteger(b.tokens) && b.tokens >= 0 ? b.tokens : null
  if (pixels === null || tokens === null) return null
  return { sharePct: Math.round((raw.sharePpm / 10_000) * 10_000) / 10_000, pixels, tokens }
}

export async function loadOfficialShare(address: string, timeoutMs = 3_000): Promise<OfficialShare | null> {
  if (!ADDRESS.test(address)) return null
  return parseOfficialShare(await get(`${NORMIES_API_BASE}/revshare/wallet/${address.toLowerCase()}`, timeoutMs))
}
