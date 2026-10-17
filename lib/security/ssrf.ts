// SSRF guard for fetching URLs that come from untrusted sources (ERC-8257 manifest URIs are set by whoever registered the tool).
// Blocks localhost, RFC1918, CGNAT, link-local (incl. cloud metadata 169.254.169.254), loopback, multicast, reserved, IPv6
// ULA/link-local and IPv4-mapped forms, checked AFTER DNS resolution, and re-checked on every redirect hop.
// Residual risk: DNS rebinding between our lookup and fetch's own lookup. Closing that fully needs a pinned-IP dispatcher.
//
// No static node: imports on purpose: lib/erc8257 is (wrongly) reachable from client bundles through lib/signals.ts and the
// path-ranker barrel, and Turbopack refuses node: built-ins there. DNS is loaded at call time on the server; if it is not
// available the guard fails closed.

export type LookupFn = (host: string) => Promise<Array<{ address: string; family: number }>>

type DnsPromises = { lookup: (host: string, opts: { all: true; verbatim: boolean }) => Promise<Array<{ address: string; family: number }>> }

const defaultLookup: LookupFn = async (host) => {
  const getBuiltin = (globalThis as { process?: { getBuiltinModule?: (id: string) => unknown } }).process?.getBuiltinModule
  const dns = getBuiltin?.("node:dns/promises") as DnsPromises | undefined
  if (!dns) throw new Error("DNS resolver unavailable")
  return dns.lookup(host, { all: true, verbatim: true })
}

const V4_RE = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/

/** 4, 6 or 0, like node:net isIP (IPv6 check is structural; the URL parser has already normalized hostnames). */
function isIP(raw: string): 0 | 4 | 6 {
  if (V4_RE.test(raw)) return 4
  if (raw.includes(":") && /^[0-9a-f:.]+(%[\w.-]+)?$/i.test(raw)) {
    try {
      new URL(`https://[${raw.split("%")[0]}]/`)
      return 6
    } catch {
      return 0
    }
  }
  return 0
}

const BLOCKED_HOSTNAMES = [/^localhost$/i, /\.localhost$/i, /\.local$/i, /\.internal$/i, /^metadata(\.|$)/i]

function v4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, o) => (acc << 8) + Number(o), 0) >>> 0
}

const V4_BLOCKS: Array<[string, number]> = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
]

function isBlockedV4(ip: string): boolean {
  const n = v4ToInt(ip)
  return V4_BLOCKS.some(([base, bits]) => {
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0
    return (n & mask) === (v4ToInt(base) & mask)
  })
}

function isBlockedV6(raw: string): boolean {
  const ip = raw.toLowerCase().replace(/^\[|\]$/g, "").split("%")[0]!
  if (ip === "::" || ip === "::1") return true
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/) ?? ip.match(/^64:ff9b::(\d+\.\d+\.\d+\.\d+)$/)
  if (mapped) return isBlockedV4(mapped[1]!)
  if (/^::ffff:[0-9a-f]{1,4}:[0-9a-f]{1,4}$/.test(ip)) {
    const [hi, lo] = ip.replace("::ffff:", "").split(":").map((h) => parseInt(h, 16))
    return isBlockedV4(`${hi! >> 8}.${hi! & 255}.${lo! >> 8}.${lo! & 255}`)
  }
  const first = parseInt(ip.split(":")[0] || "0", 16)
  if ((first & 0xfe00) === 0xfc00) return true // fc00::/7 ULA (incl. fd00:ec2::254 metadata)
  if ((first & 0xffc0) === 0xfe80) return true // fe80::/10 link-local
  if ((first & 0xff00) === 0xff00) return true // ff00::/8 multicast
  if (first === 0x2001 && parseInt(ip.split(":")[1] || "0", 16) === 0x0db8) return true // documentation
  return false
}

export function isBlockedIp(ip: string): boolean {
  const kind = isIP(ip.replace(/^\[|\]$/g, ""))
  if (kind === 4) return isBlockedV4(ip)
  if (kind === 6) return isBlockedV6(ip)
  return true // not an IP at all: refuse
}

export class SsrfBlockedError extends Error {
  constructor(reason: string) {
    super(`Blocked URL: ${reason}`)
    this.name = "SsrfBlockedError"
  }
}

/** Throws SsrfBlockedError unless the URL is https on port 443 and every resolved address is public. */
export async function assertPublicHttpsUrl(raw: string, lookup: LookupFn = defaultLookup): Promise<URL> {
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    throw new SsrfBlockedError("not a URL")
  }
  if (u.protocol !== "https:") throw new SsrfBlockedError("only https is allowed")
  if (u.username || u.password) throw new SsrfBlockedError("credentials in URL")
  if (u.port && u.port !== "443") throw new SsrfBlockedError("non-standard port")
  const host = u.hostname.replace(/^\[|\]$/g, "")
  if (BLOCKED_HOSTNAMES.some((re) => re.test(host))) throw new SsrfBlockedError("internal hostname")
  if (isIP(host)) {
    if (isBlockedIp(host)) throw new SsrfBlockedError("private or reserved address")
    return u
  }
  let addrs: Array<{ address: string }>
  try {
    addrs = await lookup(host)
  } catch {
    throw new SsrfBlockedError("DNS lookup failed")
  }
  if (addrs.length === 0) throw new SsrfBlockedError("no DNS answer")
  for (const a of addrs) if (isBlockedIp(a.address)) throw new SsrfBlockedError("resolves to a private or reserved address")
  return u
}

/**
 * fetch() for untrusted URLs: validates the URL, follows at most `maxRedirects` redirects manually (re-validating each hop),
 * aborts after `timeoutMs`, and refuses bodies larger than `maxBytes`. Returns the body text.
 */
export async function safeFetchText(
  raw: string,
  opts: { timeoutMs?: number; maxRedirects?: number; maxBytes?: number; lookup?: LookupFn; fetchImpl?: typeof fetch } = {},
): Promise<{ ok: boolean; status: number; text: string }> {
  const { timeoutMs = 5_000, maxRedirects = 3, maxBytes = 256 * 1024, lookup = defaultLookup, fetchImpl = fetch } = opts
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    let current = raw
    for (let hop = 0; hop <= maxRedirects; hop++) {
      const url = await assertPublicHttpsUrl(current, lookup)
      const res = await fetchImpl(url, { redirect: "manual", signal: controller.signal, headers: { accept: "application/json" } })
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location")
        if (!loc) return { ok: false, status: res.status, text: "" }
        current = new URL(loc, url).toString()
        continue
      }
      const len = Number(res.headers.get("content-length") || 0)
      if (len > maxBytes) throw new SsrfBlockedError("response too large")
      const text = await res.text()
      if (text.length > maxBytes) throw new SsrfBlockedError("response too large")
      return { ok: res.ok, status: res.status, text }
    }
    throw new SsrfBlockedError("too many redirects")
  } finally {
    clearTimeout(timer)
  }
}
