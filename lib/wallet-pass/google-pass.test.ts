import assert from "node:assert/strict"
import { createVerify, generateKeyPairSync } from "node:crypto"
import { describe, it } from "node:test"

import type { Field, RecordCard } from "../record-card/types"
import {
  asOfText,
  buildPassObject,
  passObjectId,
  readGoogleWalletConfig,
  saveToWalletUrl,
  serviceAccountAssertion,
  signJwtRs256,
  type GoogleWalletConfig,
} from "./google-pass"

const ORIGIN = "https://normiescredhub.vercel.app/"
const ISSUER = "3388000000012345678"
const OWNER = "0xfafd8fb6b4e43ace0e365553f1b9242384591031"
const DELEGATE = "0xb8792e6516b88e73ed0723f8c1c8a92531a98767"

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 })
const PEM = privateKey.export({ type: "pkcs8", format: "pem" }).toString()
const CFG: GoogleWalletConfig = { issuerId: ISSUER, serviceAccountEmail: "nch@example.iam.gserviceaccount.com", privateKey: PEM }

const AS_OF = "2026-11-10T01:36:00.000Z"
function f<T>(value: T | null, label: Field<T>["label"] = "verified"): Field<T> {
  return { value, label, source: { kind: "official_api", ref: "test" }, as_of: AS_OF, ...(label === "pending" ? { pending_reason: "Arena not live" } : {}) }
}

function card(over: Partial<RecordCard> = {}): RecordCard {
  const pendingNum = f<number>(null, "pending")
  return {
    spec_version: "0.1",
    token_id: 7141,
    card_status: "arena_not_live",
    card_status_text: "Arena isn't live yet, so there's no record",
    generated_at: AS_OF,
    identity: {
      agent_id: f(32626), awakened_at: f("2026-05-15T23:17:59.000Z"), agent_name: f("Zulo"), mint_type: f("Human"),
      is_zombie: f(false), level: f(2), pixels_attached: f(12), pixels_locked: f(0), pixels_free: f(12),
      image_url: "https://api.normies.art/normie/7141/image.svg",
    },
    context: { owner: f(OWNER), canvas_delegate: f(DELEGATE), grid_size: f(40), customized: f(false), base_cleared: f(false) },
    pulse: {
      level: 4, max_level: 5, status: "Strong", breakdown: [], next_signal: null, popularity: null,
      gate: { passed: true, registered: true, clean_ownership: true, text: "Passes the trust gate" }, available: true,
    },
    sectors: {
      arena: {
        status: "not_live", status_text: "Arena = Coming Soon",
        record: { matches: pendingNum, wins: pendingNum, losses: pendingNum, pixels_net: pendingNum, last_match_at: f<string>(null, "pending") },
        rank: { ranked: false, score: null, reason: "Arena not live" },
      },
      canvas: {
        status: "announced", status_text: "Announced",
        record: { canvases_created: pendingNum, pieces_painted: pendingNum, pixels_painted: pendingNum, votes_received: pendingNum, votes_cast: pendingNum },
        rank: { ranked: false, score: null, reason: "Not live" },
      },
    },
    chat_rating: null,
    self_reported: [],
    disclaimer: "A track record, not a tip.",
    ...over,
  }
}

function decode(jwt: string): { header: Record<string, unknown>; claims: Record<string, unknown> } {
  const [h, c, sig] = jwt.split(".")
  const v = createVerify("RSA-SHA256")
  v.update(`${h}.${c}`)
  assert.ok(v.verify(publicKey, Buffer.from(sig, "base64url")), "signature verifies with the public key")
  return {
    header: JSON.parse(Buffer.from(h, "base64url").toString()),
    claims: JSON.parse(Buffer.from(c, "base64url").toString()),
  }
}

describe("readGoogleWalletConfig", () => {
  it("is off unless all three settings are present and sane", () => {
    assert.equal(readGoogleWalletConfig({}), null)
    assert.equal(readGoogleWalletConfig({ GOOGLE_WALLET_ISSUER_ID: ISSUER, GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL: "a@b" }), null)
    assert.equal(
      readGoogleWalletConfig({ GOOGLE_WALLET_ISSUER_ID: "abc", GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL: "a@b", GOOGLE_WALLET_PRIVATE_KEY: PEM }),
      null,
      "issuer id must be digits",
    )
  })
  it("turns Vercel's escaped \\n back into newlines", () => {
    const cfg = readGoogleWalletConfig({
      GOOGLE_WALLET_ISSUER_ID: ISSUER,
      GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL: "a@b",
      GOOGLE_WALLET_PRIVATE_KEY: PEM.replace(/\n/g, "\\n"),
    })
    assert.equal(cfg?.privateKey, PEM.trim())
  })
})

describe("buildPassObject (read-only, public data only)", () => {
  const pass = buildPassObject(card(), ISSUER, ORIGIN)
  const json = JSON.stringify(pass)

  it("never puts a wallet address on the pass", () => {
    assert.doesNotMatch(json, /0x[0-9a-fA-F]{40}/)
    assert.ok(!json.toLowerCase().includes(OWNER))
    assert.ok(!json.toLowerCase().includes(DELEGATE))
  })

  it("never asks Google to notify anyone", () => {
    assert.ok(!("notifyPreference" in pass))
    assert.ok(!("messages" in pass))
  })

  it("names the Normie and agent, and links only to the public record page", () => {
    assert.equal(pass.id, `${ISSUER}.nch_normie_7141`)
    assert.equal(pass.header.defaultValue.value, "Zulo")
    assert.equal(pass.subheader.defaultValue.value, "Normie #7141 · Agent #32626")
    assert.equal(pass.barcode.value, "https://normiescredhub.vercel.app/record/7141")
    assert.equal(pass.linksModuleData.uris[0].uri, "https://normiescredhub.vercel.app/record/7141")
    assert.equal(pass.heroImage.sourceUri.uri, "https://normiescredhub.vercel.app/record/7141/opengraph-image")
  })

  it("carries its as-of time and copies the Arena status line as-is", () => {
    const body = (id: string) => pass.textModulesData.find((m) => m.id === id)?.body
    assert.equal(body("as_of"), "2026-11-10 01:36 UTC")
    assert.equal(body("arena"), "Arena = Coming Soon")
    assert.equal(body("pulse"), "4 of 5 (Strong)")
  })

  it("uses plain-word labels, never a bare AP", () => {
    for (const m of pass.textModulesData) assert.doesNotMatch(m.header, /\bAP\b/)
  })

  it("shows 'Unavailable right now' instead of a made-up zero", () => {
    const p = buildPassObject(
      card({
        identity: { ...card().identity, level: f<number>(null, "unavailable") },
        pulse: { ...card().pulse, level: null, available: false },
      }),
      ISSUER,
      ORIGIN,
    )
    const body = (id: string) => p.textModulesData.find((m) => m.id === id)?.body
    assert.equal(body("level"), "Unavailable right now")
    assert.equal(body("pulse"), "Unavailable right now")
  })

  it("falls back to Normie #id when there is no agent name", () => {
    const p = buildPassObject(card({ identity: { ...card().identity, agent_name: f<string>(null, "unavailable") } }), ISSUER, ORIGIN)
    assert.equal(p.header.defaultValue.value, "Normie #7141")
  })
})

describe("JWTs", () => {
  it("save link references the pass by id only, signed RS256, locked to our origin", () => {
    const url = saveToWalletUrl(CFG, 7141, ORIGIN, 1_800_000_000)
    assert.ok(url.startsWith("https://pay.google.com/gp/v/save/"))
    const { header, claims } = decode(url.slice("https://pay.google.com/gp/v/save/".length))
    assert.equal(header.alg, "RS256")
    assert.equal(claims.aud, "google")
    assert.equal(claims.typ, "savetowallet")
    assert.deepEqual(claims.origins, ["https://normiescredhub.vercel.app"])
    assert.deepEqual(claims.payload, {
      genericObjects: [{ id: `${ISSUER}.nch_normie_7141`, classId: `${ISSUER}.nch_record_card` }],
    })
  })

  it("service account assertion asks only for the Wallet issuer scope and expires in an hour", () => {
    const { claims } = decode(serviceAccountAssertion(CFG, 1_800_000_000))
    assert.equal(claims.scope, "https://www.googleapis.com/auth/wallet_object.issuer")
    assert.equal(claims.aud, "https://oauth2.googleapis.com/token")
    assert.equal(claims.exp, 1_800_003_600)
  })

  it("signJwtRs256 output verifies", () => {
    assert.equal(decode(signJwtRs256({ a: 1 }, PEM)).claims.a, 1)
  })
})

describe("ids and dates", () => {
  it("rejects bad token ids", () => {
    assert.throws(() => passObjectId(ISSUER, 10000), RangeError)
    assert.throws(() => passObjectId(ISSUER, -1), RangeError)
    assert.throws(() => passObjectId(ISSUER, 1.5), RangeError)
  })
  it("asOfText handles junk", () => {
    assert.equal(asOfText("nope"), "Unknown")
    assert.equal(asOfText(AS_OF), "2026-11-10 01:36 UTC")
  })
})
