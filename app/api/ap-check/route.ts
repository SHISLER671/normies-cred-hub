import { type NextRequest, NextResponse } from "next/server"

import { bodyToParams } from "@/lib/ap-check/body"
import { parseTokenInput } from "@/lib/ap-check/core"
import { planForBudget, planForPixels } from "@/lib/ap-check/buy-smart"
import { loadBuySmart } from "@/lib/ap-check/buy-smart-load"
import { checkApprovals, checkListings, checkToken, checkWallet } from "@/lib/ap-check/load"
import { normalizeWalletInput } from "@/lib/burn-buy/wallet-input"
import { checkContract, parseAddressInput } from "@/lib/official-contracts"
import { checkRateLimit } from "@/lib/ratelimit"

/**
 * Normies Pixel Check (ERC-8257 manifest: /.well-known/ai-tool/normies-pixel-check.json). Open access.
 *
 * GET /api/ap-check?token=7141   live pixels attached to one Normie (from the chain), the locked / free split, recent pixel
 *                                 withdrawals, our last census value, and the open item offers on it.
 * GET /api/ap-check?wallet=0x…   every open Normies item offer that wallet has made, each next to its Normie's live pixels,
 *                                 with the risky ones (pixels gone or down) first.
 * GET /api/ap-check?listings=1   the cheapest listings whose live pixels are below what OpenSea shows, or below our census.
 * GET /api/ap-check?approvals=0x… every address that wallet approved to spend its #PIXEL, with live amounts and official labels.
 * GET /api/ap-check?contract=0x… whether an address is on the official Normies contract list (normies.art/docs).
 * GET /api/ap-check?calc=pixels&amount=500 | ?calc=eth&amount=0.5   Pixel Market vs burning floor Normies (live chain pixels).
 *
 * POST /api/ap-check with a JSON body of the same fields ({"token":7141}, {"listings":true}, {"calc":"eth","amount":0.5}, …)
 * gives the same answers. That is how agents call registered ERC-8257 tools.
 *
 * Public data only. Nothing here can sign, approve or move anything.
 */
export const maxDuration = 20
export const dynamic = "force-dynamic"

const ADDRESS = /^0x[a-fA-F0-9]{40}$/
const ENS = /^(?=.{3,255}$)(?:[a-z0-9-]+\.)+eth$/i
const HEADERS = { "Cache-Control": "public, s-maxage=15, stale-while-revalidate=15" }
const NO_STORE = { "Cache-Control": "no-store" }
const MAX_BODY_BYTES = 4_096

export async function GET(req: NextRequest) {
  const limited = await rateLimited(req)
  if (limited) return limited
  return answer(req.nextUrl.searchParams, false)
}

export async function POST(req: NextRequest) {
  const limited = await rateLimited(req)
  if (limited) return limited
  let raw: string
  try {
    raw = await req.text()
  } catch {
    return NextResponse.json({ error: "Could not read the request body.", code: "invalid_body" }, { status: 400 })
  }
  if (raw.length > MAX_BODY_BYTES) return NextResponse.json({ error: "Body too large.", code: "invalid_body" }, { status: 413 })
  let parsed: unknown = {}
  if (raw.trim()) {
    try {
      parsed = JSON.parse(raw)
    } catch {
      return NextResponse.json({ error: "Body must be JSON, e.g. {\"token\":7141}.", code: "invalid_body" }, { status: 400 })
    }
  }
  const params = bodyToParams(parsed)
  if (!params) return NextResponse.json({ error: "Body must be a JSON object, e.g. {\"token\":7141}.", code: "invalid_body" }, { status: 400 })
  return answer(params, true)
}

async function rateLimited(req: NextRequest): Promise<NextResponse | null> {
  const rl = await checkRateLimit(req, "ap-check", 20, 60)
  if (rl.ok) return null
  return NextResponse.json(
    { error: "Too many requests. Patience compounds.", code: "rate_limit", retryable: true },
    { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
  )
}

/** One handler for both methods. POST answers are never cached by the CDN (they do not vary by URL). */
async function answer(sp: URLSearchParams, isPost: boolean): Promise<NextResponse> {
  const cache = (h: Record<string, string>) => (isPost ? NO_STORE : h)
  const tokenRaw = sp.get("token")
  const walletRaw = sp.get("wallet")

  try {
    if (sp.get("listings") === "1") {
      const result = await checkListings()
      if (result.kind === "error") return NextResponse.json({ error: result.message, code: "unavailable", retryable: true }, { status: 502 })
      return NextResponse.json(result, { headers: cache({ "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30" }) })
    }
    const calc = sp.get("calc")
    if (calc === "pixels" || calc === "eth") {
      const amount = Number(sp.get("amount"))
      const ok = calc === "pixels" ? Number.isInteger(amount) && amount > 0 && amount <= 1_000_000 : amount > 0 && amount <= 1_000
      if (!ok) return NextResponse.json({ error: "amount must be a positive whole number of pixels (calc=pixels) or ETH up to 1000 (calc=eth)", code: "invalid_amount" }, { status: 400 })
      const inputs = await loadBuySmart()
      if (!inputs) return NextResponse.json({ error: "listings or the Pixel Market could not be read", code: "unavailable", retryable: true }, { status: 502 })
      const depth = inputs.book && !inputs.book.paused ? inputs.book.depth : null
      const plan = calc === "pixels" ? planForPixels(inputs.picks, depth, amount) : planForBudget(inputs.picks, depth, amount)
      return NextResponse.json(
        { answer: plan, yieldMode: inputs.yieldMode, modeSource: inputs.modeSource, listingsChecked: inputs.listingsChecked, liveConfirmed: inputs.liveConfirmed, asOf: inputs.asOf },
        { headers: cache({ "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30" }) },
      )
    }
    const contractRaw = sp.get("contract")
    if (contractRaw !== null) {
      const a = parseAddressInput(contractRaw)
      if (!a) return NextResponse.json({ error: "contract must be one 0x address", code: "invalid_contract" }, { status: 400 })
      return NextResponse.json(checkContract(a), { headers: cache({ "Cache-Control": "public, s-maxage=3600" }) })
    }
    const approvalsRaw = sp.get("approvals")
    if (approvalsRaw !== null) {
      const wallet = normalizeWalletInput(approvalsRaw)
      if (!(ADDRESS.test(wallet) || ENS.test(wallet))) {
        return NextResponse.json({ error: "approvals must be a 0x address or an .eth name", code: "invalid_wallet" }, { status: 400 })
      }
      const result = await checkApprovals(wallet)
      if (result.kind === "error") return NextResponse.json({ error: result.message, code: "unavailable", retryable: true }, { status: 502 })
      return NextResponse.json(result, { headers: cache(HEADERS) })
    }
    if (tokenRaw !== null) {
      const tokenId = parseTokenInput(tokenRaw)
      if (tokenId === null) return NextResponse.json({ error: "token must be a Normie id from 0 to 9999", code: "invalid_token" }, { status: 400 })
      return NextResponse.json(await checkToken(tokenId), { headers: cache(HEADERS) })
    }
    if (walletRaw !== null) {
      const wallet = normalizeWalletInput(walletRaw)
      if (!(ADDRESS.test(wallet) || ENS.test(wallet))) {
        return NextResponse.json({ error: "wallet must be a 0x address or an .eth name", code: "invalid_wallet" }, { status: 400 })
      }
      const result = await checkWallet(wallet)
      if (result.kind === "error") return NextResponse.json({ error: result.message, code: "unavailable", retryable: true }, { status: 502 })
      return NextResponse.json(result, { headers: cache(HEADERS) })
    }
    const how = isPost
      ? 'send one of {"token":<id>}, {"wallet":"<0x or .eth>"}, {"listings":true}, {"approvals":"<wallet>"}, {"calc":"pixels"|"eth","amount":<n>} or {"contract":"<0x>"}'
      : "pass ?token=<id>, ?wallet=<0x address or .eth name>, ?listings=1, ?approvals=<wallet>, ?calc=pixels|eth&amount=<n>, or ?contract=<0x address>"
    return NextResponse.json({ error: how, code: "missing_input" }, { status: 400 })
  } catch (err) {
    console.error("[ap-check] unexpected failure", err)
    return NextResponse.json({ error: "Something went wrong.", code: "internal" }, { status: 500 })
  }
}
