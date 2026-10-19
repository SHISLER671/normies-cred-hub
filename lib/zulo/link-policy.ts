// Which links Zulo may make clickable. Pure, so it is unit-tested (link-policy.test.ts).
// Zulo's answers can quote third-party text (agent taglines and personas set by their owners), so a link in an answer
// is not proof that Zulo vouches for it. A planted "claim here" link to a wallet drainer would look like advice from
// Zulo. Only these hosts (and their subdomains) become clickable; anything else is shown as plain text with its host.

import { DEFAULT_SITE_ORIGIN } from "@/lib/site-origin"

export const TRUSTED_LINK_HOSTS = [
  "normies.art",
  "opensea.io",
  "etherscan.io",
  "x.com",
  "twitter.com",
  "ethos.network",
  "eips.ethereum.org",
  "github.com",
  new URL(DEFAULT_SITE_ORIGIN).host,
] as const

/** An http(s) URL on a trusted host, normalised; otherwise null. */
export function trustedHref(href: string, extraHosts: readonly string[] = []): string | null {
  let u: URL
  try {
    u = new URL(href)
  } catch {
    return null
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null
  if (u.username || u.password) return null
  const host = u.hostname.toLowerCase().replace(/\.$/, "")
  const ok = [...TRUSTED_LINK_HOSTS, ...extraHosts].some((h) => {
    const base = h.toLowerCase().split(":")[0]
    return host === base || host.endsWith(`.${base}`)
  })
  return ok ? u.toString() : null
}

/** The host to show next to an untrusted link, so the real destination is always visible. */
export function linkHost(href: string): string {
  try {
    return new URL(href).hostname
  } catch {
    return href.slice(0, 60)
  }
}
