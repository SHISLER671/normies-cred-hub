// Google Wallet pass for a Normie record card. Pure: builds the pass and signs JWTs, no network.
// Read-only by design: the pass only displays public record-card data (docs/zulo/wallet-pass.md).
// - No wallet address, ENS name or owner of any kind goes on the pass, so there is nothing to hide.
// - No barcode action and no message: the QR code only opens the public record page.
// - No notifications: we never set `notifyPreference` or add messages, so updates never ping anyone (AGENTS.md "No comms").
// Relative imports only, so the tests run without the "@/" path alias.

import { createSign } from "node:crypto"

import { recordCardImagePath } from "../record-card/share-image"
import type { Field, RecordCard } from "../record-card/types"

export const GOOGLE_WALLET_SCOPE = "https://www.googleapis.com/auth/wallet_object.issuer"
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
export const GOOGLE_SAVE_URL_BASE = "https://pay.google.com/gp/v/save/"

/** NCH's dark ink colour (app/zulo/styles.css --bg-dark). */
const PASS_BACKGROUND = "#1a1b1c"

export type GoogleWalletConfig = {
  issuerId: string
  serviceAccountEmail: string
  /** PEM. Vercel stores newlines as the two characters "\n"; readGoogleWalletConfig turns them back. */
  privateKey: string
}

/**
 * The pass settings from env, or null when any is missing (then the button is hidden and the route returns 404).
 * Names only in .env.example. The private key is server-only: never NEXT_PUBLIC_.
 */
export function readGoogleWalletConfig(env: Record<string, string | undefined> = process.env): GoogleWalletConfig | null {
  const issuerId = env.GOOGLE_WALLET_ISSUER_ID?.trim()
  const serviceAccountEmail = env.GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL?.trim()
  const rawKey = env.GOOGLE_WALLET_PRIVATE_KEY?.trim()
  if (!issuerId || !serviceAccountEmail || !rawKey) return null
  if (!/^\d+$/.test(issuerId)) return null
  const privateKey = rawKey.replace(/\\n/g, "\n").trim()
  if (!privateKey.includes("PRIVATE KEY")) return null
  return { issuerId, serviceAccountEmail, privateKey }
}

/** One class for every record card. Google ids allow letters, digits, ".", "_" and "-". */
export function passClassId(issuerId: string): string {
  return `${issuerId}.nch_record_card`
}

/** One pass per Normie, so tapping "Add" again refreshes the same pass instead of piling up copies. */
export function passObjectId(issuerId: string, tokenId: number): string {
  assertTokenId(tokenId)
  return `${issuerId}.nch_normie_${tokenId}`
}

type Localized = { defaultValue: { language: "en-US"; value: string } }
const text = (value: string): Localized => ({ defaultValue: { language: "en-US", value } })

/** A field's value, or a plain word when there is none. Never 0 for a missing value. */
function show<T>(f: Field<T>, fmt: (v: T) => string = (v) => String(v)): string {
  if (f.value !== null) return fmt(f.value)
  return f.label === "pending" ? "Pending" : "Unavailable right now"
}

/** "2026-11-10 01:36 UTC" */
export function asOfText(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "Unknown"
  return `${d.toISOString().slice(0, 16).replace("T", " ")} UTC`
}

export function buildPassClass(issuerId: string) {
  return { id: passClassId(issuerId) }
}

/**
 * The pass body for one record card: a snapshot with its as-of time. Live numbers stay on the record page,
 * which the QR code and link open.
 */
export function buildPassObject(card: RecordCard, issuerId: string, origin: string) {
  const tokenId = assertTokenId(card.token_id)
  const base = origin.replace(/\/$/, "")
  const recordUrl = `${base}/record/${tokenId}`
  const name = card.identity.agent_name.value?.trim() || `Normie #${tokenId}`
  const agent = card.identity.agent_id.value
  const { pulse } = card

  return {
    id: passObjectId(issuerId, tokenId),
    classId: passClassId(issuerId),
    state: "ACTIVE",
    hexBackgroundColor: PASS_BACKGROUND,
    cardTitle: text("Normies CredHub · Record card"),
    header: text(name),
    subheader: text(agent !== null ? `Normie #${tokenId} · Agent #${agent}` : `Normie #${tokenId}`),
    logo: {
      sourceUri: { uri: `${base}/images/NLOGO.png` },
      contentDescription: text("Normies CredHub"),
    },
    heroImage: {
      sourceUri: { uri: `${base}${recordCardImagePath(tokenId)}` },
      contentDescription: text(`Record card for Normie #${tokenId}`),
    },
    textModulesData: [
      { id: "trust", header: "Trust gate", body: pulse.gate.text },
      {
        id: "pulse",
        header: "Pulse (trust, not skill)",
        body: pulse.available && pulse.level !== null
          ? `${pulse.level} of ${pulse.max_level}${pulse.status ? ` (${pulse.status})` : ""}`
          : "Unavailable right now",
      },
      { id: "level", header: "Level", body: show(card.identity.level) },
      { id: "pixels", header: "Pixels on this Normie", body: show(card.identity.pixels_attached) },
      { id: "arena", header: "Arena record", body: card.sectors.arena.status_text },
      { id: "status", header: "Card", body: card.card_status_text },
      { id: "as_of", header: "As of", body: asOfText(card.generated_at) },
      {
        id: "read_only",
        header: "Read-only",
        body: "A track record, not a tip. Scan or tap the link for live numbers. Don't take our word for it.",
      },
    ],
    linksModuleData: {
      uris: [{ id: "record", uri: recordUrl, description: "Live record card on NCH" }],
    },
    barcode: { type: "QR_CODE", value: recordUrl, alternateText: `Normie #${tokenId}` },
  }
}

// ---------- JWT (RS256), node:crypto only ----------

function b64url(input: string | Buffer): string {
  return Buffer.from(input).toString("base64url")
}

export function signJwtRs256(claims: Record<string, unknown>, privateKey: string): string {
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))
  const body = b64url(JSON.stringify(claims))
  const signer = createSign("RSA-SHA256")
  signer.update(`${head}.${body}`)
  signer.end()
  return `${head}.${body}.${signer.sign(privateKey).toString("base64url")}`
}

/** Assertion traded for a short-lived access token (OAuth 2.0 JWT bearer grant). */
export function serviceAccountAssertion(cfg: GoogleWalletConfig, nowSec: number): string {
  return signJwtRs256(
    { iss: cfg.serviceAccountEmail, scope: GOOGLE_WALLET_SCOPE, aud: GOOGLE_TOKEN_URL, iat: nowSec, exp: nowSec + 3600 },
    cfg.privateKey,
  )
}

/**
 * "Save to Google Wallet" link. Only references the pass by id (the route upserts it first), so the link carries
 * no card data. `origins` limits which site may show the save button.
 */
export function saveToWalletUrl(cfg: GoogleWalletConfig, tokenId: number, origin: string, nowSec: number): string {
  const jwt = signJwtRs256(
    {
      iss: cfg.serviceAccountEmail,
      aud: "google",
      typ: "savetowallet",
      iat: nowSec,
      origins: [origin.replace(/\/$/, "")],
      payload: {
        genericObjects: [{ id: passObjectId(cfg.issuerId, tokenId), classId: passClassId(cfg.issuerId) }],
      },
    },
    cfg.privateKey,
  )
  return `${GOOGLE_SAVE_URL_BASE}${jwt}`
}

function assertTokenId(tokenId: number): number {
  if (!Number.isSafeInteger(tokenId) || tokenId < 0 || tokenId > 9999) {
    throw new RangeError(`Invalid Normie token id: ${tokenId}`)
  }
  return tokenId
}
