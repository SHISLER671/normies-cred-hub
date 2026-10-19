import assert from "node:assert/strict"
import fs from "node:fs"
import { describe, it } from "node:test"

import { PAYMENT_RAIL_LIVE_ALLOWED, resolvePaymentRailStatus } from "../payments/rail-policy"
import { checkRateLimitById, isProductionRuntime, strictFallbackLimit } from "../ratelimit"
import { isAuthorizedCron } from "./cron-auth"
import { assertPublicHttpsUrl, isBlockedIp, safeFetchText, SsrfBlockedError, type LookupFn } from "./ssrf"

describe("canvas-watch cron auth", () => {
  it("accepts only the exact bearer secret", () => {
    assert.equal(isAuthorizedCron("Bearer s3cret", "s3cret"), true)
    assert.equal(isAuthorizedCron("Bearer wrong!", "s3cret"), false)
    assert.equal(isAuthorizedCron("s3cret", "s3cret"), false)
    assert.equal(isAuthorizedCron(null, "s3cret"), false)
  })
  it("no secret configured = nobody is the cron", () => {
    assert.equal(isAuthorizedCron("Bearer ", ""), false)
    assert.equal(isAuthorizedCron("Bearer undefined", undefined), false)
  })
  it("the route no longer trusts x-vercel-cron and only the cron can force", () => {
    const src = fs.readFileSync("app/api/zulo/canvas-watch/route.ts", "utf8")
    assert.doesNotMatch(src, /get\("x-vercel-cron"\)/)
    assert.match(src, /isAuthorizedCron\(req\.headers\.get\("authorization"\), process\.env\.CRON_SECRET\)/)
    assert.match(src, /const force = isCron/)
  })
  it("public callers can't choose which tokens canvas-watch scans", () => {
    const src = fs.readFileSync("app/api/zulo/canvas-watch/route.ts", "utf8")
    assert.match(src, /const rawIds = isCron \? url\.searchParams\.get\("tokens"\) : null/)
    assert.match(src, /MAX_CUSTOM_TOKENS = 25/)
  })
  it("the metrics route only trusts the bearer secret, never x-vercel-cron", () => {
    const src = fs.readFileSync("app/api/zulo/metrics/route.ts", "utf8")
    assert.doesNotMatch(src, /get\("x-vercel-cron"\)/)
    assert.match(src, /isAuthorizedCron\(req\.headers\.get\("authorization"\), process\.env\.CRON_SECRET\)/)
  })
})

describe("SSRF guard", () => {
  it("blocks loopback, RFC1918, CGNAT, link-local / metadata, IPv6 local and mapped forms", () => {
    for (const ip of [
      "127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "100.64.0.1", "169.254.169.254",
      "0.0.0.0", "224.0.0.1", "::1", "::", "fc00::1", "fd00:ec2::254", "fe80::1", "::ffff:127.0.0.1", "::ffff:a9fe:a9fe",
    ]) assert.equal(isBlockedIp(ip), true, ip)
  })
  it("allows public addresses", () => {
    for (const ip of ["1.1.1.1", "8.8.8.8", "172.32.0.1", "2606:4700:4700::1111"]) assert.equal(isBlockedIp(ip), false, ip)
  })
  const resolvesTo = (address: string): LookupFn => async () => [{ address, family: address.includes(":") ? 6 : 4 }]
  it("rejects http, odd ports, credentials, internal names and IP literals", async () => {
    for (const u of [
      "http://example.com/m.json", "https://example.com:8443/m.json", "https://user:pw@example.com/",
      "https://localhost/m.json", "https://metadata.google.internal/", "https://169.254.169.254/latest", "https://[::1]/",
    ]) await assert.rejects(assertPublicHttpsUrl(u, resolvesTo("1.1.1.1")), SsrfBlockedError, u)
  })
  it("rejects a public-looking name that resolves to a private address (checked after DNS)", async () => {
    await assert.rejects(assertPublicHttpsUrl("https://evil.example/m.json", resolvesTo("10.0.0.5")), SsrfBlockedError)
    await assert.rejects(assertPublicHttpsUrl("https://evil.example/m.json", resolvesTo("169.254.169.254")), SsrfBlockedError)
  })
  it("re-checks every redirect hop", async () => {
    const fetchImpl = (async (url: URL) =>
      url.hostname === "good.example"
        ? new Response(null, { status: 302, headers: { location: "https://inner.example/x" } })
        : new Response("{}", { status: 200 })) as unknown as typeof fetch
    const lookup: LookupFn = async (h) => [{ address: h === "inner.example" ? "192.168.0.10" : "1.1.1.1", family: 4 }]
    await assert.rejects(safeFetchText("https://good.example/m.json", { lookup, fetchImpl }), SsrfBlockedError)
  })
  it("caps the body size", async () => {
    const fetchImpl = (async () => new Response("x".repeat(2000), { status: 200 })) as unknown as typeof fetch
    await assert.rejects(
      safeFetchText("https://good.example/m.json", { lookup: resolvesTo("1.1.1.1"), fetchImpl, maxBytes: 1000 }),
      SsrfBlockedError,
    )
  })
  it("the manifest fetch goes through the guard", () => {
    const src = fs.readFileSync("lib/erc8257/manifests.ts", "utf8")
    assert.match(src, /safeFetchText\(metadataURI/)
    assert.doesNotMatch(src, /fetchWithTimeout\(metadataURI/)
  })
})

describe("no crypto as income: payment rail live is hard-blocked", () => {
  it("the code switch is off", () => {
    assert.equal(PAYMENT_RAIL_LIVE_ALLOWED, false)
  })
  it("ZULO_PAYMENT_RAIL_STATUS=live resolves to planned", () => {
    assert.equal(resolvePaymentRailStatus("live"), "planned")
    assert.equal(resolvePaymentRailStatus(" LIVE "), "planned")
    assert.equal(resolvePaymentRailStatus("scaffold"), "scaffold")
    assert.equal(resolvePaymentRailStatus(undefined), "planned")
  })
  it("both rail readers use the policy", () => {
    for (const f of ["lib/payments/verify.ts", "lib/agent-recommendations/verifyPayment.ts"]) {
      const src = fs.readFileSync(f, "utf8")
      assert.match(src, /resolvePaymentRailStatus\(process\.env\.ZULO_PAYMENT_RAIL_STATUS\)/, f)
      assert.doesNotMatch(src, /if \(env === "live"\) return "live"/, f)
    }
  })
})

describe("parked payments are never advertised", () => {
  it("the public manifest drops prices, the payment block and how-to-pay while payments are parked", () => {
    const src = fs.readFileSync("lib/agent-recommendations/manifest.ts", "utf8")
    assert.match(src, /\.\.\.\(offered \? \{ payment:/)
    assert.match(src, /price: servicePrice\(/)
    assert.doesNotMatch(src, /price: \{ amount: ZULO_SERVICE_PRICES/)
  })
  it("the verify endpoint answers 404 unless the rail is live", () => {
    const src = fs.readFileSync("app/api/zulo/payments/verify/route.ts", "utf8")
    assert.match(src, /resolvePaymentRailStatus\(process\.env\.ZULO_PAYMENT_RAIL_STATUS\) !== "live"/)
    assert.match(src, /status: 404/)
  })
  it("no page tells anyone how to pay Zulo", () => {
    for (const f of ["app/page.tsx", "components/home-future-plans.tsx"]) {
      const src = fs.readFileSync(f, "utf8")
      assert.doesNotMatch(src, /how to pay|Transfer AP|txHash|hotWallet/i, f)
    }
  })
})

describe("on-chain stays read-only", () => {
  it("no writeContract / sendTransaction / signTypedData calls anywhere in app code", () => {
    const walk = (d: string, out: string[] = []): string[] => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        if (["node_modules", ".next"].includes(e.name)) continue
        const p = `${d}/${e.name}`
        if (e.isDirectory()) walk(p, out)
        else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\./.test(e.name)) out.push(p)
      }
      return out
    }
    const hits = ["app", "components", "hooks", "lib"].flatMap((d) => walk(d)).filter((f) =>
      /\b(?:useWriteContract|writeContract(?:Async)?\s*\(|useSendTransaction|sendTransaction(?:Async)?\s*\(|signTypedData|useSignTypedData)/.test(
        fs.readFileSync(f, "utf8"),
      ),
    )
    assert.deepEqual(hits, [])
  })
})

describe("rate limiting without Upstash", () => {
  it("production detection prefers VERCEL_ENV", () => {
    assert.equal(isProductionRuntime({ VERCEL_ENV: "production" } as unknown as NodeJS.ProcessEnv), true)
    assert.equal(isProductionRuntime({ VERCEL_ENV: "preview", NODE_ENV: "production" } as unknown as NodeJS.ProcessEnv), false)
    assert.equal(isProductionRuntime({ NODE_ENV: "production" } as unknown as NodeJS.ProcessEnv), true)
    assert.equal(isProductionRuntime({ NODE_ENV: "development" } as unknown as NodeJS.ProcessEnv), false)
  })
  it("strict fallback is a quarter of the limit, at least 1", () => {
    assert.equal(strictFallbackLimit(12), 3)
    assert.equal(strictFallbackLimit(2), 1)
  })
  it("in production with no Upstash the Ask budget is strict", async () => {
    const saved = { ...process.env }
    delete process.env.KV_REST_API_URL
    delete process.env.KV_REST_API_TOKEN
    process.env.VERCEL_ENV = "production"
    try {
      const results: boolean[] = []
      for (let i = 0; i < 5; i++) results.push((await checkRateLimitById("1.2.3.4", "test-ask-ip", 12, 60)).ok)
      assert.deepEqual(results, [true, true, true, false, false])
    } finally {
      process.env = saved
    }
  })
  it("Ask uses the dedicated ask profile", () => {
    assert.match(fs.readFileSync("app/api/zulo/ask/route.ts", "utf8"), /enforceDualRateLimit\(req, "ask"/)
  })
})
