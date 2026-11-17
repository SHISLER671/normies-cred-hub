import type { Metadata } from "next"
import { headers } from "next/headers"

import { SiteFooter } from "@/components/site-footer"
import { ZuloChromeHeader } from "@/components/zulo-chrome-header"
import {
  ARENA_RANK_LABEL,
  ARENA_RANK_MINIMUM_TEXT,
  ARENA_RANK_ORDER_TEXT,
  ARENA_RANK_SOURCE_LABEL,
  arenaRankCoverageText,
  arenaRankText,
  type ArenaRankResult,
} from "@/lib/arena-rank/core"
import { loadArenaRank } from "@/lib/arena-rank/load"
import { ARENA_SITE, ARENA_STATUS_LINE } from "@/lib/official-status"
import { checkRateLimitById, clientIdFromHeaders } from "@/lib/ratelimit"

import "../../zulo/styles.css"
import "../../burn/burn.css"

// Read on every request: nothing here is page-cached, so a "couldn't read" answer is never kept.
export const dynamic = "force-dynamic"
export const maxDuration = 20

const TITLE = "Arena rank — Normies CredHub"
const DESCRIPTION =
  "Arena agents from official Arena data, with rounds played and wins beside each one. No agent is ranked until it has enough rounds and days and passes the trust gate. A track record, never a tip. DYOR."
const PAGE_LIMIT_PER_MIN = 20

export const metadata: Metadata = {
  alternates: { canonical: "/arena/rank", types: { "application/json": "/api/arena-rank" } },
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { title: "Arena rank", description: DESCRIPTION, url: "/arena/rank", siteName: "Normies CredHub", type: "website" },
  twitter: { card: "summary", title: "Arena rank", description: DESCRIPTION },
}

type View = { kind: "limited"; text: string } | { kind: "answer"; result: ArenaRankResult }

async function answer(): Promise<View> {
  const rl = await checkRateLimitById(clientIdFromHeaders(await headers()), "arena-rank-page", PAGE_LIMIT_PER_MIN, 60)
  if (!rl.ok) return { kind: "limited", text: `Too many lookups from your network. Try again in ${rl.retryAfter} seconds.` }
  return { kind: "answer", result: await loadArenaRank() }
}

const utcTime = (iso: string) => new Date(iso).toUTCString().replace(" GMT", " UTC")

export default async function ArenaRankPage() {
  const view = await answer()
  const result = view.kind === "answer" ? view.result : null

  return (
    <div className="zulo-chrome min-h-screen burn-page">
      <ZuloChromeHeader />
      <div className="header-spacer" aria-hidden />
      <main className="burn-main" id="main">
        <header className="burn-hero nb-grid-bg">
          <h1 className="burn-title">Arena rank</h1>
          <p className="burn-tagline">{ARENA_RANK_LABEL}</p>
        </header>
        <p className="burn-hint" style={{ marginBottom: 28 }}>
          This is NCH&apos;s read-only view of official Arena data (api.normies.art). It is not the Arena itself: the game is at{" "}
          <a href={ARENA_SITE} target="_blank" rel="noopener noreferrer">arena.normies.art</a>. Looking up one wallet?{" "}
          <a href="/arena">Arena wallet check</a>.
        </p>

        <div className="burn-box burn-small" data-tag="How ranking works" style={{ marginBottom: 28 }}>
          <p className="burn-small">{ARENA_RANK_MINIMUM_TEXT}.</p>
          <p className="burn-small">{ARENA_RANK_ORDER_TEXT}. Rounds played and wins are shown beside every Normie so anyone can check the math.</p>
          <p className="burn-small">
            Agents only. There is no overall rank, and this is separate from Pulse: Pulse is trust, never skill.
          </p>
        </div>

        <div id="result" className="burn-results">
          {view.kind === "limited" && <p className="burn-box burn-small" data-tag="Slow down">{view.text}</p>}
          {result && result.kind !== "ok" && (
            <p className="burn-box burn-small" data-tag="Result">
              {arenaRankText(result)}.
              {result.kind !== "unavailable" ? ` Source: ${ARENA_RANK_SOURCE_LABEL}, as of ${utcTime(result.as_of)}.` : ""}
            </p>
          )}
          {result && result.kind === "ok" && (
            <>
              <div className="burn-box" data-tag="Ranked">
                <p className="burn-small">{arenaRankText(result)}.</p>
              </div>
              <div className="burn-box" data-tag="Building a record">
                <p className="burn-small">
                  {arenaRankCoverageText(result.coverage)}.{" "}
                  {result.coverage.rounds_differ ? "Listed by rounds played, then Normie number" : "Listed by Normie number"}: this order is not a rank.
                </p>
                <table className="burn-table">
                  <thead>
                    <tr>
                      <th scope="col" style={{ whiteSpace: "nowrap" }}>Normie</th>
                      <th scope="col" style={{ whiteSpace: "nowrap" }}>Rounds played</th>
                      <th scope="col" style={{ whiteSpace: "nowrap" }}>Wins</th>
                      <th scope="col">Where it stands</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.normies.map((n) => (
                      <tr key={n.token_id}>
                        <td style={{ whiteSpace: "nowrap" }}><a href={n.record_path}>#{n.token_id}</a></td>
                        <td>{n.rounds_played}</td>
                        <td>{n.wins}</td>
                        <td>{n.status_text}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="burn-small">
                  Raw counts: {result.counts.listed} agents listed · {result.counts.ranked} ranked · {result.counts.not_enough_rounds} not enough rounds yet
                  {result.counts.not_enough_days > 0 ? ` · ${result.counts.not_enough_days} not enough days yet` : ""}
                  {result.counts.first_round_unchecked > 0 ? ` · ${result.counts.first_round_unchecked} first-round date not checked yet` : ""}
                  {result.counts.gate_unchecked > 0 ? ` · ${result.counts.gate_unchecked} trust gate not checked yet` : ""}. Counts can change
                  while a round is in progress. Each Normie links to its record card. Source: {ARENA_RANK_SOURCE_LABEL}, as of{" "}
                  {utcTime(result.as_of)}.
                </p>
              </div>
            </>
          )}
        </div>

        <p className="burn-small">
          {ARENA_STATUS_LINE}. Being registered is not a record. {ARENA_RANK_LABEL} Don&apos;t take our word for it: every number here comes
          from the official Arena data.
        </p>
      </main>
      <SiteFooter />
    </div>
  )
}
