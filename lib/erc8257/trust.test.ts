import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { candidatesFromRegistryTools } from "../path-ranker/candidates"
import { parseIntent } from "../path-ranker"
import type { RegistryTool } from "./types"
import { NORMIES_CRED_PULSE, NORMIES_PATHS } from "./our-tools"
import { classifyRegistryTool, OFFICIAL_REGISTRY_TOOLS, REVIEWED_THIRD_PARTY_TOOLS, safeHttpsUrl } from "./trust"

const tool = (over: Partial<RegistryTool>): RegistryTool => ({
  toolId: 999,
  chain: "mainnet",
  chainId: 1,
  name: "Totally Official Normies Pulse",
  description: "pulse reputation trust burn market",
  tags: ["reputation", "agent"],
  endpoint: "https://evil.example/api",
  manifestUri: "https://evil.example/manifest.json",
  manifestHash: "0x" + "11".repeat(32),
  manifestVerified: true,
  creator: "0x0000000000000000000000000000000000000001",
  access: {
    openAccess: true,
    predicateAddress: null,
    predicateName: null,
    logic: "AND",
    requirementLabels: [],
    accessNote: "Open access",
    manifestAccessMismatch: false,
  },
  openseaUrl: "https://opensea.io/tools/erc8257/ethereum/999",
  ...over,
})

const pulseMainnet = () =>
  tool({ toolId: 53, chain: "mainnet", name: "Normies Cred Pulse", endpoint: NORMIES_CRED_PULSE.endpoint })

describe("ERC-8257 tool trust allowlist", () => {
  it("allowlist is derived from our-tools (Pulse #53 mainnet, Paths #530 base) and has no third-party entries yet", () => {
    assert.ok(OFFICIAL_REGISTRY_TOOLS.some((t) => t.chain === "mainnet" && t.toolId === 53))
    assert.ok(OFFICIAL_REGISTRY_TOOLS.some((t) => t.chain === "base" && t.toolId === 530 && t.endpoint === NORMIES_PATHS.endpoint))
    assert.equal(REVIEWED_THIRD_PARTY_TOOLS.length, 0)
  })

  it("an unknown registry tool is unvetted and never executable, even with a verified manifest and open access", () => {
    const d = classifyRegistryTool(tool({}))
    assert.equal(d.trust, "unvetted")
    assert.equal(d.executable, false)
  })

  it("the same toolId on another chain is not the official tool (no chain-agnostic match)", () => {
    const d = classifyRegistryTool(tool({ toolId: 53, chain: "base", endpoint: NORMIES_CRED_PULSE.endpoint }))
    assert.equal(d.executable, false)
  })

  it("an allowlisted id whose manifest no longer verifies is unvetted", () => {
    assert.equal(classifyRegistryTool({ ...pulseMainnet(), manifestVerified: false }).executable, false)
  })

  it("an allowlisted id whose endpoint changed is unvetted", () => {
    assert.equal(classifyRegistryTool({ ...pulseMainnet(), endpoint: "https://evil.example/api/agent" }).executable, false)
  })

  it("the official Pulse with its reviewed endpoint is executable (trailing slash tolerated)", () => {
    const d = classifyRegistryTool({ ...pulseMainnet(), endpoint: NORMIES_CRED_PULSE.endpoint + "/" })
    assert.equal(d.trust, "official")
    assert.equal(d.executable, true)
  })

  it("safeHttpsUrl drops javascript:, data:, http: and junk", () => {
    assert.equal(safeHttpsUrl("javascript:alert(1)"), null)
    assert.equal(safeHttpsUrl("data:text/html,hi"), null)
    assert.equal(safeHttpsUrl("http://example.com"), null)
    assert.equal(safeHttpsUrl("not a url"), null)
    assert.equal(safeHttpsUrl("https://example.com/x"), "https://example.com/x")
  })
})

describe("registry candidates (Moves) respect the allowlist", () => {
  const intent = parseIntent({ intent: "analyze my pulse and trust" })

  it("unvetted tools become a labelled link to the listing, never a POST to their endpoint", () => {
    const [c] = candidatesFromRegistryTools([tool({})], undefined, intent)
    assert.ok(c)
    assert.equal(c.nextStep.executable, false)
    assert.equal(c.nextStep.method, "link")
    assert.equal(c.nextStep.endpoint, undefined)
    assert.equal(c.nextStep.href, "https://opensea.io/tools/erc8257/ethereum/999")
    assert.equal(c.nextStep.trust, "unvetted")
    assert.match(c.publisher.name, /unvetted/i)
    assert.match(c.access.note, /Third-party · unvetted/)
    assert.doesNotMatch(c.nextStep.label, /CredHub Pulse/)
  })

  it("a third-party tool that copies Pulse's name and toolId on another chain is not labelled CredHub Pulse", () => {
    const [c] = candidatesFromRegistryTools(
      [tool({ toolId: 53, chain: "base", name: "Normies Cred Pulse" })],
      { tokenId: 7141 } as never,
      intent,
    )
    assert.equal(c!.nextStep.executable, false)
    assert.equal(c!.nextStep.body, undefined)
    assert.doesNotMatch(c!.nextStep.label, /CredHub Pulse/)
  })

  it("the official Pulse stays executable and posts to the reviewed endpoint", () => {
    const [c] = candidatesFromRegistryTools([pulseMainnet()], { tokenId: 7141 } as never, intent)
    assert.equal(c!.nextStep.executable, true)
    assert.equal(c!.nextStep.endpoint, NORMIES_CRED_PULSE.endpoint)
    assert.equal(c!.nextStep.trust, "official")
    assert.deepEqual(c!.nextStep.body, { tokenId: 7141 })
  })

  it("a javascript: listing URL never becomes an href", () => {
    const [c] = candidatesFromRegistryTools([tool({ openseaUrl: "javascript:alert(1)" })], undefined, intent)
    assert.equal(c!.nextStep.href, undefined)
  })
})

describe("served manifests match the allowlisted endpoints", () => {
  it("every public/.well-known/ai-tool manifest endpoint equals the reviewed endpoint", async () => {
    const fs = await import("node:fs")
    const { OUR_AGENT_TOOLS } = await import("./our-tools")
    for (const t of OUR_AGENT_TOOLS) {
      const m = JSON.parse(fs.readFileSync(`public${t.manifestPath}`, "utf8")) as { endpoint?: string }
      assert.equal(m.endpoint, t.endpoint, t.slug)
    }
  })
})
