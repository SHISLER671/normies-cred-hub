import type { Metadata } from "next"
import { headers } from "next/headers"

import { SiteFooter } from "@/components/site-footer"
import { ZuloChromeHeader } from "@/components/zulo-chrome-header"
import { apiDisagrees, isActiveApproval, openSeaItemUrl, parseTokenInput } from "@/lib/ap-check/core"
import { planForBudget, planForPixels, MAX_BURNS, type BudgetAnswer, type PixelsAnswer } from "@/lib/ap-check/buy-smart"
import { loadBuySmart, type BuySmartInputs } from "@/lib/ap-check/buy-smart-load"
import { checkApprovals, checkListings, checkToken, checkWallet, LISTINGS_CHECKED, LISTINGS_SHOWN, MAX_WALLET_OFFERS, type ApprovalsCheck, type ListingsCheck, type TokenCheck, type WalletCheck } from "@/lib/ap-check/load"
import { keyedTtl } from "@/lib/burn-buy/data"
import { normalizeWalletInput } from "@/lib/burn-buy/wallet-input"
import { checkRateLimitById, clientIdFromHeaders } from "@/lib/ratelimit"

import "../zulo/styles.css"
import "../burn/burn.css"
import "./pixels.css"

export const dynamic = "force-dynamic"
export const maxDuration = 20

const TITLE = "Pixel Check — Normies CredHub"
const DESCRIPTION =
  "Live #PIXEL attached to any Normie (its AP), read from the chain. Or paste your wallet to see which of your item offers sit on Normies whose pixels are gone. Read-only."

export const metadata: Metadata = {
  alternates: { types: { "application/json": "/api/ap-check" } },
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { title: "Pixel Check: does this Normie still have its pixels?", description: DESCRIPTION, url: "/pixels", siteName: "Normies CredHub", type: "website" },
  twitter: { card: "summary", title: "Pixel Check: does this Normie still have its pixels?", description: DESCRIPTION },
}

/** Zulo's Normie: 12 AP, checked on-chain 2026-10-06. Shown until someone types their own. */
const EXAMPLE_TOKEN = 7141
const ADDRESS = /^0x[a-fA-F0-9]{40}$/
const ENS = /^(?=.{3,255}$)(?:[a-z0-9-]+\.)+eth$/i
const PAGE_LIMIT_PER_MIN = 20

/** One shared answer per Normie for 15 s, so the example (not rate limited) and a group chat clicking one link cost one read. */
const tokenCached = keyedTtl(15_000, 500, (key) => checkToken(Number(key)))

type View =
  | { kind: "token"; check: TokenCheck; isExample: boolean }
  | { kind: "wallet"; check: WalletCheck }
  | { kind: "listings"; check: ListingsCheck }
  | { kind: "approvals"; check: ApprovalsCheck }
  | { kind: "calc"; answer: PixelsAnswer | BudgetAnswer; inputs: BuySmartInputs }
  | { kind: "error"; message: string }
  | { kind: "none" }

const utc = (iso: string) => iso.slice(0, 16).replace("T", " ") + " UTC"
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`
const eth = (n: number) => `${n.toFixed(n < 0.1 ? 4 : 3).replace(/0+$/, "").replace(/\.$/, "")} ETH`
const days = (iso: string | null) => {
  if (!iso) return "no end"
  const d = Math.round((Date.parse(iso) - Date.now()) / 86_400_000)
  return d <= 0 ? "today" : d === 1 ? "1 day" : `${d} days`
}

async function limited(): Promise<string | null> {
  const rl = await checkRateLimitById(clientIdFromHeaders(await headers()), "ap-page", PAGE_LIMIT_PER_MIN, 60)
  return rl.ok ? null : `Too many lookups from your network. Try again in ${rl.retryAfter} seconds.`
}

/** "500", "500 pixels", "0.5", "0.5 eth", "1,000" -> a positive number, or null. */
function parseAmount(raw: string | undefined, mode: "pixels" | "eth"): number | null {
  if (!raw) return null
  const s = raw.trim().toLowerCase().replace(/,/g, "").replace(/\s*(pixels?|px|eth|ξ)$/, "")
  if (!/^\d*\.?\d+$/.test(s)) return null
  const n = Number(s)
  if (!(n > 0)) return null
  if (mode === "pixels") return Number.isInteger(n) && n <= 1_000_000 ? n : null
  return n <= 1_000 ? n : null
}

async function answer(token: string | undefined, wallet: string | undefined, listings: boolean, approvals: string | undefined, calc: { mode: "pixels" | "eth"; amount: string | undefined } | undefined, showExample: boolean): Promise<View> {
  try {
    if (calc) {
      const amount = parseAmount(calc.amount, calc.mode)
      if (amount === null) {
        return { kind: "error", message: calc.mode === "pixels" ? "Type how many pixels you want, as a whole number, like 500." : "Type how much ETH you want to spend, like 0.5." }
      }
      const inputs = await loadBuySmart()
      if (!inputs) return { kind: "error", message: "Could not load listings and the Pixel Market just now. Try again in a minute." }
      const depth = inputs.book && !inputs.book.paused ? inputs.book.depth : null
      return { kind: "calc", inputs, answer: calc.mode === "pixels" ? planForPixels(inputs.picks, depth, amount) : planForBudget(inputs.picks, depth, amount) }
    }
    if (approvals) {
      const w = normalizeWalletInput(approvals)
      if (!(ADDRESS.test(w) || ENS.test(w))) return { kind: "error", message: "That is not a wallet. Paste a 0x address (42 characters) or a name ending in .eth." }
      const stop = await limited()
      if (stop) return { kind: "error", message: stop }
      return { kind: "approvals", check: await checkApprovals(w) }
    }
    // Shared and cached for a minute, so it is not rate limited per visitor.
    if (listings) return { kind: "listings", check: await checkListings() }
    if (wallet) {
      const w = normalizeWalletInput(wallet)
      if (!(ADDRESS.test(w) || ENS.test(w))) return { kind: "error", message: "That is not a wallet. Paste a 0x address (42 characters) or a name ending in .eth." }
      const stop = await limited()
      if (stop) return { kind: "error", message: stop }
      return { kind: "wallet", check: await checkWallet(w) }
    }
    if (token) {
      const id = parseTokenInput(token)
      if (id === null) return { kind: "error", message: "That is not a Normie number. Type a number from 0 to 9999, like 7141." }
      const stop = await limited()
      if (stop) return { kind: "error", message: stop }
      return { kind: "token", check: await tokenCached(String(id)), isExample: false }
    }
    if (!showExample) return { kind: "none" }
    return { kind: "token", check: await tokenCached(String(EXAMPLE_TOKEN)), isExample: true }
  } catch (err) {
    console.error("[ap page] unexpected failure", err)
    return { kind: "error", message: "Something went wrong on our side. Try again in a minute." }
  }
}

type Tab = "check" | "buy" | "offers" | "safety"
const TABS: ReadonlyArray<{ id: Tab; label: string; intro: string }> = [
  { id: "check", label: "Check", intro: "Is this Normie what OpenSea says? Live pixels, what a burn pays, and the offers on it." },
  { id: "buy", label: "Buy", intro: "The cheapest way to get pixels: the Pixel Market, or burning floor Normies." },
  { id: "offers", label: "Offers", intro: "Your open offers on Normies whose pixels are gone." },
  { id: "safety", label: "Safety", intro: "Who can spend your pixels? Spot approvals you don't recognize." },
]

/** The tab follows what was asked; a bare ?tab= just opens that tab. */
function pickTab(q: { tab?: string; token?: string; wallet?: string; approvals?: string; calc?: string; listings: boolean }): Tab {
  if (q.approvals) return "safety"
  if (q.wallet) return "offers"
  if (q.calc || q.listings) return "buy"
  if (q.token) return "check"
  return q.tab === "buy" || q.tab === "offers" || q.tab === "safety" ? q.tab : "check"
}

export default async function ApPage({ searchParams }: { searchParams: Promise<{ token?: string | string[]; wallet?: string | string[]; view?: string | string[]; approvals?: string | string[]; calc?: string | string[]; amount?: string | string[]; tab?: string | string[] }> }) {
  const sp = await searchParams
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined
  const token = first(sp.token)
  const wallet = first(sp.wallet)
  const approvals = first(sp.approvals)
  const calcRaw = first(sp.calc)
  const calcMode: "pixels" | "eth" = calcRaw === "eth" ? "eth" : "pixels"
  const amountRaw = first(sp.amount)
  const listings = first(sp.view) === "listings"
  const tab = pickTab({ tab: first(sp.tab), token, wallet, approvals, calc: calcRaw, listings })
  const view = await answer(token, wallet, listings, approvals, calcRaw ? { mode: calcMode, amount: amountRaw } : undefined, tab === "check")
  const intro = TABS.find((t) => t.id === tab)?.intro

  return (
    <div className="zulo-chrome min-h-screen burn-page pixels-page">
      <ZuloChromeHeader active="pixels" />
      <div className="header-spacer" aria-hidden />
      <main className="burn-main" id="main">
        <header className="burn-hero">
          <h1 className="burn-title">Pixel Check</h1>
          <p className="burn-tagline">Check the pixels before you trust the offer.</p>
        </header>

        <nav className="burn-tabs pixels-tabnav" aria-label="Pixel Check tools">
          {TABS.map((t) => (
            <a key={t.id} href={`/pixels?tab=${t.id}`} className={`burn-tab${t.id === tab ? " is-active" : ""}`} aria-current={t.id === tab ? "page" : undefined}>
              <span>{t.label}</span>
            </a>
          ))}
        </nav>
        <p className="burn-hint pixels-intro">{intro}</p>

        {tab === "check" && (
          <>
            <form method="get" action="/pixels#result" className="burn-box burn-form" data-tag="Normie">
              <label htmlFor="token" className="sr-only">Normie number</label>
              <div className="burn-inputrow">
                <input id="token" name="token" type="text" defaultValue={view.kind === "token" && !view.isExample ? String(view.check.tokenId) : ""} placeholder="Normie # (0–9999)" inputMode="numeric" enterKeyHint="go" spellCheck={false} autoComplete="off" className="burn-input" />
                <button type="submit" className="burn-go" aria-label="Check this Normie's pixels"><span>Check</span><span aria-hidden="true">→</span></button>
              </div>
              <p className="burn-safeline">Live from the chain · look-only · no signing</p>
            </form>
          </>
        )}
        {tab === "buy" && (
          <>
            <form method="get" action="/pixels#result" className="burn-box burn-form" data-tag="Market or burn?">
              <fieldset className="burn-tabs pixels-toggle">
                <legend className="sr-only">Compare by</legend>
                <label className="burn-tab"><input type="radio" name="calc" value="pixels" defaultChecked={calcMode === "pixels"} /><span>Pixels I want</span></label>
                <label className="burn-tab"><input type="radio" name="calc" value="eth" defaultChecked={calcMode === "eth"} /><span>ETH to spend</span></label>
              </fieldset>
              <label htmlFor="amount" className="sr-only">Amount</label>
              <div className="burn-inputrow">
                <input id="amount" name="amount" type="text" defaultValue={view.kind === "calc" ? amountRaw ?? "" : ""} placeholder="500 pixels, or 0.5 ETH" inputMode="decimal" enterKeyHint="go" spellCheck={false} autoComplete="off" className="burn-input" />
                <button type="submit" className="burn-go" aria-label="Compare the Pixel Market with burning floor Normies"><span>Compare</span><span aria-hidden="true">→</span></button>
              </div>
              <p className="burn-safeline">Pixel Market vs burning floor Normies · live chain pixels</p>
            </form>
            <form method="get" action="/pixels#result" className="pixels-listings-form">
              <input type="hidden" name="view" value="listings" />
              <div className="pixels-listings-row">
                <p className="burn-small pixels-listings-text">Check the cheapest {LISTINGS_CHECKED} listings for Normies that show more pixels on OpenSea than they really have.</p>
                <button type="submit" className="burn-go" aria-label="Check the cheapest listings"><span>Check</span><span aria-hidden="true">→</span></button>
              </div>
            </form>
          </>
        )}
        {tab === "offers" && (
          <>
            <form method="get" action="/pixels#result" className="burn-box burn-form" data-tag="Offers I made">
              <label htmlFor="wallet" className="sr-only">Wallet address or .eth name</label>
              <div className="burn-inputrow">
                <input id="wallet" name="wallet" type="text" defaultValue={view.kind === "wallet" && view.check.kind === "ok" ? view.check.ens ?? view.check.address : wallet ?? ""} placeholder="0x… or yourname.eth" inputMode="text" enterKeyHint="go" spellCheck={false} autoComplete="off" autoCapitalize="off" className="burn-input" />
                <button type="submit" className="burn-go" aria-label="Check the offers this wallet made"><span>Check</span><span aria-hidden="true">→</span></button>
              </div>
              <p className="burn-safeline">Flags your item offers on Normies whose pixels are gone</p>
            </form>
          </>
        )}
        {tab === "safety" && (
          <>
            <form method="get" action="/pixels#result" className="burn-box burn-form" data-tag="Who can spend my pixels?">
              <label htmlFor="approvals" className="sr-only">Wallet address or .eth name</label>
              <div className="burn-inputrow">
                <input id="approvals" name="approvals" type="text" defaultValue={view.kind === "approvals" && view.check.kind === "ok" ? view.check.ens ?? view.check.address : approvals ?? ""} placeholder="0x… or yourname.eth" inputMode="text" enterKeyHint="go" spellCheck={false} autoComplete="off" autoCapitalize="off" className="burn-input" />
                <button type="submit" className="burn-go" aria-label="Check who this wallet approved to spend its pixels"><span>Check</span><span aria-hidden="true">→</span></button>
              </div>
              <p className="burn-safeline">Shows every address you approved to spend your #PIXEL</p>
            </form>
          </>
        )}

        {/* Every form submits to /pixels#result, so the answer scrolls into view instead of landing below the fold. */}
        <div id="result" className="pixels-result-anchor">
        {view.kind === "error" && (
          <section className="burn-box burn-error" data-tag="Oops" role="alert">
            <p className="burn-headline">We could not answer that.</p>
            <p className="burn-small">{view.message}</p>
          </section>
        )}
        {view.kind === "token" && <TokenResult check={view.check} isExample={view.isExample} />}
        {view.kind === "wallet" && view.check.kind === "error" && (
          <section className="burn-box burn-error" data-tag="Oops" role="alert">
            <p className="burn-headline">We could not answer that.</p>
            <p className="burn-small">{view.check.message}</p>
          </section>
        )}
        {view.kind === "wallet" && view.check.kind === "ok" && <WalletResult check={view.check} />}
        {view.kind === "listings" && view.check.kind === "error" && (
          <section className="burn-box burn-error" data-tag="Oops" role="alert">
            <p className="burn-headline">We could not answer that.</p>
            <p className="burn-small">{view.check.message}</p>
          </section>
        )}
        {view.kind === "listings" && view.check.kind === "ok" && <ListingsResult check={view.check} />}
        {view.kind === "approvals" && view.check.kind === "error" && (
          <section className="burn-box burn-error" data-tag="Oops" role="alert">
            <p className="burn-headline">We could not answer that.</p>
            <p className="burn-small">{view.check.message}</p>
          </section>
        )}
        {view.kind === "approvals" && view.check.kind === "ok" && <ApprovalsResult check={view.check} />}
        {view.kind === "calc" && <CalcResult answer={view.answer} inputs={view.inputs} />}
        </div>

        <FinePrint />
      </main>
      <SiteFooter />
    </div>
  )
}

function TokenResult({ check, isExample }: { check: TokenCheck; isExample: boolean }) {
  const { reading: r, judgement: j } = check
  const census = r.census
  return (
    <section className="burn-box ap-result" data-tag={isExample ? "Example · Zulo's Normie" : `Normie #${check.tokenId}`} data-verdict={j.verdict} aria-labelledby="ap-h">
      {isExample && <p className="burn-example" role="note">Showing <strong>Normie #{EXAMPLE_TOKEN}</strong> as an example. Type any Normie number above.</p>}
      <h2 id="ap-h" className="burn-headline">{j.line}</h2>

      <dl className="burn-stats ap-stats">
        <div><dt>Pixels (AP)</dt><dd>{r.onchain ?? "?"}</dd></div>
        <div><dt>Locked</dt><dd>{r.split ? r.split.locked : "–"}</dd></div>
        <div><dt>Free</dt><dd>{r.split ? r.split.free : "–"}</dd></div>
        <div><dt>Last census</dt><dd>{census?.ap ?? "–"}</dd></div>
      </dl>
      <p className="burn-small">
        Locked pixels back the art on the Normie right now; free pixels can be withdrawn without a reset.
        {census?.at ? ` Census as of ${utc(census.at)}.` : ""}
      </p>
      {check.shown !== null && r.onchain !== null && check.shown !== r.onchain && (
        <p className={check.shown > r.onchain ? "burn-note ap-warn" : "burn-note"} role="note">
          OpenSea shows {check.shown} pixels for this Normie, but it has {r.onchain} right now.
          {check.shown > r.onchain ? " Anyone buying from OpenSea would see the old, higher number." : " OpenSea has not caught up yet."}{" "}
          Use &quot;Refresh metadata&quot; on its OpenSea page to update it.
        </p>
      )}
      <BeforeYouBuy check={check} />
      {apiDisagrees(r) && (
        <p className="burn-note" role="note">The Normies API says {r.split?.attached} attached, the chain says {r.onchain}. The chain is the truth; the API catches up.</p>
      )}

      <section className="ap-offers" aria-labelledby="ap-offers-h">
        <h3 id="ap-offers-h" className="burn-cap">Open item offers on this Normie</h3>
        {check.offers === null ? (
          <p className="burn-small">Could not check OpenSea just now.</p>
        ) : check.offers.length === 0 ? (
          <p className="burn-small">None right now.</p>
        ) : (
          <>
            {j.offerRisk && (
              <p className="burn-note ap-warn" role="note">
                This Normie&apos;s pixels (AP) are gone or lower than before, so these offers may have been placed when it had more. If you made one, check it and cancel it on OpenSea if it no longer makes sense. If you own this Normie, you never have to accept.
              </p>
            )}
            <table className="burn-table">
              <thead><tr><th scope="col">Offer</th><th scope="col">From</th><th scope="col">Ends in</th></tr></thead>
              <tbody>
                {check.offers.slice(0, 20).map((o) => (
                  <tr key={o.orderHash}><th scope="row">{eth(o.price)} <span className="ap-cur">{o.currency}</span></th><td className="burn-mono">{short(o.maker)}</td><td>{days(o.expiresAt)}</td></tr>
                ))}
              </tbody>
            </table>
            {check.offers.length > 20 && <p className="burn-small">Showing the top 20 of {check.offers.length}.</p>}
          </>
        )}
        <p className="burn-small"><a href={openSeaItemUrl(check.tokenId)} target="_blank" rel="noopener noreferrer">See Normie #{check.tokenId} on OpenSea ↗</a></p>
      </section>
      <p className="burn-small ap-stamp">Checked {utc(check.checkedAt)}</p>
    </section>
  )
}

function WalletResult({ check }: { check: Extract<WalletCheck, { kind: "ok" }> }) {
  const who = check.ens ?? short(check.address)
  const n = check.offers.length
  const headline =
    n === 0
      ? `${who} has no open item offers on Normies.`
      : check.atRisk === 0
        ? `All ${n} of ${who}'s item offers sit on Normies that still have their pixels.`
        : `${check.atRisk} of ${n} item ${n === 1 ? "offer sits" : "offers sit"} on Normies whose pixels are gone or lower than before.`
  return (
    <section className="burn-box ap-result" data-tag={`Offers made by ${who}`} data-verdict={check.atRisk > 0 ? "dropped" : "has-ap"} aria-labelledby="ap-w-h">
      <h2 id="ap-w-h" className="burn-headline">{headline}</h2>
      {check.atRisk > 0 && (
        <p className="burn-note ap-warn" role="note">
          Flagged offers can be filled by someone selling you a Normie without the pixels you may have been paying for. If that is not what you want, cancel them on OpenSea. This page cannot cancel anything for you, on purpose.
        </p>
      )}
      {n > 0 && (
        <table className="burn-table ap-table">
          <thead><tr><th scope="col">Normie</th><th scope="col">Pixels now</th><th scope="col">Your offer</th><th scope="col">Ends in</th></tr></thead>
          <tbody>
            {check.offers.map((o) => (
              <tr key={o.orderHash} data-risk={o.judgement.offerRisk}>
                <th scope="row"><a href={`/pixels?token=${o.tokenId}#result`}>#{o.tokenId}</a>{o.judgement.offerRisk && <span className="ap-flag" title={o.judgement.line}> {o.judgement.verdict === "burned" ? "burned" : o.judgement.verdict === "dropped" ? "pixels down" : "no pixels"}</span>}</th>
                <td>{o.onchain ?? "?"}</td>
                <td>{eth(o.price)}</td>
                <td>{days(o.expiresAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {check.criteria > 0 && (
        <p className="burn-small">Plus {check.criteria} collection or trait {check.criteria === 1 ? "offer" : "offers"}. Those are not tied to one Normie, so they cannot be checked against one Normie&apos;s pixels.</p>
      )}
      {!check.complete && <p className="burn-small">This wallet has a lot of offers; the first {MAX_WALLET_OFFERS} were checked.</p>}
      <p className="burn-small ap-stamp">Checked {utc(check.checkedAt)}</p>
    </section>
  )
}

function ListingsResult({ check }: { check: Extract<ListingsCheck, { kind: "ok" }> }) {
  const n = check.flags.length
  const headline =
    n === 0
      ? `All clear: the ${check.checked} cheapest listings have the pixels they show.`
      : `${n} of the ${check.checked} cheapest listings ${n === 1 ? "has" : "have"} fewer pixels than ${n === 1 ? "it shows or had" : "they show or had"}.`
  const noTrait = check.shownChecked && check.shownCount === 0
  return (
    <section className="burn-box ap-result" data-tag="Cheapest listings" data-verdict={n > 0 ? "dropped" : "has-ap"} aria-labelledby="ap-l-h">
      <h2 id="ap-l-h" className="burn-headline">{headline}</h2>

      <dl className="burn-stats pixels-l-stats">
        <div><dt>Listings checked</dt><dd>{check.checked}</dd></div>
        <div><dt>Flagged</dt><dd>{n}</dd></div>
        <div><dt>OpenSea numbers read</dt><dd>{check.shownChecked ? check.shownCount : "–"}</dd></div>
      </dl>

      {n > 0 && (
        <>
          <p className="burn-note ap-warn" role="note">
            Before buying one of these, open it here to see its live pixels. OpenSea may keep showing the old number until someone refreshes its metadata.
          </p>
          <h3 className="burn-cap">Flagged</h3>
          <table className="burn-table ap-table">
            <thead><tr><th scope="col">Normie</th><th scope="col">Price</th><th scope="col">OpenSea shows</th><th scope="col">Pixels now</th></tr></thead>
            <tbody>
              {check.flags.map((f) => (
                <tr key={f.tokenId} data-risk="true">
                  <th scope="row"><a href={`/pixels?token=${f.tokenId}#result`}>#{f.tokenId}</a></th>
                  <td>{eth(f.priceEth)}</td>
                  <td>{f.shown ?? "–"}</td>
                  <td title={f.line}>{f.live}{f.kind !== "stale" && typeof f.census?.ap === "number" ? <span className="ap-cur"> (was {f.census.ap})</span> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <h3 className="burn-cap pixels-l-cap">The {LISTINGS_SHOWN} cheapest, as checked</h3>
      <table className="burn-table ap-table">
        <thead><tr><th scope="col">Normie</th><th scope="col">Price</th><th scope="col">OpenSea shows</th><th scope="col">Pixels now</th></tr></thead>
        <tbody>
          {check.cheapest.map((r) => {
            const off = r.live !== null && r.shown !== null && r.shown > r.live
            return (
              <tr key={r.tokenId} data-risk={off}>
                <th scope="row"><a href={`/pixels?token=${r.tokenId}#result`}>#{r.tokenId}</a></th>
                <td>{eth(r.priceEth)}</td>
                <td>{r.shown ?? "–"}</td>
                <td>{r.live ?? "?"}{r.live !== null && r.shown !== null && !off ? <span className="ap-cur"> ✓</span> : null}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {!check.shownChecked && <p className="burn-small">Could not read what OpenSea shows just now, so only our census comparison ran.</p>}
      {noTrait && <p className="burn-note" role="note">OpenSea did not show a pixel number for any of these listings, so only our census comparison ran.</p>}
      <p className="burn-small">
        &quot;Was&quot; is our census{check.censusAt ? ` from ${utc(check.censusAt)}` : ""}. Only the cheapest {LISTINGS_CHECKED} listings are checked, and the result is shared for a minute.
      </p>
      <p className="burn-small ap-stamp">Checked {utc(check.checkedAt)}</p>
    </section>
  )
}

const ROLL_TEXT = { normal: "a roll of 1-4% of its original pixels (higher tiers for bigger Normies)", promo: "a fixed 4% of its original pixels" } as const

function BeforeYouBuy({ check }: { check: TokenCheck }) {
  const { lens, listingPriceEth: price } = check
  if (!lens && price === null) return null
  const range = lens ? (lens.low === lens.high ? `${lens.mid}` : `${lens.low}–${lens.high} (typically ${lens.mid})`) : null
  return (
    <section className="pixels-lens" aria-labelledby="lens-h">
      <h3 id="lens-h" className="burn-cap">Before you buy</h3>
      <dl className="burn-stats pixels-lens-stats">
        <div><dt>Listed at</dt><dd>{price !== null ? eth(price) : "not listed"}</dd></div>
        <div><dt>Burn pays</dt><dd>{lens ? lens.mid : "?"}</dd></div>
        <div><dt>Those pixels on the market</dt><dd>{lens && typeof lens.marketValueEth === "number" ? eth(lens.marketValueEth) : "–"}</dd></div>
      </dl>
      {lens && (
        <p className="burn-small">
          Burning it would pay {range} pixels: {check.yieldMode ? ROLL_TEXT[check.yieldMode] : "its burn roll"}, plus the {check.reading.onchain} pixels attached to it right now (read from the chain, not OpenSea).
          {price !== null && lens.marketValueEth !== null
            ? price <= lens.marketValueEth
              ? ` At ${eth(price)} you would pay less than those pixels cost on the Pixel Market.`
              : ` The listing costs ${eth(price - lens.marketValueEth)} more than buying the same pixels on the Pixel Market: that part pays for the Normie itself.`
            : ""}
        </p>
      )}
    </section>
  )
}

function CalcResult({ answer: a, inputs }: { answer: PixelsAnswer | BudgetAnswer; inputs: BuySmartInputs }) {
  const burn = a.burn
  const m = a.market
  const rolls = (p: { low: number; mid: number; high: number }) => (p.low === p.high ? `${p.mid}` : `${p.low}–${p.high}`)
  let headline: string
  if (a.mode === "pixels") {
    headline =
      m && m.shortfall > 0 && burn?.reached
        ? `The Pixel Market only has ${m.pixels} pixels listed. Burning gets you to ${a.need}: typically ${eth(burn.costEth)}${a.burnSure?.reached ? `, or ${eth(a.burnSure.costEth)} to be sure even with bad rolls` : ""}.`
      : a.verdict === "burn" && a.burnSure?.reached ? `Burning is cheaper: ${eth(a.burnSure.costEth)} gets you ${a.need}+ pixels even with the worst rolls${burn && burn.costEth < a.burnSure.costEth ? ` (typically ${eth(burn.costEth)})` : ""}.`
      : a.verdict === "burn" && burn ? `Burning is cheaper: typically ${eth(burn.costEth)} for ${a.need} pixels.`
      : a.verdict === "gamble" && burn && m ? `Burning is cheaper with typical rolls (${eth(burn.costEth)} vs ${eth(m.costEth)}), but bad rolls could leave you short.`
      : a.verdict === "market" && m ? `The Pixel Market is cheaper: ${eth(m.costEth)} for ${a.need} pixels.`
      : "Could not price both sides right now."
  } else {
    headline =
      a.verdict === "burn" && burn ? `Burning gets more: ${rolls(burn)} pixels for ${eth(burn.costEth)}, vs ${m?.pixels ?? 0} on the Pixel Market.`
      : a.verdict === "gamble" && burn && m ? `Burning gets more with typical rolls (${burn.mid} vs ${m.pixels} pixels), but bad rolls could give you fewer.`
      : a.verdict === "market" && m ? `The Pixel Market gets more: ${m.pixels} pixels for ${eth(m.costEth)}.`
      : "Could not price both sides right now."
  }
  const verdictTag = a.verdict === "unknown" ? "has-ap" : a.verdict === "market" ? "has-ap" : "dropped"
  return (
    <section className="burn-box ap-result pixels-calc" data-tag={a.mode === "pixels" ? `${a.need} pixels: market or burn?` : `${a.budgetEth} ETH: market or burn?`} data-verdict={verdictTag} aria-labelledby="calc-h">
      <h2 id="calc-h" className="burn-headline">{headline}</h2>

      <div className="pixels-calc-sides">
        <div className="pixels-calc-side">
          <h3 className="burn-cap">Pixel Market</h3>
          {m ? (
            <p className="burn-small">
              {a.mode === "pixels"
                ? m.shortfall > 0 ? `Only ${m.pixels} pixels are listed right now (${eth(m.costEth)}).` : `${a.need} pixels for ${eth(m.costEth)}.`
                : `${m.pixels} pixels for ${eth(m.costEth)}.`}
              {" "}Exact, from the live order book{m.approx ? " (approximate: some listings must be bought whole)" : ""}.
            </p>
          ) : (
            <p className="burn-small">The order book could not be read just now.</p>
          )}
        </div>
        <div className="pixels-calc-side">
          <h3 className="burn-cap">Burn floor Normies</h3>
          {burn && burn.picks.length ? (
            <>
              <p className="burn-small">
                Buy {burn.picks.length} {burn.picks.length === 1 ? "Normie" : "Normies"} for {eth(burn.costEth)} and burn {burn.picks.length === 1 ? "it" : "them"}: {rolls(burn)} pixels, typically {burn.mid}.
                {a.mode === "pixels" && !burn.reached ? ` The cheapest ${MAX_BURNS} burns cannot reach ${a.need}.` : ""}
              </p>
              {a.mode === "pixels" && a.burnSure?.reached && a.burnSure.picks.length !== burn.picks.length && (
                <p className="burn-small">To be sure even with the worst rolls: {a.burnSure.picks.length} Normies for {eth(a.burnSure.costEth)}.</p>
              )}
            </>
          ) : (
            <p className="burn-small">{a.mode === "eth" ? "No listed Normie fits inside that budget." : "No usable listings right now."}</p>
          )}
        </div>
      </div>

      {burn && burn.picks.length > 0 && (
        <table className="burn-table ap-table">
          <thead><tr><th scope="col">Normie</th><th scope="col">Price</th><th scope="col">Burn pays</th><th scope="col">Attached now</th></tr></thead>
          <tbody>
            {burn.picks.map((p) => (
              <tr key={p.tokenId}>
                <th scope="row"><a href={`/pixels?token=${p.tokenId}#result`}>#{p.tokenId}</a>{p.customized ? <span className="ap-flag" title="Burning erases its edited art"> art</span> : null}</th>
                <td>{eth(p.priceEth)}</td>
                <td>{rolls(p)}</td>
                <td>{p.livePixels}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <ul className="burn-small pixels-calc-notes">
        <li>The roll is the gamble: {ROLL_TEXT[inputs.yieldMode]}, plus every pixel attached to the burned Normie. {inputs.modeSource === "contract" ? "The burn mode was read from the Normies contract." : "The burn mode could not be read from the contract; this follows the announced schedule."}</li>
        <li><strong>Reveal within about 50 minutes.</strong> A burn is two steps on the Canvas: commit, then reveal about a minute later. Miss the reveal window and every burned Normie pays only its minimum roll, so the gamble always lands on the worst case.</li>
        <li>Burned pixels can land in your wallet or on a Normie you own. Each burn costs gas, which is not included here.</li>
        <li>{inputs.liveConfirmed >= inputs.listingsChecked ? `Every listing's attached pixels were read from the chain, so a stripped Normie is priced as stripped.` : `${inputs.liveConfirmed} of ${inputs.listingsChecked} listings had their pixels confirmed on the chain; the rest use the listing data, which can lag.`} Open any Normie above to check it before you buy.</li>
        <li>Listings and prices move fast. This is a comparison of two costs, not advice. Shared and refreshed every minute.</li>
      </ul>
    </section>
  )
}

const STORAGE_WRITE_URL = "https://etherscan.io/address/0x96F2DA32Bb9D429d59ac13dB469f4950cBe02084#writeContract"

function ApprovalsResult({ check }: { check: Extract<ApprovalsCheck, { kind: "ok" }> }) {
  const who = check.ens ?? short(check.address)
  const active = check.rows.filter(isActiveApproval)
  const headline =
    check.active === 0
      ? `${who} has not approved anyone to spend its pixels.`
      : check.activeUnofficial === 0
        ? `${who} has approved only official Normies contracts.`
        : `${who} has approved ${check.activeUnofficial} ${check.activeUnofficial === 1 ? "address" : "addresses"} that ${check.activeUnofficial === 1 ? "is not" : "are not"} an official Normies contract.`
  return (
    <section className="burn-box ap-result" data-tag={`Pixel approvals · ${who}`} data-verdict={check.activeUnofficial > 0 ? "dropped" : "has-ap"} aria-labelledby="ap-a-h">
      <h2 id="ap-a-h" className="burn-headline">{headline}</h2>
      <p className="burn-small">
        An approval lets that address spend up to the approved amount of your pixels, from your wallet <strong>or from any Normie you own</strong>, without asking you again. Only approve what you mean to spend, and only on sites you trust.
      </p>
      {check.walletPixels !== null && <p className="burn-small">Pixels in this wallet right now: {check.walletPixels} (pixels attached to Normies are not counted here).</p>}

      {active.length > 0 && (
        <table className="burn-table ap-table">
          <thead><tr><th scope="col">Approved address</th><th scope="col">Can spend</th><th scope="col">Who</th></tr></thead>
          <tbody>
            {active.map((r) => (
              <tr key={r.spender} data-risk={!r.official}>
                <th scope="row" className="burn-mono"><a href={`https://etherscan.io/address/${r.spender}`} target="_blank" rel="noopener noreferrer">{short(r.spender)}</a></th>
                <td>{r.unlimited ? "unlimited" : r.live ?? `${r.indexed}?`}</td>
                <td>{r.label ?? <span className="ap-flag">not official</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {check.activeUnofficial > 0 && (
        <div className="burn-note ap-warn" role="note">
          <p className="burn-small" style={{ marginTop: 0 }}><strong>Don&apos;t recognize one?</strong> Revoke it yourself. This page will never ask you to sign anything.</p>
          <ol className="burn-small">
            <li>Open the <a href={STORAGE_WRITE_URL} target="_blank" rel="noopener noreferrer">official pixel contract on Etherscan ↗</a> and choose <em>Connect to Web3</em> with this wallet.</li>
            <li>Find <strong>approve</strong>. Put the approved address in <em>spender</em> and <strong>0</strong> in <em>amount</em>, then write.</li>
            <li>Check the address bar says etherscan.io and the contract is 0x96F2…2084 before you sign.</li>
          </ol>
        </div>
      )}

      {check.rows.length > active.length && (
        <p className="burn-small">{check.rows.length - active.length} earlier {check.rows.length - active.length === 1 ? "approval has" : "approvals have"} already been used up or revoked.</p>
      )}
      <p className="burn-small">
        Every approval since the pixel contract went live (2026-10-04) is tracked, and each amount is re-read live from the chain for this page.
        {check.indexedAt ? ` Index last caught up ${utc(check.indexedAt)}.` : ""}
      </p>
      <p className="burn-small ap-stamp">Checked {utc(check.checkedAt)}</p>
    </section>
  )
}

function FinePrint() {
  return (
    <details className="burn-box burn-fold" data-tag="How this works">
      <summary><span>Where the numbers come from</span></summary>
      <ul className="burn-small">
        <li>Pixels (AP, the #PIXEL attached to a Normie) are read live from the Normies storage contract (attachedOf). That is the real number.</li>
        <li>Locked and free come from the Normies API, which can lag the chain by a little.</li>
        <li>Last census is our own snapshot, refreshed every 6 hours. If the live number is lower, pixels were removed since then.</li>
        <li>&quot;OpenSea shows&quot; is OpenSea&apos;s own cached copy of the Normie&apos;s traits. It can lag behind the chain until someone refreshes it.</li>
        <li>Pixel approvals come from the pixel contract&apos;s own Approval events, indexed hourly, and every amount shown is re-read live from the chain.</li>
        <li>Offers come from OpenSea. Only item offers (one specific Normie) are checked; collection and trait offers are not tied to one Normie.</li>
        <li>Read-only. Nothing here connects a wallet, asks for a signature, or can move anything. Independent community tool, not affiliated with the Normies team.</li>
      </ul>
    </details>
  )
}
