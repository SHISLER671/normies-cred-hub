import type { Metadata } from "next"
import { headers } from "next/headers"

import { SiteFooter } from "@/components/site-footer"
import { ZuloChromeHeader } from "@/components/zulo-chrome-header"
import { ARENA_WALLET_COUNTS_NOTE, ARENA_WALLET_SOURCE_LABEL, arenaWalletText, walletLabel, type ArenaWalletResult } from "@/lib/arena-wallet/core"
import { loadArenaWallet } from "@/lib/arena-wallet/load"
import { ARENA_SITE, ARENA_STATUS_LINE } from "@/lib/official-status"
import { checkRateLimitById, clientIdFromHeaders } from "@/lib/ratelimit"

import "../zulo/styles.css"
import "../burn/burn.css"

// Read on every request: nothing here is page-cached, so a "couldn't read" answer is never kept.
export const dynamic = "force-dynamic"
export const maxDuration = 20

const TITLE = "Arena wallet check — Normies CredHub"
const DESCRIPTION =
  "Enter a wallet address or ENS name to see that wallet's Normies in the Arena: each one's official state and status line, with its record card. Read-only view of official Arena data."
const PAGE_LIMIT_PER_MIN = 20

export const metadata: Metadata = {
  alternates: { canonical: "/arena", types: { "application/json": "/api/arena-wallet" } },
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { title: "Arena wallet check", description: DESCRIPTION, url: "/arena", siteName: "Normies CredHub", type: "website" },
  twitter: { card: "summary", title: "Arena wallet check", description: DESCRIPTION },
}

type View = { kind: "limited"; text: string } | { kind: "answer"; result: ArenaWalletResult }

async function answer(wallet: string | undefined): Promise<View> {
  if (!wallet) return { kind: "answer", result: { kind: "missing" } }
  const rl = await checkRateLimitById(clientIdFromHeaders(await headers()), "arena-wallet-page", PAGE_LIMIT_PER_MIN, 60)
  if (!rl.ok) return { kind: "limited", text: `Too many lookups from your network. Try again in ${rl.retryAfter} seconds.` }
  return { kind: "answer", result: await loadArenaWallet(wallet) }
}

const utcTime = (iso: string) => new Date(iso).toUTCString().replace(" GMT", " UTC")

export default async function ArenaWalletPage({ searchParams }: { searchParams: Promise<{ wallet?: string | string[] }> }) {
  const sp = await searchParams
  const typed = (Array.isArray(sp.wallet) ? sp.wallet[0] : sp.wallet)?.trim() || undefined
  const view = await answer(typed)
  const result = view.kind === "answer" ? view.result : null
  // Only a wallet that passed the check is ever shown again: as its ENS name or 0x1234…abcd, never what was typed and
  // never the full address. The box is refilled only with an ENS name.
  const known = result && (result.kind === "ok" || result.kind === "empty" || result.kind === "not_found") ? result : null
  const label = known ? walletLabel(known.wallet) : null

  return (
    <div className="zulo-chrome min-h-screen burn-page">
      <ZuloChromeHeader />
      <div className="header-spacer" aria-hidden />
      <main className="burn-main" id="main">
        <header className="burn-hero nb-grid-bg">
          <h1 className="burn-title">Arena wallet check</h1>
          <p className="burn-tagline">A wallet in, its Normies in the Arena out.</p>
        </header>
        <p className="burn-hint" style={{ marginBottom: 28 }}>
          This is NCH&apos;s read-only view of official Arena data (api.normies.art). It is not the Arena itself: the game is at{" "}
          <a href={ARENA_SITE} target="_blank" rel="noopener noreferrer">arena.normies.art</a>, and NCH can&apos;t enter anyone. All Arena agents:{" "}
          <a href="/arena/rank">Arena rank</a>.
        </p>

        <form method="get" action="/arena#result" className="burn-box burn-form" data-tag="Wallet">
          <label htmlFor="wallet" className="sr-only">Wallet address or .eth name</label>
          <div className="burn-inputrow">
            <input id="wallet" name="wallet" type="text" defaultValue={known?.wallet.ens ?? ""} placeholder="0x… or yourname.eth" inputMode="text" enterKeyHint="go" spellCheck={false} autoComplete="off" autoCapitalize="off" maxLength={300} className="burn-input" />
            <button type="submit" className="burn-go" aria-label="Check this wallet's Normies in the Arena"><span>Check</span><span aria-hidden="true">→</span></button>
          </div>
          <p className="burn-safeline">A wallet address or ENS name only · look-only · no signing</p>
        </form>

        <div id="result" className="burn-results">
          {view.kind === "limited" && <p className="burn-box burn-small" data-tag="Slow down">{view.text}</p>}
          {result && result.kind !== "missing" && result.kind !== "ok" && (
            <p className="burn-box burn-small" data-tag="Result">
              {label ? <><span className="mono">{label}</span>: </> : null}
              {arenaWalletText(result)}.
              {result.kind === "empty" && !result.counts_match ? ` ${ARENA_WALLET_COUNTS_NOTE}` : ""}
              {known ? ` Source: ${ARENA_WALLET_SOURCE_LABEL}, as of ${utcTime(known.as_of)}.` : ""}
            </p>
          )}
          {result && result.kind === "ok" && (
            <div className="burn-box" data-tag="Result">
              <p className="burn-small"><span className="mono">{label}</span>: {arenaWalletText(result)}.</p>
              <table className="burn-table">
                <thead>
                  <tr>
                    <th scope="col" style={{ whiteSpace: "nowrap" }}>Normie</th>
                    <th scope="col">Arena state</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {result.normies.map((n) => (
                    <tr key={n.token_id}>
                      <td style={{ whiteSpace: "nowrap" }}><a href={n.record_path}>#{n.token_id}</a></td>
                      <td>{n.state_text}</td>
                      <td>{n.status_text}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="burn-small">
                Raw counts: {result.counts.listed} listed · official totals: {result.counts.registered} registered · {result.counts.active} active · {result.counts.short} short.
                {result.counts_match ? "" : ` ${ARENA_WALLET_COUNTS_NOTE}`}{" "}
                Each Normie links to its record card. Source: {ARENA_WALLET_SOURCE_LABEL}, as of {utcTime(result.as_of)}.
              </p>
            </div>
          )}
        </div>

        <p className="burn-small">
          {ARENA_STATUS_LINE}. Being registered is not a record: a Normie has a record only after it plays a round. A track record, never a tip.
        </p>
      </main>
      <SiteFooter />
    </div>
  )
}
