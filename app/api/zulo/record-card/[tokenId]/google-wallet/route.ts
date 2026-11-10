// GET /api/zulo/record-card/{tokenId}/google-wallet
// "Add to Google Wallet" for a Normie record card. Read-only: no wallet connection, no signature from the visitor,
// nothing on-chain. Writes the latest public record snapshot to this Normie's one pass, then redirects to Google's
// save page. Off (404) until the GOOGLE_WALLET_* env vars are set. See docs/zulo/wallet-pass.md.

import { type NextRequest, NextResponse } from "next/server"

import { parseTokenId } from "@/lib/api/agent-pulse"
import { enforceDualRateLimit } from "@/lib/middleware/rateLimit"
import { loadRecordCard } from "@/lib/record-card/load"
import { siteOrigin } from "@/lib/site-origin"
import { upsertRecordPass } from "@/lib/wallet-pass/google-api"
import { readGoogleWalletConfig, saveToWalletUrl } from "@/lib/wallet-pass/google-pass"

const NO_STORE = { "Cache-Control": "no-store" }

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tokenId: string }> },
) {
  const rl = await enforceDualRateLimit(req, "default", { bucketPrefix: "google-wallet" })
  if (!rl.ok) return rl.response

  const cfg = readGoogleWalletConfig()
  if (!cfg) {
    return NextResponse.json({ error: "Wallet passes aren't set up yet" }, { status: 404, headers: NO_STORE })
  }

  const { tokenId: raw } = await params
  const tokenId = parseTokenId(raw)
  if (tokenId === null) {
    return NextResponse.json({ error: "Invalid token ID (must be 0–9999)" }, { status: 400, headers: NO_STORE })
  }

  const card = await loadRecordCard(tokenId)
  if (card.card_status === "not_awakened") {
    return NextResponse.json({ error: card.card_status_text }, { status: 404, headers: NO_STORE })
  }

  const origin = siteOrigin()
  try {
    await upsertRecordPass(cfg, card, origin)
  } catch {
    // Never pass Google's error text on. "Couldn't reach" is not "not found", and it is not cached.
    return NextResponse.json(
      { error: "Couldn't reach Google Wallet right now. Try again in a minute." },
      { status: 502, headers: NO_STORE },
    )
  }

  return NextResponse.redirect(saveToWalletUrl(cfg, tokenId, origin, Math.floor(Date.now() / 1000)), {
    status: 303,
    headers: NO_STORE,
  })
}
