import type { Metadata } from "next"
import { headers } from "next/headers"
import Link from "next/link"

import { SiteFooter } from "@/components/site-footer"
import { ZuloChromeHeader } from "@/components/zulo-chrome-header"
import { realDeps } from "@/lib/burn-buy/data"
import { BurnConnect } from "@/components/burn-connect"
import { ConnectWallet } from "@/components/connect-wallet"
import { BurnForm } from "@/components/burn-form"
import { CopyLink } from "@/components/burn-copy"
import { buildPageModel, GOALS, MAX_ROWS, parseGoal, type Goal, type PageModel } from "@/lib/burn-buy/narrate"
import { buildBurnBuy, isStale, SourceError, STALE_HOURS, type BurnBuyResult } from "@/lib/burn-buy/service"
import { checkRateLimitById, clientIdFromHeaders } from "@/lib/ratelimit"
import { burnJsonLd, jsonLdScript } from "@/lib/burn-buy/jsonld"
import { normalizeWalletInput } from "@/lib/burn-buy/wallet-input"
import { launchTimePassed, PIXEL_MARKET_LAUNCH_TEXT } from "@/lib/burn-buy/market-launch"
import { DEFAULT_SITE_ORIGIN } from "@/lib/site-origin"

import "../zulo/styles.css"
import "./burn.css"

export const dynamic = "force-dynamic"
export const maxDuration = 20

const TITLE = "Burn or keep? — Normies CredHub"
const DESCRIPTION =
  "Paste a wallet. Get a plain answer: which Normies to burn for #PIXEL, which to keep, and what to buy. Read-only; nothing here can sign or move anything."

export const metadata: Metadata = {
  alternates: { types: { "application/json": "/api/burn-buy" } },
  title: TITLE,
  description: DESCRIPTION,
  // Link previews: say what this page does (the site-wide card is about Pulse, Ask and Moves). The card image comes from opengraph-image.tsx.
  openGraph: { title: "Burn or keep? Paste a wallet, get a straight answer", description: "Read-only: no connecting, no signing. For Normies revenue share, Arena and art. Independent community tool.", url: "/burn", siteName: "Normies CredHub", type: "website" },
  twitter: { card: "summary_large_image", title: "Burn or keep? Paste a wallet, get a straight answer", description: "Read-only: no connecting, no signing. For Normies revenue share, Arena and art. Independent community tool." },
}

/** Ryan's OWNER wallet (not 32626.eth, which is only a delegate). Shown as the example until you paste your own. */
const EXAMPLE_WALLET = "0xFafd8Fb6b4E43ACE0E365553f1b9242384591031"
const ADDRESS = /^0x[a-fA-F0-9]{40}$/
const ENS = /^(?=.{3,255}$)(?:[a-z0-9-]+\.)+eth$/i

type Outcome =
  | { kind: "ok"; result: BurnBuyResult; model: PageModel }
  | { kind: "error"; message: string }

/**
 * 20 lookups a minute per IP. Many people on Guam (and other island and carrier networks) share one public IP, so 12 was
 * tight for a group chat all clicking the same link. The example wallet is not counted: its data is cached and shared.
 */
const PAGE_LIMIT_PER_MIN = 20

async function answer(wallet: string, goal: Goal, isExample: boolean): Promise<Outcome> {
  if (!(ADDRESS.test(wallet) || ENS.test(wallet))) {
    return { kind: "error", message: "That is not a wallet. Paste a 0x address (42 characters) or a name ending in .eth." }
  }
  if (!isExample) {
    const rl = await checkRateLimitById(clientIdFromHeaders(await headers()), "burn-page", PAGE_LIMIT_PER_MIN, 60)
    if (!rl.ok) return { kind: "error", message: `Too many lookups from your network. Try again in ${rl.retryAfter} seconds.` }
  }
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
const GOAL_NAME = { share: "Revenue share", arena: "Arena", art: "Art", sell: "Sell" } as const

export default async function BurnPage({ searchParams }: { searchParams: Promise<{ wallet?: string | string[]; goal?: string | string[] }> }) {
  const sp = await searchParams
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim()
  const typed = first(sp.wallet)
  const raw = typed ? normalizeWalletInput(typed) : typed
  const goal = parseGoal(first(sp.goal))
  const isExample = !raw
  const wallet = raw || EXAMPLE_WALLET
  const outcome = await answer(wallet, goal, isExample)
  const shareUrl = `${DEFAULT_SITE_ORIGIN}/burn?wallet=${encodeURIComponent(wallet)}&goal=${goal}`

  return (
    <div className="zulo-chrome min-h-screen burn-page">
      <ZuloChromeHeader
        active="burn"
        trailing={
          <span style={{ display: "inline-flex", alignItems: "center" }}>
            <ConnectWallet />
          </span>
        }
      />
      <div className="header-spacer" aria-hidden />
      <main className="burn-main" id="main">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(burnJsonLd(DEFAULT_SITE_ORIGIN)) }} />
        <header className="burn-hero">
          <span className="burn-face" aria-hidden="true" />
          <h1 className="burn-title">Burn or keep?</h1>
          <p className="burn-tagline">Look twice. Burn once.</p>
        </header>

        {/* The box starts EMPTY (with a placeholder) when we are showing the example, so nobody has to delete someone else's address first. */}
        <BurnForm key={`${isExample ? "" : wallet}|${goal}`} wallet={isExample ? "" : wallet} goal={goal}>
          {/* Right under the box, so it cannot be missed: the answer below is NOT about your wallet. */}
          {isExample && outcome.kind === "ok" && (
            <p className="burn-example" role="note">
              Showing an <strong>example wallet</strong> ({short(EXAMPLE_WALLET)}). Paste your own address above to see your answer.
            </p>
          )}

          <details className="burn-link">
            <summary>or connect a wallet <span>(optional)</span></summary>
            <p>Connecting only shares your public address so we can fill the box. This page never asks you to sign anything. Anywhere on this site, the most we ever ask is one free message that proves you own a wallet: it costs no gas and cannot move anything. We never ask for a transaction, an approval or a transfer. If a popup asks you to sign, approve or pay for something, close it. That is not us.</p>
            <BurnConnect goal={goal} />
          </details>

          {outcome.kind === "error" ? (
            <section className="burn-box burn-error" data-tag="Oops" role="alert">
              <p className="burn-headline">We could not answer that.</p>
              <p className="burn-small">{outcome.message}</p>
            </section>
          ) : (
            <Results model={outcome.model} result={outcome.result} wallet={wallet} isExample={isExample} />
          )}

          {outcome.kind === "ok" && outcome.model.goalNotes.length > 0 && <GoalNotes model={outcome.model} />}
          {outcome.kind === "ok" && <FinePrint result={outcome.result} />}

          {/* Only a real answer is worth sending to the group chat; the example link would just be our own wallet. */}
          {!isExample && (
            <section className="burn-sharebar" aria-label="Share this answer">
              <span className="burn-cap">Send this answer to the group chat</span>
              <CopyLink url={shareUrl} />
            </section>
          )}
        </BurnForm>
      </main>
      <SiteFooter />
    </div>
  )
}

function Results({ model, result, wallet, isExample }: { model: PageModel; result: BurnBuyResult; wallet: string; isExample: boolean }) {
  const w = result.wallet
  const holds = model.state === "holds" && w
  const detail = model.lines.slice(holds ? 1 : 0).filter((l) => !model.notices.includes(l))
  const who = w?.ens ?? (w ? short(w.address) : short(wallet))
  return (
    <>
      <section className="burn-box burn-answer" data-tag={`${isExample ? "Example answer" : "Your answer"} · ${GOAL_NAME[model.goal]}`} aria-labelledby="answer-h">
        <h2 id="answer-h" className="sr-only">{isExample ? "Example answer" : "Your answer"}</h2>
        {/* For the example, a gentle headline: the first thing a visitor reads should not be "buy this NFT" for someone else's wallet. */}
        <p className="burn-headline">{isExample ? "Here is what an answer looks like. Paste your wallet to get yours." : model.headline}</p>
        {isExample && <p className="burn-small">For this example wallet: {model.headline}</p>}
        {model.notices.map((n) => <p key={n} className="burn-note" role="note">{n}</p>)}

        {holds && (
          <dl className="burn-stats">
            <div><dt>{w.advice.held === 1 ? "Normie" : "Normies"}</dt><dd>{w.advice.held}</dd></div>
            <div><dt>#PIXEL</dt><dd>{w.advice.pixel}</dd></div>
            <div><dt>Score</dt><dd>{w.advice.score}</dd></div>
            <div><dt>Pool share now</dt><dd>{w.advice.sharePct}%</dd></div>
          </dl>
        )}

        {model.marketLine && <p className="burn-small burn-marketline">{model.marketLine}</p>}

        {model.nextSteps.length > 0 && (
          <section className="burn-next" aria-labelledby="next-h">
            <h3 id="next-h" className="burn-cap">Next step</h3>
            <ul>
              {model.nextSteps.map((n) => (
                <li key={n.title}><strong>{n.title}</strong><span>{n.detail}</span></li>
              ))}
            </ul>
          </section>
        )}

        {model.cliffNotes.length > 0 && (
          <details className="burn-box burn-fold" data-tag="Selling?" open={model.goal === "sell"}>
            <summary><span>Where you stand on the cliffs</span></summary>
            <ul className="burn-small">
              {model.cliffNotes.map((n) => <li key={n}>{n}</li>)}
            </ul>
          </details>
        )}

        {holds && (
          <p className="burn-small burn-sim">
            <a href="https://www.normies.art/holder" target="_blank" rel="noopener noreferrer">See your Holder Card ↗</a>
            <span> (the official page on normies.art; it is separate from this advice)</span>
          </p>
        )}

        {model.simulatorUrl && (
          <p className="burn-small burn-sim">
            <a href={model.simulatorUrl} target="_blank" rel="noopener noreferrer">What could that pay? Try the revenue share simulator ↗</a>
            <span> (normies.art, opens with your numbers filled in)</span>
          </p>
        )}

        {!holds && detail.map((l, i) => <p key={i} className="burn-small">{l}</p>)}
        {model.delegateOf.length > 0 && <DelegateOwners list={model.delegateOf} goal={model.goal} />}

        <p className="burn-cap">For {who} · as of <time dateTime={result.asOf}>{utc(result.asOf)}</time>{model.marketState === "live" && " · Pixel Market live"}</p>

        {holds && (detail.length > 0 || model.ledger.length > 0) && (
          <details className="burn-more">
            <summary>More detail</summary>
            {model.ledger.length > 0 && (
              <div className="burn-ledger">
                <h3 className="burn-cap">How your score adds up</h3>
                <dl>
                  {model.ledger.map((r) => (
                    <div key={r.label} data-strong={r.strong ? "true" : undefined}><dt>{r.label}</dt><dd>{r.value}</dd></div>
                  ))}
                </dl>
                <p className="burn-small">Score = (Normies x multiplier + #PIXEL ÷ 5) x (1 + boost). Your share = your score ÷ (everyone else + your score).</p>
              </div>
            )}
            {detail.length > 0 && <ul className="burn-plain">{detail.map((l, i) => <li key={i}>{l}</li>)}</ul>}
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
                    {r.jev?.verdict === "double-check" && <span className="burn-jev">Jev: check</span>}
                  </summary>
                  <div className="burn-body">
                    <p>{r.reasons.join("; ")}.</p>
                    <p className="burn-small">{r.pays}</p>
                    {r.jev && <p className="burn-small burn-jevtext"><strong>Second opinion.</strong> {r.jev.text}</p>}
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

      {model.sellView && (
        <section className="burn-sec" aria-labelledby="sell-h">
          <h2 id="sell-h" className="burn-cap">What selling nets</h2>
          <ol className="burn-moves">
            {model.sellView.rows.map((r, i) => (
              <li key={r.label}>
                <details className="burn-move" open={i === 0}>
                  <summary>
                    <span className="burn-num2">{String(i + 1).padStart(2, "0")}</span>
                    <span className="burn-movetitle">{r.label}</span>
                    <span className="burn-chip">{r.net}</span>
                  </summary>
                  <div className="burn-body"><p className="burn-small">{r.detail}</p></div>
                </details>
              </li>
            ))}
          </ol>
          {model.sellView.notes.map((n) => <p key={n} className="burn-small">{n}</p>)}
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
            <thead><tr><th scope="col">Normie</th><th scope="col">Price</th><th scope="col">Pays</th><th scope="col">Per ETH</th><th scope="col">ETH per #PIXEL</th>{model.marketLine && <th scope="col">Versus the ask</th>}</tr></thead>
            <tbody>
              {model.fodder.map((f) => (
                <tr key={f.tokenId}>
                  <th scope="row">{f.url ? <a href={f.url} target="_blank" rel="noopener noreferrer">#{f.tokenId}</a> : <>#{f.tokenId}</>}</th>
                  <td>{f.priceEth} ETH</td>
                  <td>{f.range ? "~" : ""}{f.pays}</td>
                  <td>{f.perEth}</td>
                  <td>{f.ethPerPixelRange ? `${f.ethPerPixelRange.low} to ${f.ethPerPixelRange.high}` : f.ethPerPixel}</td>
                  {model.marketLine && <td>{f.vsAsk ?? ""}{f.breakEven && <><br /><span className="burn-small">Buying #PIXEL beats this Normie above {f.breakEven}</span></>}</td>}
                </tr>
              ))}
            </tbody>
          </table>
          {model.yieldMode === "normal" && <p className="burn-small">~ is the middle of a range. A burn is a roll, so the real result can land anywhere in it.</p>}
          <p className="burn-small">ETH per #PIXEL is what you pay for the Normie divided by what its burn pays: the price of #PIXEL made this way. Compare it with what #PIXEL costs on the Pixel Market before you buy to burn.</p>
        </details>
      )}
    </>
  )
}

function GoalNotes({ model }: { model: PageModel }) {
  const title = model.goal === "arena" ? "About Arena: known and unknown" : model.goal === "art" ? "About painting and burning for art" : model.goal === "sell" ? "About selling #PIXEL" : "How the revenue share works"
  return (
    <details className="burn-box burn-fold" data-tag="Good to know">
      <summary><span>{title}</span></summary>
      {model.goal === "share" && (
        <ol className="burn-loop" aria-label="The loop, in four steps">
          <li><strong>Hold</strong><span>Normies and #PIXEL in one wallet</span></li>
          <li><strong>Pool</strong><span>half of Pixel Market fees and royalties</span></li>
          <li><strong>Paid monthly</strong><span>split by your share, claimed on chain</span></li>
          <li><strong>Grow</strong><span>burn or hold for a bigger score, repeat</span></li>
        </ol>
      )}
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
          {result.wallet?.jev && (
            <li><strong>Second opinions from Jev.</strong> For burn candidates only, this page asks Jev, an AI model from TypeSafe, whether you would plausibly regret the burn. It can only add caution: it never turns a keep into a burn. We send public facts about up to 8 of your Normies (token number, traits, pixel counts and rarity). We do not send your wallet address, but token numbers are public on chain, so someone could look up who owns them. Jev can be wrong.</li>
          )}
          <li><strong>This page is look-only.</strong> It reads public blockchain data. It cannot sign, spend, approve or move anything. We will never ask for your seed phrase. If any site or person asks you to sign something to &quot;verify&quot; or &quot;claim&quot;, walk away.</li>
          <li><strong>This is not financial advice.</strong> Nothing here is a promise of profit. The revenue-share pool changes, and past payouts do not predict future ones.</li>
          {result.marketState === "live" ? (
            <li><strong>This page does not read live #PIXEL prices yet.</strong> Pixel Market is open, but moves here are ranked by score, not by value. The prices in the official demo (for example 0.016 ETH per #PIXEL) were labelled &quot;sample numbers from the demo, not real prices&quot;. Please do not quote them.</li>
          ) : (
            <li><strong>#PIXEL has no market price here yet.</strong> {launchTimePassed(new Date(result.asOf)) ? `@serc1n announced the Pixel Market for ${PIXEL_MARKET_LAUNCH_TEXT}. That time has passed, and this page has not been told it is open: check @normiesART or the official Pixel Market page for whether it is open right now.` : `@serc1n announced the Pixel Market for ${PIXEL_MARKET_LAUNCH_TEXT}. This page has not been told it is open yet.`} The prices in the official Pixel Market demo (for example 0.016 ETH per #PIXEL) are labelled &quot;sample numbers from the demo, not real prices&quot;. Please do not quote them. Moves here are ranked by score, not by value.</li>
          )}
          <li><strong>How a burn works</strong> (official video): 1) Commit: the Normies you chose are burned and gone for good. 2) Wait about a minute while the chain produces the randomness for your roll. 3) Reveal: your pixels arrive. Bigger faces earn more.</li>
          {result.yieldMode === "normal" ? (
            <li><strong>The fixed 4% promo has ended.</strong> The official Normies announcement put the end at 16:00 UTC on Monday, October 5, and the Normies contract itself switched to the normal rates at about 16:23 UTC. A burn is now a roll inside a range set by the Normie&apos;s original pixel count: 0 to 490 px pays 1 to 4%, 491 to 890 px pays 2 to 4%, 891 px and up pays 3 to 4% (@normiesART article, Sep 23). This page shows the middle of the range, marked ~, with the range beside it. Real burns can land anywhere in it (the average over the first 2,718 burns was 2.74%).</li>
          ) : (
            <li><strong>The 4% burn rate is a promo with a short window.</strong> The official Normies announcement says it ends at 16:00 UTC on Monday, October 5, so this page stops showing 4% by itself from then, or as soon as the contract changes. After that, burns go back to the normal 1 to 4% range. Burning itself stays open. Check @normiesART before you act.</li>
          )}
          <li>Burn yield is paid on a Normie&apos;s ORIGINAL pixel count (what the contract pays on), not on its edited art.</li>
          <li><strong>We can be wrong.</strong> This is an independent community tool, not made or endorsed by the Normies team. Their site and @normiesART are the source of truth.</li>
          {result.census.indexOldestIndexedAt && (
            <li>Census and rarity data come from an index last refreshed <time dateTime={result.census.indexOldestIndexedAt}>{utc(result.census.indexOldestIndexedAt)}</time>. Your own Normies are read live.{isStale(result.census.indexOldestIndexedAt, result.asOf) && ` That is more than ${STALE_HOURS} hours ago, so the pool share is approximate until the next refresh.`}</li>
          )}
          {bad.map(([name, s]) => <li key={name} role="alert"><strong>Data source down: {name}.</strong> {s.error}</li>)}
        </ul>
        <p className="burn-cap">For developers and bots: <code className="burn-mono">/api/burn-buy?wallet=…</code></p>
      </details>
    </section>
  )
}

/** Who actually owns what this wallet is only a delegate for, grouped by owner, each with a link that opens the owner's answer. */
function DelegateOwners({ list, goal }: { list: PageModel["delegateOf"]; goal: Goal }) {
  const byOwner = new Map<string, number[]>()
  for (const d of list) byOwner.set(d.owner, [...(byOwner.get(d.owner) ?? []), d.tokenId])
  return (
    <ul className="burn-plain burn-delegates">
      {[...byOwner].map(([owner, tokenIds]) => (
        <li key={owner}>
          {tokenIds.length <= 6 ? tokenIds.map((i) => `#${i}`).join(", ") : `${tokenIds.length} Normies (#${tokenIds.slice(0, 3).join(", #")}…)`} owned by <span className="burn-mono">{short(owner)}</span>.{" "}
          <Link href={`/burn?wallet=${owner}&goal=${goal}`}>Use the owner wallet →</Link>
        </li>
      ))}
    </ul>
  )
}
