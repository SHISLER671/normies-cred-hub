import { MAX_BURNS, type BudgetAnswer, type PixelsAnswer } from "@/lib/ap-check/buy-smart"
import type { BuySmartInputs } from "@/lib/ap-check/buy-smart-load"
import { COMPARE_FINE_PRINT, COMPARE_SOURCES, compareLines, ethText } from "@/lib/ap-check/compare-text"

const ROLL_TEXT = { normal: "a roll of 1-4% of its original pixels (higher tiers for bigger Normies)", promo: "a fixed 4% of its original pixels" } as const

/**
 * Market or burn? Two routes to the same pixels, priced side by side. Moved here from /pixels (Ryan, 2026-11-10):
 * buy-vs-burn views live only on /burn, under its "Not financial advice" label. Facts only: no route is called better.
 * Its own GET form, outside the wallet form (no nested forms); the wallet and goal ride along so the main answer stays.
 */
export function PixelCompare({
  wallet,
  goal,
  mode,
  amountRaw,
  view,
}: {
  wallet: string | undefined
  goal: string
  mode: "pixels" | "eth"
  amountRaw: string | undefined
  view: { kind: "answer"; answer: PixelsAnswer | BudgetAnswer; inputs: BuySmartInputs } | { kind: "error"; message: string } | null
}) {
  return (
    <section id="compare" className="burn-box burn-compare" data-tag="Market or burn? · two costs" aria-labelledby="compare-h">
      <h2 id="compare-h" className="burn-cap">Pixels: the Pixel Market route and the burning route</h2>
      <form method="get" action="/burn#compare" className="burn-compare-form">
        {wallet ? <input type="hidden" name="wallet" value={wallet} /> : null}
        <input type="hidden" name="goal" value={goal} />
        <fieldset className="burn-tabs burn-compare-toggle">
          <legend className="sr-only">Compare by</legend>
          <label className="burn-tab"><input type="radio" name="calc" value="pixels" defaultChecked={mode === "pixels"} /><span>Pixels I want</span></label>
          <label className="burn-tab"><input type="radio" name="calc" value="eth" defaultChecked={mode === "eth"} /><span>ETH to spend</span></label>
        </fieldset>
        <label htmlFor="amount" className="sr-only">Amount</label>
        <div className="burn-inputrow">
          <input id="amount" name="amount" type="text" defaultValue={amountRaw ?? ""} placeholder="500 pixels, or 0.5 ETH" inputMode="decimal" enterKeyHint="go" spellCheck={false} autoComplete="off" className="burn-input" />
          <button type="submit" className="burn-go" aria-label="Show both routes"><span>Show both</span><span aria-hidden="true">→</span></button>
        </div>
        <p className="burn-safeline">Two costs side by side · live order book and listings · look-only</p>
      </form>

      {view?.kind === "error" && <p className="burn-small" role="alert">{view.message}</p>}
      {view?.kind === "answer" && <CompareAnswer answer={view.answer} inputs={view.inputs} />}

      <ul className="burn-small burn-compare-fine">
        {COMPARE_FINE_PRINT.map((l) => (
          <li key={l}><strong>{l}</strong></li>
        ))}
        <li>{COMPARE_SOURCES}</li>
      </ul>
    </section>
  )
}

function CompareAnswer({ answer: a, inputs }: { answer: PixelsAnswer | BudgetAnswer; inputs: BuySmartInputs }) {
  const lines = compareLines(a, inputs.asOf)
  const burn = a.burn
  const rolls = (p: { low: number; mid: number; high: number }) => (p.low === p.high ? `${p.mid}` : `${p.low}–${p.high}`)
  return (
    <div className="burn-compare-answer">
      <div className="burn-compare-sides">
        <div className="burn-compare-side">
          <h3 className="burn-cap">Pixel Market</h3>
          <p className="burn-small">{lines.market}</p>
        </div>
        <div className="burn-compare-side">
          <h3 className="burn-cap">Burn floor Normies</h3>
          <p className="burn-small">{lines.burning}</p>
          {a.mode === "pixels" && burn && !burn.reached ? <p className="burn-small">Looked at up to {MAX_BURNS} burns.</p> : null}
        </div>
      </div>
      <p className="burn-small">{lines.asOf}</p>
      {burn && burn.picks.length > 0 && (
        <table className="burn-table burn-compare-table">
          <caption className="sr-only">Floor Normies priced as burns, cheapest per pixel first</caption>
          <thead><tr><th scope="col">Normie</th><th scope="col">Price</th><th scope="col">Burn pays</th><th scope="col">Attached now</th></tr></thead>
          <tbody>
            {burn.picks.map((p) => (
              <tr key={p.tokenId}>
                <th scope="row"><a href={`/pixels?token=${p.tokenId}#result`}>#{p.tokenId}</a>{p.customized ? <span className="burn-compare-flag" title="Burning erases its edited art"> art</span> : null}</th>
                <td>{ethText(p.priceEth)}</td>
                <td>{rolls(p)}</td>
                <td>{p.livePixels}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <ul className="burn-small burn-compare-notes">
        <li>The roll: {ROLL_TEXT[inputs.yieldMode]}, plus every pixel attached to the burned Normie. {inputs.modeSource === "contract" ? "The burn mode was read from the Normies contract." : "The burn mode could not be read from the contract; this follows the announced schedule."}</li>
        <li><strong>Reveal within about 50 minutes.</strong> A burn is commit, then reveal about a minute later. Miss the reveal window and every burned Normie pays only its minimum roll. A burn is permanent.</li>
        <li>{inputs.liveConfirmed >= inputs.listingsChecked ? "Every listing's attached pixels were read from the chain." : `${inputs.liveConfirmed} of ${inputs.listingsChecked} listings had their pixels confirmed on the chain; the rest use the listing data, which can lag.`} Open any Normie above to check it.</li>
      </ul>
    </div>
  )
}
