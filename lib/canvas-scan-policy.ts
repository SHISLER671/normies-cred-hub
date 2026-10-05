// When must the connected-wallet flow do the live Canvas scan (about 20 pages, up to 25 lookups each, all from one shared server address)?
// Only when the cheap sources found nothing to show. The Canvas delegate index is refreshed hourly by a scheduled job, so it answers almost
// every wallet instantly; the live scan is kept for the one case the index cannot cover: a delegate set in the last day by a wallet that
// otherwise controls nothing. Without this rule every connecting user spent about a third of the Normies API's per-address quota
// (60 requests a minute) and 429s starved everyone else, /burn lookups included (seen in production logs 2026-10-05).

export interface CanvasIndexAnswer {
  tokenIds: number[]
  /** false = the index could not be read, so "no Canvas delegations" is unknown, not a fact. */
  checked: boolean
}

export function shouldLiveScan(found: { direct: readonly number[]; delegateXyz: readonly number[]; canvasIndex: CanvasIndexAnswer }): boolean {
  if (!found.canvasIndex.checked) return true
  return found.direct.length + found.delegateXyz.length + found.canvasIndex.tokenIds.length === 0
}
