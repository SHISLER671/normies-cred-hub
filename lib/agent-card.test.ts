// Pulse check 2, "Has active agent card": the card is actually read (docs/zulo/pulse-trust-fixes-spec.md, PR-3).
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { beforeEach, describe, it } from "node:test"

import { AGENT_CARD_HOST_ALLOWLIST, assertAllowlistedHttpsUrl, SsrfBlockedError } from "@/lib/security/ssrf"

import {
  AGENT_CARD_PASS_TEXT,
  AGENT_CARD_REASONS,
  __resetAgentCardCacheForTests,
  a2aEndpoint,
  agentCardUnreadable,
  checkAgentCard,
  checkAgentCardCached,
  sha256Hex,
  type AgentCardDeps,
} from "./agent-card"

const NOW = new Date("2026-11-14T00:00:00.000Z")
const REG_URL = "https://api.normies.art/agents/metadata/7141"
const CARD_URL = "https://api.normies.art/agents/agent-card/7141"

// Real shapes, read from api.normies.art on 2026-11-14 (trimmed to the fields that matter).
const REGISTRATION = {
  type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
  name: "Normie #7141 - Zulo",
  active: true,
  services: [
    { name: "web", version: "1", endpoint: "https://api.normies.art/agents/info/7141" },
    { name: "A2A", version: "0.3.0", endpoint: CARD_URL },
  ],
}
const CARD = {
  name: "Zulo",
  version: "1.0",
  supportedInterfaces: [{ url: "https://api.normies.art/agents/a2a/7141", protocolBinding: "HTTP+JSON", protocolVersion: "1.0" }],
}
const CARD_TEXT = JSON.stringify(CARD)

type Reply = { status?: number; text?: string } | "throws"

/** Stubbed network: answers per URL, a public DNS answer for everything, and a log of what was requested. */
function fake(replies: Record<string, Reply> = {}, over: Partial<AgentCardDeps> = {}) {
  const requested: string[] = []
  const looked: string[] = []
  const all: Record<string, Reply> = { [REG_URL]: { text: JSON.stringify(REGISTRATION) }, [CARD_URL]: { text: CARD_TEXT }, ...replies }
  const deps: AgentCardDeps = {
    fetchText: async (url) => {
      requested.push(url.toString())
      const r = all[url.toString()]
      if (!r || r === "throws") throw new Error("connection refused")
      return { status: r.status ?? 200, text: r.text ?? "" }
    },
    lookup: async (host) => { looked.push(host); return [{ address: "93.184.216.34", family: 4 }] },
    allowedHosts: AGENT_CARD_HOST_ALLOWLIST,
    now: () => NOW,
    ...over,
  }
  return { deps, requested, looked }
}
const input = (over: Partial<Parameters<typeof checkAgentCard>[0]> = {}) => ({ agentURI: REG_URL, uriReadable: true, agentName: "Zulo", ...over })
const failed = (reason: string) => ({ checked: false, passed: false, card_hash: null, reason, as_of: NOW.toISOString() })

beforeEach(() => __resetAgentCardCacheForTests())

describe("checkAgentCard: pass", () => {
  it("registration file → A2A service → card answers 200 with this agent's name", async () => {
    const f = fake()
    const c = await checkAgentCard(input(), f.deps)
    assert.deepEqual(c, { checked: true, passed: true, card_hash: createHash("sha256").update(CARD_TEXT).digest("hex"), as_of: NOW.toISOString() })
    assert.deepEqual(f.requested, [REG_URL, CARD_URL])
  })
  it("card_hash is the sha256 of the card body exactly as served", async () => {
    const pretty = JSON.stringify(CARD, null, 2) + "\n"
    const c = await checkAgentCard(input(), fake({ [CARD_URL]: { text: pretty } }).deps)
    assert.equal(c.passed, true)
    assert.equal(c.card_hash, createHash("sha256").update(pretty).digest("hex"))
    assert.notEqual(c.card_hash, await sha256Hex(CARD_TEXT))
    assert.equal(await sha256Hex(""), "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
  })
  it("the name is compared ignoring letter case and outer spaces, nothing looser", async () => {
    for (const name of ["zulo", " Zulo ", "ZULO"]) {
      assert.equal((await checkAgentCard(input({ agentName: name }), fake().deps)).passed, true, name)
    }
    for (const name of ["Zulo2", "Zul", "Normie #7141 - Zulo"]) {
      assert.equal((await checkAgentCard(input({ agentName: name }), fake().deps)).passed, false, name)
    }
  })
  it("the registration file's own name is not what's compared: the card's is", async () => {
    // The real registration file is named "Normie #7141 - Zulo" while the card and the agent are "Zulo".
    assert.equal(REGISTRATION.name, "Normie #7141 - Zulo")
    assert.equal((await checkAgentCard(input(), fake().deps)).passed, true)
  })
})

describe("checkAgentCard: name mismatch", () => {
  it("the card was read but names someone else: not granted, with the hash of what was read", async () => {
    const text = JSON.stringify({ ...CARD, name: "Somebody Else" })
    const c = await checkAgentCard(input(), fake({ [CARD_URL]: { text } }).deps)
    assert.deepEqual(c, { checked: true, passed: false, card_hash: await sha256Hex(text), reason: "card_name_mismatch", as_of: NOW.toISOString() })
    assert.equal(agentCardUnreadable(c), false)
  })
  it("a card with no name, or an agent with no name, never matches", async () => {
    for (const body of [{}, { name: "" }, { name: 7141 }, { name: null }]) {
      const c = await checkAgentCard(input(), fake({ [CARD_URL]: { text: JSON.stringify(body) } }).deps)
      assert.equal(c.reason, "card_name_mismatch")
    }
    for (const agentName of [null, undefined, "", "  "]) {
      assert.equal((await checkAgentCard(input({ agentName }), fake().deps)).reason, "card_name_mismatch")
    }
  })
})

describe("checkAgentCard: non-allowlisted host", () => {
  it("a registration file on another host is never requested, or even looked up", async () => {
    for (const agentURI of ["https://evil.example/reg.json", "https://api.normies.art.evil.example/x", "https://sub.api.normies.art/x", "ipfs://bafy/reg.json", "data:application/json;base64,e30="]) {
      const f = fake()
      assert.deepEqual(await checkAgentCard(input({ agentURI }), f.deps), failed("card_host_not_allowed"), agentURI)
      assert.deepEqual(f.requested, [])
      assert.deepEqual(f.looked, [])
    }
  })
  it("an allowlisted registration file pointing at a card on another host: the card is never requested", async () => {
    const reg = JSON.stringify({ services: [{ name: "A2A", endpoint: "https://evil.example/agent-card.json" }] })
    const f = fake({ [REG_URL]: { text: reg } })
    assert.deepEqual(await checkAgentCard(input(), f.deps), failed("card_host_not_allowed"))
    assert.deepEqual(f.requested, [REG_URL])
  })
  it("the allowlist starts with api.normies.art only", () => {
    assert.deepEqual([...AGENT_CARD_HOST_ALLOWLIST], ["api.normies.art"])
  })
  it("an allowlisted host still has to pass the SSRF guard (https, port 443, a public address)", async () => {
    const privateDns = async () => [{ address: "10.0.0.5", family: 4 }]
    for (const [agentURI, lookup] of [
      ["http://api.normies.art/agents/metadata/7141", undefined],
      ["https://api.normies.art:8443/agents/metadata/7141", undefined],
      ["https://user:pw@api.normies.art/agents/metadata/7141", undefined],
      [REG_URL, privateDns],
    ] as const) {
      const f = fake({}, lookup ? { lookup } : {})
      const c = await checkAgentCard(input({ agentURI }), f.deps)
      assert.equal(c.passed, false, agentURI)
      assert.equal(c.reason, "card_unreadable", agentURI)
      assert.deepEqual(f.requested, [], agentURI)
    }
  })
})

describe("assertAllowlistedHttpsUrl", () => {
  const publicDns = async () => [{ address: "93.184.216.34", family: 4 }]
  it("accepts an exact allowlisted host, in any letter case", async () => {
    assert.equal((await assertAllowlistedHttpsUrl(CARD_URL, ["api.normies.art"], publicDns)).hostname, "api.normies.art")
    assert.equal((await assertAllowlistedHttpsUrl("https://API.NORMIES.ART/x", ["api.normies.art"], publicDns)).hostname, "api.normies.art")
  })
  it("refuses anything else before any DNS lookup: other hosts, look-alikes, subdomains, an empty list", async () => {
    let looked = 0
    const lookup = async () => { looked++; return [{ address: "93.184.216.34", family: 4 }] }
    for (const url of ["https://evil.example/x", "https://api.normies.art.evil.example/x", "https://xapi.normies.art/x", "https://normies.art/x", "not a url"]) {
      await assert.rejects(assertAllowlistedHttpsUrl(url, ["api.normies.art"], lookup), SsrfBlockedError, url)
    }
    await assert.rejects(assertAllowlistedHttpsUrl(CARD_URL, [], lookup), SsrfBlockedError)
    assert.equal(looked, 0)
  })
  it("an allowlisted host that resolves to a private address is still refused", async () => {
    await assert.rejects(assertAllowlistedHttpsUrl(CARD_URL, ["api.normies.art"], async () => [{ address: "169.254.169.254", family: 4 }]), SsrfBlockedError)
  })
})

describe("checkAgentCard: fetch failure is card_unreadable, never a pass", () => {
  const cases: Array<[string, Record<string, Reply>]> = [
    ["the card request throws (timeout, connection refused, a redirect)", { [CARD_URL]: "throws" }],
    ["the card answers 404", { [CARD_URL]: { status: 404, text: "{}" } }],
    ["the card answers 500", { [CARD_URL]: { status: 500, text: CARD_TEXT } }],
    ["the card answers 200 but isn't JSON", { [CARD_URL]: { text: "<html>hello</html>" } }],
    ["the card answers 200 with a JSON array", { [CARD_URL]: { text: "[]" } }],
    ["the registration file request throws", { [REG_URL]: "throws" }],
    ["the registration file answers 503", { [REG_URL]: { status: 503, text: "" } }],
    ["the registration file isn't JSON", { [REG_URL]: { text: "nope" } }],
  ]
  for (const [what, replies] of cases) {
    it(what, async () => {
      const c = await checkAgentCard(input(), fake(replies).deps)
      assert.deepEqual(c, failed("card_unreadable"))
      assert.equal(agentCardUnreadable(c), true)
    })
  }
  it("the registry's agentURI read failed: unreadable, and nothing is requested", async () => {
    const f = fake()
    assert.deepEqual(await checkAgentCard(input({ agentURI: null, uriReadable: false }), f.deps), failed("card_unreadable"))
    assert.deepEqual(f.requested, [])
  })
})

describe("checkAgentCard: other findings", () => {
  it("no registration on-chain: not_registered", async () => {
    for (const agentURI of [null, "", "   "]) {
      assert.deepEqual(await checkAgentCard(input({ agentURI }), fake().deps), failed("not_registered"))
    }
  })
  it("a registration file with no A2A service: card_not_listed", async () => {
    for (const reg of [{}, { services: [] }, { services: [{ name: "web", endpoint: "https://api.normies.art/agents/info/7141" }] }, { services: "A2A" }]) {
      const f = fake({ [REG_URL]: { text: JSON.stringify(reg) } })
      assert.deepEqual(await checkAgentCard(input(), f.deps), failed("card_not_listed"))
      assert.deepEqual(f.requested, [REG_URL])
    }
  })
  it("only card_unreadable counts as \"couldn't read\"", () => {
    assert.deepEqual(AGENT_CARD_REASONS.filter((reason) => agentCardUnreadable({ reason })), ["card_unreadable"])
  })
})

describe("a2aEndpoint", () => {
  it("takes the services entry named A2A, in any letter case; the first one wins", () => {
    assert.equal(a2aEndpoint(REGISTRATION), CARD_URL)
    assert.equal(a2aEndpoint({ services: [{ name: "a2a", endpoint: " https://x.example/c " }] }), "https://x.example/c")
    assert.equal(a2aEndpoint({ services: [{ name: "A2A", endpoint: "https://one.example/c" }, { name: "A2A", endpoint: "https://two.example/c" }] }), "https://one.example/c")
  })
  it("reads the older `endpoints` list only when there is no `services` list", () => {
    assert.equal(a2aEndpoint({ endpoints: [{ name: "A2A", endpoint: "https://old.example/c" }] }), "https://old.example/c")
    assert.equal(a2aEndpoint({ services: [], endpoints: [{ name: "A2A", endpoint: "https://old.example/c" }] }), null)
  })
  it("skips malformed entries and never guesses", () => {
    for (const bad of [null, "x", [], { services: [null, 5, { name: "A2A" }, { name: "A2A", endpoint: 7 }, { name: "A2A", endpoint: "" }, { endpoint: "https://x.example" }] }]) {
      assert.equal(a2aEndpoint(bad), null)
    }
  })
})

describe("checkAgentCardCached: a failure is never cached", () => {
  it("a definite answer is reused; the second call makes no requests", async () => {
    const f = fake()
    const first = await checkAgentCardCached(input(), f.deps)
    const second = await checkAgentCardCached(input(), f.deps)
    assert.deepEqual(second, first)
    assert.deepEqual(f.requested, [REG_URL, CARD_URL])
  })
  it("a name mismatch is a definite answer too, and is keyed by the name asked about", async () => {
    const f = fake()
    assert.equal((await checkAgentCardCached(input({ agentName: "Other" }), f.deps)).reason, "card_name_mismatch")
    assert.equal((await checkAgentCardCached(input({ agentName: "Other" }), f.deps)).reason, "card_name_mismatch")
    assert.equal(f.requested.length, 2)
    assert.equal((await checkAgentCardCached(input(), f.deps)).passed, true)
    assert.equal(f.requested.length, 4)
  })
  it("card_unreadable is not kept: the next call reads again and can pass", async () => {
    let down = true
    const f = fake()
    const real = f.deps.fetchText
    f.deps.fetchText = async (url) => { if (down && url.toString() === CARD_URL) throw new Error("timeout"); return real(url) }
    assert.equal((await checkAgentCardCached(input(), f.deps)).reason, "card_unreadable")
    down = false
    assert.equal((await checkAgentCardCached(input(), f.deps)).passed, true)
  })
})

describe("copy and safety", () => {
  const src = readFileSync("lib/agent-card.ts", "utf8")
  it("says \"Agent card published\", never that the agent is online", () => {
    assert.equal(AGENT_CARD_PASS_TEXT, "Agent card published")
    for (const f of ["lib/pulse/beats.ts", "components/agent-pulse-bar.tsx", "lib/api/agent-pulse.ts"]) {
      const text = readFileSync(f, "utf8").replace(/^\s*(\/\/|\*|\/\*).*$/gm, "")
      assert.doesNotMatch(text, /agent (is )?online|is online|agent is live/i, f)
    }
    assert.match(readFileSync("components/agent-pulse-bar.tsx", "utf8"), /Agent card published/)
  })
  it("the real fetch has a time limit, a size cap, refuses redirects and reads nothing but GET", () => {
    assert.match(src, /fetchWithTimeout\(/)
    assert.match(src, /redirect: "error"/)
    assert.match(src, /AGENT_CARD_MAX_BYTES/)
    assert.doesNotMatch(src, /method: "(POST|PUT|PATCH|DELETE)"/)
    assert.doesNotMatch(src, /writeContract|sendTransaction|signTypedData|signMessage/)
  })
  it("the breakdown string is unchanged", () => {
    assert.match(readFileSync("lib/api/agent-pulse.ts", "utf8"), /breakdown\.push\("Has active agent card"\)/)
  })
})
