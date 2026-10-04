/**
 * Forgiving wallet input for /burn: clean up what people paste, never guess.
 *
 * Accepted and cleaned: stray spaces, quotes or brackets, a trailing full stop or comma, "0X", a missing "0x",
 * an upper-case .ETH name, and an explorer or app link that contains one address. Anything else is returned
 * unchanged so the caller's strict check still rejects it. A 64-character transaction hash is never cut down to an
 * address, and a link with two different addresses is left alone because we cannot know which one was meant.
 */
const ADDRESS_IN_TEXT = /(?<![a-f0-9])0x[a-f0-9]{40}(?![a-f0-9])/gi
const ENS_NAME = /^(?=.{3,255}$)(?:[a-z0-9-]+\.)+eth$/i

export function normalizeWalletInput(input: string): string {
  let s = input.normalize("NFKC").trim()
  s = s.replace(/^[\s"'`“”‘’<([{]+/, "").replace(/[\s"'`“”‘’>)\]}.,;:!?]+$/, "")

  if (/[/?#]/.test(s)) {
    const found = new Set((s.match(ADDRESS_IN_TEXT) ?? []).map((a) => a.toLowerCase()))
    if (found.size === 1) return fixPrefix([...found][0])
    return input.trim()
  }

  const squeezed = s.replace(/\s+/g, "")
  if (/^(0x)?[a-f0-9]{40}$/i.test(squeezed)) return fixPrefix(squeezed)
  if (ENS_NAME.test(squeezed)) return squeezed.toLowerCase()
  return input.trim()
}

function fixPrefix(hex: string): string {
  return "0x" + hex.replace(/^0x/i, "")
}
