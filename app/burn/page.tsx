import type { Metadata } from "next"
import { headers } from "next/headers"
import Link from "next/link"

import { SiteFooter } from "@/components/site-footer"
import { ZuloChromeHeader } from "@/components/zulo-chrome-header"
import { realDeps } from "@/lib/burn-buy/data"
import { buildPageModel, MAX_ROWS, type PageModel } from "@/lib/burn-buy/narrate"
import { buildBurnBuy, SourceError, type BurnBuyResult } from "@/lib/burn-buy/service"
import { checkRateLimitById } from "@/lib/ratelimit"

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

async function answer(wallet: string): Promise<Outcome> {
  if (!(ADDRESS.test(wallet) || ENS.test(wallet))) {
    return { kind: "error", message: "That is not a wallet. Paste a 0x address (42 characters) or a name ending in .eth." }
  }
  const h = await headers()
  const ip = (h.get("x-forwarded-for") ?? "unknown").split(",")[0].trim()
  const rl = await checkRateLimitById(ip, "burn-page", 12, 60)
  if (!rl.ok) return { kind: "error", message: `Too many lookups. Try again in ${rl.retryAfter} seconds.` }
  try {
    const result = await buildBurnBuy({ wallet }, realDeps)
    return { kind: "ok", result, model: buildPageModel(result) }
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

export default async function BurnPage({ searchParams }: { searchParams: Promise<{ wallet?: string | string[] }> }) {
  const sp = await searchParams
  const raw = (Array.isArray(sp.wallet) ? sp.wallet[0] : sp.wallet)?.trim()
  const isExample = !raw
  const wallet = raw || EXAMPLE_WALLET
  const outcome = await answer(wallet)

  return (
    <div className="zulo-chrome min-h-screen burn-page">
      <ZuloChromeHeader active="burn" />
      <div className="header-spacer" aria-hidden />
      <main className="burn-main" id="main">
        <h1 className="burn-title">Burn or keep?</h1>
        <p className="burn-lede">
          Paste a wallet. You get one plain answer: what to burn for #PIXEL, what to keep, and what to buy, with the reason next to each.
        </p>

        <form method="get" action="/burn" className="burn-form">
          <label htmlFor="wallet" className="caption">Wallet or .eth name</label>
          <div className="burn-form-row">
            <input
              id="wallet"
              name="wallet"
              type="text"
              defaultValue={wallet}
              spellCheck={false}
              autoComplete="off"
              autoCapitalize="off"
              className="burn-input mono"
              aria-describedby="wallet-help"
            />
            <button type="submit" className="burn-button">Get my answer</button>
          </div>
          <p id="wallet-help" className="burn-help">
            Use the wallet that OWNS the Normies, not a delegate. Read-only: this page never asks you to sign or connect anything.
          </p>
        </form>

        {isExample && outcome.kind === "ok" && (
          <p className="burn-example" role="note">Showing an example wallet. Paste your own above.</p>
        )}

        {outcome.kind === "error" ? (
          <section className="burn-card burn-error" role="alert" aria-labelledby="err-h">
            <h2 id="err-h">Could not answer</h2>
            <p>{outcome.message}</p>
          </section>
        ) : (
          <Answer model={outcome.model} result={outcome.result} wallet={wallet} />
        )}

        {outcome.kind === "ok" && <Facts result={outcome.result} />}
      </main>
      <SiteFooter />
    </div>
  )
}

function Answer({ model, result, wallet }: { model: PageModel; result: BurnBuyResult; wallet: string }) {
  return (
    <>
      <section className="burn-card burn-answer" aria-labelledby="answer-h">
        <h2 id="answer-h" className="burn-h2">Your answer</h2>
        <p className="burn-headline">{model.headline}</p>
        {model.lines.map((l, i) => <p key={i} className="burn-line">{l}</p>)}
        {model.delegateOf.length > 0 && (
          <ul className="burn-list">
            {model.delegateOf.map((d) => (
              <li key={d.tokenId}>
                #{d.tokenId} is owned by <span className="mono">{d.owner}</span>.{" "}
                <Link href={`/burn?wallet=${d.owner}`}>Use the owner wallet</Link>
              </li>
            ))}
          </ul>
        )}
        <p className="caption">
          Answer for {result.wallet?.ens ?? (result.wallet ? short(result.wallet.address) : short(wallet))} · as of <time dateTime={result.asOf}>{utc(result.asOf)}</time>
        </p>
      </section>

      {model.rows.length > 0 && (
        <section className="burn-card" aria-labelledby="rows-h">
          <h2 id="rows-h" className="burn-h2">Each Normie you hold</h2>
          <table className="burn-table">
            <caption className="sr-only">For each Normie: keep or burn candidate, why, and what burning would pay</caption>
            <thead>
              <tr><th scope="col">Normie</th><th scope="col">Verdict</th><th scope="col">Why</th><th scope="col">If burned</th></tr>
            </thead>
            <tbody>
              {model.rows.slice(0, MAX_ROWS).map((r) => (
                <tr key={r.tokenId}>
                  <th scope="row">#{r.tokenId}{r.originalPixels !== null && <span className="burn-sub"> · {r.originalPixels} px</span>}</th>
                  <td><strong className={`burn-verdict burn-verdict-${r.verdict}`}>{r.label}</strong></td>
                  <td>{r.reasons.join("; ")}</td>
                  <td>{r.pays}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {model.rows.length > MAX_ROWS && (
            <p className="burn-line">
              Showing the {MAX_ROWS} that pay most of your {model.rows.length} Normies. The full list is in the machine-readable version: <code className="mono">/api/burn-buy?wallet=…</code>
            </p>
          )}
        </section>
      )}

      {model.moves.length > 0 && (
        <section className="burn-card" aria-labelledby="moves-h">
          <h2 id="moves-h" className="burn-h2">Best moves, ranked by score gained per ETH</h2>
          <ol className="burn-list">
            {model.moves.map((m, i) => (
              <li key={i}><strong>{m.title}.</strong> <span>{m.detail}</span></li>
            ))}
          </ol>
        </section>
      )}

      {model.fodder.length > 0 && (
        <section className="burn-card" aria-labelledby="buy-h">
          <h2 id="buy-h" className="burn-h2">If you are buying: most #PIXEL per ETH</h2>
          <p className="burn-line">Listings worth burning (nothing the keep rules protect). Higher is better.</p>
          <table className="burn-table">
            <caption className="sr-only">Cheapest ways to get #PIXEL by burning a bought Normie</caption>
            <thead><tr><th scope="col">Normie</th><th scope="col">Price</th><th scope="col">Burn pays</th><th scope="col">Per ETH</th></tr></thead>
            <tbody>
              {model.fodder.map((f) => (
                <tr key={f.tokenId}>
                  <th scope="row">{f.url ? <a href={f.url} target="_blank" rel="noopener noreferrer">#{f.tokenId}</a> : <>#{f.tokenId}</>}</th>
                  <td>{f.priceEth} ETH</td>
                  <td>{f.pays} #PIXEL</td>
                  <td>{f.perEth} #PIXEL/ETH</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  )
}

function Facts({ result }: { result: BurnBuyResult }) {
  const bad = Object.entries(result.sources).filter(([, s]) => !s.ok)
  return (
    <section className="burn-card burn-facts" aria-labelledby="facts-h">
      <h2 id="facts-h" className="burn-h2">Read this before you burn anything</h2>
      <ul className="burn-list">
        <li><strong>Burns are permanent.</strong> Double-check on normies.art first. This page is read-only and cannot sign, spend or move anything.</li>
        <li>
          <strong>The 4% burn rate is a promo.</strong> It is planned to end when Pixel Market launches, planned for October 5, audits permitting. That date is not guaranteed, so check @normiesART before you act.
        </li>
        <li>#PIXEL has no market price yet, so moves are compared by score, not by value. Not financial advice.</li>
        <li>Yield uses each Normie&apos;s ORIGINAL pixel count (what the contract pays on), not its edited art.</li>
        {result.census.indexOldestIndexedAt && (
          <li>
            Census and rarity data come from an index last refreshed <time dateTime={result.census.indexOldestIndexedAt}>{utc(result.census.indexOldestIndexedAt)}</time>. Your own Normies are read live.
          </li>
        )}
        {bad.map(([name, s]) => <li key={name} role="alert"><strong>Data source down: {name}.</strong> {s.error}</li>)}
      </ul>
      <p className="caption">Machine-readable version of this answer: <code className="mono">/api/burn-buy?wallet=…</code></p>
    </section>
  )
}
