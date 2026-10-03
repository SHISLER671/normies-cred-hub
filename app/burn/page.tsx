import type { Metadata } from "next"
import { headers } from "next/headers"
import Link from "next/link"

import { SiteFooter } from "@/components/site-footer"
import { ZuloChromeHeader } from "@/components/zulo-chrome-header"
import { realDeps } from "@/lib/burn-buy/data"
import { BurnConnect } from "@/components/burn-connect"
import { BurnForm } from "@/components/burn-form"
import { CopyLink } from "@/components/burn-copy"
import { buildPageModel, GOALS, MAX_ROWS, parseGoal, type Goal, type PageModel } from "@/lib/burn-buy/narrate"
import { buildBurnBuy, SourceError, type BurnBuyResult } from "@/lib/burn-buy/service"
import { checkRateLimitById } from "@/lib/ratelimit"
import { DEFAULT_SITE_ORIGIN } from "@/lib/site-origin"

import "../zulo/styles.css"
import "./burn.css"

export const dynamic = "force-dynamic"
export const maxDuration = 20

export const metadata: Metadata = {
  title: "Burn or keep? — Normies CredHub",
  description:
    "Paste a wallet. Get a plain answer: which Normies to burn for #PIXEL, which to keep, and what to buy. Read-only; nothing here can sign or move anything.",
}

/** Ryan's OWNER wallet (not 32626.eth, which is only a delegate). Shown as the example until you paste your own. */
const EXAMPLE_WALLET = "0xFafd8Fb6b4E43ACE0E365553f1b9242384591031"
const ADDRESS = /^0x[a-fA-F0-9]{40}$/
const ENS = /^(?=.{3,255}$)(?:[a-z0-9-]+\.)+eth$/i

type Outcome =
  | { kind: "ok"; result: BurnBuyResult; model: PageModel }
  | { kind: "error"; message: string }

async function answer(wallet: string, goal: Goal): Promise<Outcome> {
  if (!(ADDRESS.test(wallet) || ENS.test(wallet))) {
    return { kind: "error", message: "That is not a wallet. Paste a 0x address (42 characters) or a name ending in .eth." }
  }
  const h = await headers()
  const ip = (h.get("x-forwarded-for") ?? "unknown").split(",")[0].trim()
  const rl = await checkRateLimitById(ip, "burn-page", 12, 60)
  if (!rl.ok) return { kind: "error", message: `Too many lookups. Try again in ${rl.retryAfter} seconds.` }
  try {
    const result = await buildBurnBuy({ wallet }, realDeps)
    return { kind: "ok", result, model: buildPageModel(result, goal) }
  } catch (err) {
    if (err instanceof SourceError && err.kind === "invalid-input") return { kind: "error", message: err.message }
    if (err instanceof SourceError) {
      return { kind: "error", message: `Could not reach a data source (${err.source}). Nothing is wrong with your wallet. Try again in a minute.` }
    }
    console.error("[burn page] unexpected failure", err)
    return { kind: "error", message: "Something went wrong on our side. Try again in a minute." }
  }
}

const utc = (iso: string) => iso.slice(0, 16).replace("T", " ") + " UTC"
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`
const SHORT_VERDICT = { keep: "KEEP", burn: "BURN?", neutral: "EITHER" } as const
const GOAL_NAME = { share: "Revenue share", arena: "Arena", art: "Art" } as const

export default async function BurnPage({ searchParams }: { searchParams: Promise<{ wallet?: string | string[]; goal?: string | string[] }> }) {
  const sp = await searchParams
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim()
  const raw = first(sp.wallet)
  const goal = parseGoal(first(sp.goal))
  const isExample = !raw
  const wallet = raw || EXAMPLE_WALLET
  const outcome = await answer(wallet, goal)
  const shareUrl = `${DEFAULT_SITE_ORIGIN}/burn?wallet=${encodeURIComponent(wallet)}&goal=${goal}`

  return (
    <div className="zulo-chrome min-h-screen burn-page">
      <ZuloChromeHeader active="burn" showActiveNormie={false} />
      <div className="header-spacer" aria-hidden />
      <main className="burn-main" id="main">
        <header className="burn-hero">
          <span className="burn-face" aria-hidden="true" />
          <h1 className="burn-title">Burn or keep?</h1>
          <p className="burn-tagline">Look twice. Burn once.</p>
        </header>

        <BurnForm key={`${wallet}|${goal}`} wallet={wallet} goal={goal}>
          <details className="burn-link">
            <summary>or connect a wallet <span>(optional)</span></summary>
            <p>Connecting only shares your public address so we can fill the box. It never asks you to sign or approve anything. If a popup ever asks you to sign, approve or pay, close it. That is not us.</p>
            <BurnConnect goal={goal} />
          </details>

          {isExample && outcome.kind === "ok" && <p className="burn-example" role="note">Example wallet. Type your own address above.</p>}

          {outcome.kind === "error" ? (
            <section className="burn-box burn-error" data-tag="Oops" role="alert">
              <p className="burn-headline">We could not answer that.</p>
              <p className="burn-small">{outcome.message}</p>
            </section>
          ) : (
            <Results model={outcome.model} result={outcome.result} wallet={wallet} />
          )}

          {outcome.kind === "ok" && outcome.model.goalNotes.length > 0 && <GoalNotes model={outcome.model} />}
          {outcome.kind === "ok" && <FinePrint result={outcome.result} />}

          <section className="burn-sharebar" aria-label="Share this answer">
            <span className="burn-cap">Send this answer to the group chat</span>
            <CopyLink url={shareUrl} />
          </section>
        </BurnForm>
      </main>
      <SiteFooter />
    </div>
  )
}

function Results({ model, result, wallet }: { model: PageModel; result: BurnBuyResult; wallet: string }) {
  const w = result.wallet
  const holds = model.state === "holds" && w
  const detail = model.lines.slice(holds ? 1 : 0).filter((l) => !model.notices.includes(l))
  const who = w?.ens ?? (w ? short(w.address) : short(wallet))
  return (
    <>
      <section className="burn-box burn-answer" data-tag={`Your answer · ${GOAL_NAME[model.goal]}`} aria-labelledby="answer-h">
        <h2 id="answer-h" className="sr-only">Your answer</h2>
        <p className="burn-headline">{model.headline}</p>
        {model.notices.map((n) => <p key={n} className="burn-note" role="note">{n}</p>)}

        {holds && (
          <dl className="burn-stats">
            <div><dt>{w.advice.held === 1 ? "Normie" : "Normies"}</dt><dd>{w.advice.held}</dd></div>
            <div><dt>#PIXEL</dt><dd>{w.advice.pixel}</dd></div>
            <div><dt>Score</dt><dd>{w.advice.score}</dd></div>
            <div><dt>Of the pool</dt><dd>{w.advice.sharePct}%</dd></div>
          </dl>
        )}

        {!holds && detail.map((l, i) => <p key={i} className="burn-small">{l}</p>)}
        {model.delegateOf.length > 0 && (
          <ul className="burn-plain">
            {model.delegateOf.map((d) => (
              <li key={d.tokenId}>
                #{d.tokenId} is owned by <span className="burn-mono">{short(d.owner)}</span>. <Link href={`/burn?wallet=${d.owner}&goal=${model.goal}`}>Use the owner wallet →</Link>
              </li>
            ))}
          </ul>
        )}

        <p className="burn-cap">For {who} · as of <time dateTime={result.asOf}>{utc(result.asOf)}</time></p>

        {holds && detail.length > 0 && (
          <details className="burn-more">
            <summary>More detail</summary>
            <ul className="burn-plain">{detail.map((l, i) => <li key={i}>{l}</li>)}</ul>
          </details>
        )}
      </section>

      {model.rows.length > 0 && (
        <section className="burn-sec" aria-labelledby="rows-h">
          <h2 id="rows-h" className="burn-cap">Your Normies · {model.rows.length}</h2>
          <ul className="burn-tiles">
            {model.rows.slice(0, MAX_ROWS).map((r) => (
              <li key={r.tokenId}>
                <details className="burn-tile" data-verdict={r.verdict}>
                  <summary>
                    <span className="burn-pill" data-verdict={r.verdict}>{SHORT_VERDICT[r.verdict]}<span className="sr-only"> ({r.label})</span></span>
                    <span className="burn-id">#{r.tokenId}</span>
                    <span className="burn-sub">
                      {[r.type, model.goal === "arena" && r.level !== null ? `Level ${r.level}` : r.originalPixels !== null ? `${r.originalPixels} px` : null].filter(Boolean).join(" · ")}
                    </span>
                    <span className="burn-yield">{r.yieldText}</span>
                  </summary>
                  <div className="burn-body">
                    <p>{r.reasons.join("; ")}.</p>
                    <p className="burn-small">{r.pays}</p>
                  </div>
                </details>
              </li>
            ))}
          </ul>
          {model.rows.length > MAX_ROWS && (
            <p className="burn-small">Showing the {MAX_ROWS} that pay most, of {model.rows.length}. Everything is in <code className="burn-mono">/api/burn-buy?wallet=…</code></p>
          )}
        </section>
      )}

      {model.moves.length > 0 && (
        <section className="burn-sec" aria-labelledby="moves-h">
          <h2 id="moves-h" className="burn-cap">{model.goal === "share" ? "Best moves" : model.goal === "arena" ? "To add Level" : "To add paint budget"}</h2>
          <ol className="burn-moves">
            {model.moves.map((m, i) => (
              <li key={i}>
                <details className="burn-move" open={i === 0}>
                  <summary>
                    <span className="burn-num2">{String(i + 1).padStart(2, "0")}</span>
                    <span className="burn-movetitle">{m.title}</span>
                    <span className="burn-chip">{m.stat}</span>
                  </summary>
                  <div className="burn-body"><p className="burn-small">{m.detail}</p></div>
                </details>
              </li>
            ))}
          </ol>
        </section>
      )}

      {model.fodder.length > 0 && (
        <details className="burn-box burn-fold" data-tag="Buying?">
          <summary><span>Cheapest #PIXEL per ETH</span><span className="burn-sub">{model.fodder.length} listings</span></summary>
          <table className="burn-table">
            <caption className="sr-only">Cheapest ways to get #PIXEL by burning a bought Normie</caption>
            <thead><tr><th scope="col">Normie</th><th scope="col">Price</th><th scope="col">Pays</th><th scope="col">Per ETH</th></tr></thead>
            <tbody>
              {model.fodder.map((f) => (
                <tr key={f.tokenId}>
                  <th scope="row">{f.url ? <a href={f.url} target="_blank" rel="noopener noreferrer">#{f.tokenId}</a> : <>#{f.tokenId}</>}</th>
                  <td>{f.priceEth} ETH</td>
                  <td>{f.pays}</td>
                  <td>{f.perEth}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </>
  )
}

function GoalNotes({ model }: { model: PageModel }) {
  const title = model.goal === "arena" ? "About Arena: known and unknown" : model.goal === "art" ? "About painting and burning for art" : "How the revenue share works"
  return (
    <details className="burn-box burn-fold" data-tag="Good to know">
      <summary><span>{title}</span></summary>
      <ul className="burn-plain">{model.goalNotes.map((n, i) => <li key={i}>{n}</li>)}</ul>
    </details>
  )
}

function FinePrint({ result }: { result: BurnBuyResult }) {
  const bad = Object.entries(result.sources).filter(([, s]) => !s.ok)
  return (
    <section className="burn-fine" aria-labelledby="fine-h">
      <h2 id="fine-h" className="sr-only">Please read before you burn anything</h2>
      <ul className="burn-chips" aria-label="The short version">
        <li>Burns are permanent</li>
        <li>Look-only · never signs</li>
        <li>Not financial advice</li>
      </ul>
      <details className="burn-box burn-fold" data-tag="Fine print">
        <summary><span>Read before you burn anything</span></summary>
        <ul className="burn-plain">
          <li><strong>A burn is permanent.</strong> It cannot be undone. Double-check on normies.art before you burn.</li>
          <li><strong>This page is look-only.</strong> It reads public blockchain data. It cannot sign, spend, approve or move anything. We will never ask for your seed phrase. If any site or person asks you to sign something to &quot;verify&quot; or &quot;claim&quot;, walk away.</li>
          <li><strong>This is not financial advice.</strong> Nothing here is a promise of profit. The revenue-share pool changes, and past payouts do not predict future ones.</li>
          <li><strong>#PIXEL has no market price yet.</strong> The prices in the official Pixel Market demo (for example 0.016 ETH per #PIXEL) are labelled &quot;sample numbers from the demo, not real prices&quot;. Please do not quote them. Moves here are ranked by score, not by value.</li>
          <li><strong>How a burn works</strong> (official video): 1) Commit: the Normies you chose are burned and gone for good. 2) Wait about a minute while the chain produces the randomness for your roll. 3) Reveal: your pixels arrive. Bigger faces earn more.</li>
          <li><strong>The 4% burn rate is a promo.</strong> It is planned to end when Pixel Market launches, planned for October 5, audits permitting. That date is not guaranteed. Check @normiesART before you act.</li>
          <li>Burn yield is paid on a Normie&apos;s ORIGINAL pixel count (what the contract pays on), not on its edited art.</li>
          <li><strong>We can be wrong.</strong> This is an independent community tool, not made or endorsed by the Normies team. Their site and @normiesART are the source of truth.</li>
          {result.census.indexOldestIndexedAt && (
            <li>Census and rarity data come from an index last refreshed <time dateTime={result.census.indexOldestIndexedAt}>{utc(result.census.indexOldestIndexedAt)}</time>. Your own Normies are read live.</li>
          )}
          {bad.map(([name, s]) => <li key={name} role="alert"><strong>Data source down: {name}.</strong> {s.error}</li>)}
        </ul>
        <p className="burn-cap">For developers and bots: <code className="burn-mono">/api/burn-buy?wallet=…</code></p>
      </details>
    </section>
  )
}
