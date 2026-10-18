// The record card's share image (as a download) and the Post on X text. Pure and client-safe (no server imports).
// The PNG is the same 1200×630 image served for link previews (app/record/[tokenId]/opengraph-image.tsx).
// Only the Normie's token id goes into the path and the filename: never a wallet, an ENS name or anything personal.

/** Same-origin path to the record card's share image, so a plain `<a download>` works (incl. iOS Safari 13+). */
export function recordCardImagePath(tokenId: number): string {
  return `/record/${assertTokenId(tokenId)}/opengraph-image`
}

/** e.g. "normie-7141-record-card.png". */
export function recordCardImageFilename(tokenId: number): string {
  return `normie-${assertTokenId(tokenId)}-record-card.png`
}

/** The pixel squares Ryan uses on X: U+1F532 U+1F533. */
export const PIXEL_EMOJI = "\u{1F532}\u{1F533}"

/**
 * Prefilled "Post on X" text. Same for every Normie; only the name changes (falls back to "Normie #id").
 * Tags the official @normiesART account. The record card URL goes in the intent's separate `url` param.
 */
export function recordShareXText(name: string | null | undefined, tokenId: number): string {
  const who = name?.trim() || `Normie #${assertTokenId(tokenId)}`
  return `${PIXEL_EMOJI} ${who}'s record card on NCH: verified identity and trust gate. A track record, not a tip. @normiesART`
}

function assertTokenId(tokenId: number): number {
  if (!Number.isSafeInteger(tokenId) || tokenId < 0 || tokenId > 9999) {
    throw new RangeError(`Invalid Normie token id: ${tokenId}`)
  }
  return tokenId
}
