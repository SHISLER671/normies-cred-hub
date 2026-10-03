import type { Metadata } from "next"
import { headers } from "next/headers"
import Link from "next/link"

import { SiteFooter } from "@/components/site-footer"
import { ZuloChromeHeader } from "@/components/zulo-chrome-header"
import { realDeps } from "@/lib/burn-buy/data"
import { BurnConnect } from "@/components/burn-connect"
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
        <div className="burn-hero">
          <span className="burn-face" aria-hidden="true" />
          <div>
            <h1 className="burn-title">Burn or keep?</h1>
            <p className="burn-tagline">Pixels are forever. So are burns. Look twice, burn once.</p>
          </div>
        </div>
        <p className="burn-lede">
          Type in a wallet address and pick what you care about. You get one plain answer: what to burn, what to keep, and why.
        </p>

        <form method="get" action="/burn" className="burn-card burn-form">
          <div className="burn-step">
            <label htmlFor="wallet" className="burn-label"><span className="burn-num">1</span> Your wallet address</label>
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
            </div>
            <p id="wallet-help" className="burn-help burn-safe">
              <strong>Just look. No signing.</strong> You only type an address. We read public blockchain data. Nothing here asks you to connect, sign, approve or pay.
            </p>
          </div>

          <fieldset className="burn-step burn-goals">
            <legend className="burn-label"><span className="burn-num">2</span> What are you burning for?</legend>
            <div className="burn-goal-grid">
              {GOALS.map((g) => (
                <label key={g.id} className="burn-goal">
                  <input type="radio" name="goal" value={g.id} defaultChecked={g.id === goal} />
                  <span className="burn-goal-body">
                    <strong>{g.label}</strong>
                    <span>{g.blurb}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <button type="submit" className="burn-button burn-button-big">Show my answer</button>
        </form>

        <details className="burn-card burn-connect">
          <summary>Prefer to connect your wallet instead? <span className="burn-sub"> (optional)</span></summary>
          <p className="burn-line">
            Connecting only shares your public address so we can fill the box for you. <strong>It never asks you to sign or approve anything.</strong> If a popup ever asks you to sign, approve or pay, close it. That is not us.
          </p>
          <BurnConnect goal={goal} />
        </details>

        {isExample && outcome.kind === "ok" && (
          <p className="burn-example" role="note">You are looking at an example wallet. Type your own address above.</p>
        )}

        {outcome.kind === "error" ? (
          <section className="burn-card burn-error" role="alert" aria-labelledby="err-h">
            <h2 id="err-h" className="burn-h2">We could not answer that</h2>
            <p>{outcome.message}</p>
          </section>
        ) : (
          <Answer model={outcome.model} result={outcome.result} wallet={wallet} />
        )}

        {outcome.kind === "ok" && outcome.model.goalNotes.length > 0 && <GoalNotes model={outcome.model} />}
        {outcome.kind === "ok" && <Facts result={outcome.result} />}

        <section className="burn-card burn-share" aria-labelledby="share-h">
          <h2 id="share-h" className="burn-h2">Send this answer to the group chat</h2>
          <p className="burn-line">Copy this link. It opens this exact answer for this wallet and goal.</p>
          <input className="burn-input mono" readOnly value={shareUrl} aria-label="Link to this answer" />
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}

function GoalNotes({ model }: { model: PageModel }) {
  const title = model.goal === "arena" ? "About Arena: what is known, and what is not" : model.goal === "art" ? "About painting and burning for art" : "How the revenue share works"
  return (
    <section className="burn-card burn-notes" aria-labelledby="goal-h">
      <h2 id="goal-h" className="burn-h2">{title}</h2>
      <ul className="burn-list">{model.goalNotes.map((n, i) => <li key={i}>{n}</li>)}</ul>
    </section>
  )
}

function Answer({ model, result, wallet }: { model: PageModel; result: BurnBuyResult; wallet: string }) {
  return (
    <>
      <section className="burn-card burn-answer" aria-labelledby="answer-h">
        <h2 id="answer-h" className="burn-h2">
          Your answer <span className="burn-stamp">{model.goal === "arena" ? "ARENA" : model.goal === "art" ? "ART" : "REVENUE SHARE"}</span>
        </h2>
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
                  <th scope="row">
                    #{r.tokenId}
                    {r.type && <span className="burn-sub"> · {r.type}</span>}
                    {model.goal === "arena" && r.level !== null && <span className="burn-sub"> · Level {r.level}</span>}
                    {model.goal !== "arena" && r.originalPixels !== null && <span className="burn-sub"> · {r.originalPixels} px</span>}
                  </th>
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
          <h2 id="moves-h" className="burn-h2">{model.goal === "share" ? "Best moves, ranked by score gained per ETH" : model.goal === "arena" ? "If you want more Level on a Normie you keep" : "If you want a bigger paint budget"}</h2>
          <ol className="burn-list">
            {model.moves.map((m, i) => (
              <li key={i}><strong>{m.title}.</strong> <span>{m.detail}</span></li>
            ))}
          </ol>
        </section>
      )}

      {model.fodder.length > 0 && (
        <section className="burn-card" aria-labelledby="buy-h">
          <h2 id="buy-h" className="burn-h2">Buying? The cheapest #PIXEL per ETH right now</h2>
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
      <h2 id="facts-h" className="burn-h2">Please read before you burn anything</h2>
      <ul className="burn-list">
        <li><strong>A burn is permanent.</strong> It cannot be undone. Double-check on normies.art before you burn.</li>
        <li><strong>This page is look-only.</strong> It reads public blockchain data. It cannot sign, spend, approve or move anything. We will never ask for your seed phrase. If any site or person asks you to sign something to &quot;verify&quot; or &quot;claim&quot;, walk away.</li>
        <li><strong>This is not financial advice.</strong> Nothing here is a promise of profit. The revenue-share pool changes, and past payouts do not predict future ones.</li>
        <li><strong>#PIXEL has no market price yet.</strong> The prices in the official Pixel Market demo (for example 0.016 ETH per #PIXEL) are labelled &quot;sample numbers from the demo, not real prices&quot;. Please do not quote them. Moves here are ranked by score, not by value.</li>
        <li><strong>How a burn works</strong> (official video): 1) Commit: the Normies you chose are burned and gone for good. 2) Wait about a minute while the chain produces the randomness for your roll. 3) Reveal: your pixels arrive. Bigger faces earn more.</li>
        <li>
          <strong>The 4% burn rate is a promo.</strong> It is planned to end when Pixel Market launches, planned for October 5, audits permitting. That date is not guaranteed. Check @normiesART before you act.
        </li>
        <li>Burn yield is paid on a Normie&apos;s ORIGINAL pixel count (what the contract pays on), not on its edited art.</li>
        <li><strong>We can be wrong.</strong> This is an independent community tool, not made or endorsed by the Normies team. Their site and @normiesART are the source of truth.</li>
        {result.census.indexOldestIndexedAt && (
          <li>
            Census and rarity data come from an index last refreshed <time dateTime={result.census.indexOldestIndexedAt}>{utc(result.census.indexOldestIndexedAt)}</time>. Your own Normies are read live.
          </li>
        )}
        {bad.map(([name, s]) => <li key={name} role="alert"><strong>Data source down: {name}.</strong> {s.error}</li>)}
      </ul>
      <p className="caption">For developers and bots: <code className="mono">/api/burn-buy?wallet=…</code></p>
    </section>
  )
}
