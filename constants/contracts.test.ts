// The ERC-8004 Identity Registry is an ERC-721: an agent's registration URI is read with tokenURI(agentId).
// It has no agentURI(uint256) getter: that call reverts on mainnet (checked 2026-11-14 for agent #32626, PR #181).
// These tests keep every reader, and the sample code Ask Zulo learns from, on the getter that exists.
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"

import { createPublicClient, custom, decodeFunctionData, encodeAbiParameters, toFunctionSelector } from "viem"
import { mainnet } from "viem/chains"

import { ERC8004, IDENTITY_REGISTRY_READ_ABI, ZULO } from "./contracts"

const AGENT_URI_SELECTOR = toFunctionSelector("agentURI(uint256)")
const TOKEN_URI_SELECTOR = toFunctionSelector("tokenURI(uint256)")
const OWNER_OF_SELECTOR = toFunctionSelector("ownerOf(uint256)")
const REGISTRATION_URL = "https://api.normies.art/agents/metadata/7141"
const OWNER = "0xde152afb7db5373f34876e1499fbd893a82dd336"

/** A stub registry that behaves like mainnet: tokenURI and ownerOf answer, anything else (agentURI included) reverts. */
function stubRegistry() {
  const calls: string[] = []
  const client = createPublicClient({
    chain: mainnet,
    transport: custom({
      async request({ method, params }: { method: string; params?: unknown }) {
        if (method === "eth_chainId") return "0x1"
        if (method !== "eth_call") throw new Error(`unexpected RPC method ${method}`)
        const { to, data } = (params as [{ to: string; data: string }])[0]
        assert.equal(to.toLowerCase(), ERC8004.IDENTITY_REGISTRY.toLowerCase())
        const selector = data.slice(0, 10)
        calls.push(selector)
        if (selector === TOKEN_URI_SELECTOR) return encodeAbiParameters([{ type: "string" }], [REGISTRATION_URL])
        if (selector === OWNER_OF_SELECTOR) return "0x" + OWNER.slice(2).padStart(64, "0")
        throw Object.assign(new Error("execution reverted"), { code: 3, data: "0x" })
      },
    }),
  })
  return { client, calls }
}

describe("IDENTITY_REGISTRY_READ_ABI", () => {
  it("lists tokenURI and ownerOf, and no agentURI", () => {
    const names = IDENTITY_REGISTRY_READ_ABI.map((f) => f.name)
    assert.deepEqual([...names].sort(), ["ownerOf", "tokenURI"])
    assert.equal(names.includes("agentURI" as never), false)
  })
  it("the selectors are the real ones", () => {
    assert.equal(TOKEN_URI_SELECTOR, "0xc87b56dd")
    assert.equal(OWNER_OF_SELECTOR, "0x6352211e")
    assert.equal(AGENT_URI_SELECTOR, "0x78396cb3")
  })
  it("read-only: view functions only", () => {
    for (const f of IDENTITY_REGISTRY_READ_ABI) assert.equal(f.stateMutability, "view", f.name)
  })
})

describe("reading the registration URI against a registry that reverts on agentURI", () => {
  it("the constant's tokenURI read succeeds and is the call that reaches the chain", async () => {
    const { client, calls } = stubRegistry()
    const uri = await client.readContract({
      address: ERC8004.IDENTITY_REGISTRY as `0x${string}`,
      abi: IDENTITY_REGISTRY_READ_ABI,
      functionName: "tokenURI",
      args: [BigInt(ZULO.agentId)],
    })
    assert.equal(uri, REGISTRATION_URL)
    assert.deepEqual(calls, [TOKEN_URI_SELECTOR])
    assert.equal(calls.includes(AGENT_URI_SELECTOR), false)
  })
  it("ownerOf still reads", async () => {
    const { client } = stubRegistry()
    const owner = await client.readContract({
      address: ERC8004.IDENTITY_REGISTRY as `0x${string}`,
      abi: IDENTITY_REGISTRY_READ_ABI,
      functionName: "ownerOf",
      args: [BigInt(ZULO.agentId)],
    })
    assert.equal(owner.toLowerCase(), OWNER)
  })
  it("the old agentURI read fails on this registry, which is why it was replaced", async () => {
    const { client, calls } = stubRegistry()
    const OLD_ABI = [{ type: "function", name: "agentURI", stateMutability: "view", inputs: [{ name: "agentId", type: "uint256" }], outputs: [{ name: "", type: "string" }] }] as const
    await assert.rejects(
      client.readContract({ address: ERC8004.IDENTITY_REGISTRY as `0x${string}`, abi: OLD_ABI, functionName: "agentURI", args: [BigInt(ZULO.agentId)] }),
    )
    // The client may retry a failed call; every attempt is the agentURI selector and none succeeds.
    assert.ok(calls.length >= 1)
    assert.ok(calls.every((c) => c === AGENT_URI_SELECTOR))
  })
  it("the calldata the constant builds is tokenURI(32626)", () => {
    const data = (TOKEN_URI_SELECTOR + BigInt(ZULO.agentId).toString(16).padStart(64, "0")) as `0x${string}`
    const decoded = decodeFunctionData({ abi: IDENTITY_REGISTRY_READ_ABI, data })
    assert.equal(decoded.functionName, "tokenURI")
    assert.deepEqual(decoded.args, [BigInt(32626)])
  })
})

describe("every reader, and Ask Zulo's sample code, calls tokenURI", () => {
  const read = (f: string) => readFileSync(f, "utf8")
  const READERS = ["hooks/use-erc8004.ts", "lib/api/agent-pulse.ts", "lib/chat-ratings/load.ts"]
  const KNOWLEDGE = ["lib/agent-recommendations/loadKnowledge.ts", "lib/agent-recommendations/knowledge/protocols-deep-dive.md"]

  it("no file calls the agentURI getter", () => {
    for (const f of [...READERS, ...KNOWLEDGE, "components/erc8004-card.tsx"]) {
      assert.doesNotMatch(read(f), /functionName:\s*"agentURI"/, f)
    }
  })
  it("the hook and the Pulse read tokenURI through the shared constant", () => {
    for (const f of ["hooks/use-erc8004.ts", "lib/api/agent-pulse.ts"]) {
      const src = read(f)
      assert.match(src, /functionName:\s*"tokenURI"/, f)
      assert.match(src, /abi: IDENTITY_REGISTRY_READ_ABI/, f)
    }
    assert.doesNotMatch(read("lib/api/agent-pulse.ts"), /REGISTRY_TOKEN_URI_ABI/, "the local ABI fragment from PR #181 is gone")
  })
  it("chat ratings only reads ownerOf from the registry", () => {
    const calls = [...read("lib/chat-ratings/load.ts").matchAll(/abi: IDENTITY_REGISTRY_READ_ABI,\s*functionName:\s*"(\w+)"/g)].map((m) => m[1])
    assert.deepEqual(calls, ["ownerOf"])
  })
  it("the hook exposes registrationURI, and the card uses it", () => {
    assert.match(read("hooks/use-erc8004.ts"), /registrationURI: string \| null/)
    assert.doesNotMatch(read("hooks/use-erc8004.ts"), /^\s*agentURI[,:]/m)
    assert.match(read("components/erc8004-card.tsx"), /registrationURI/)
    assert.doesNotMatch(read("components/erc8004-card.tsx"), /agentURI/)
  })
  it("the sample code in Ask Zulo's knowledge reads tokenURI, in the file and in its embedded copy", () => {
    for (const f of KNOWLEDGE) {
      const src = read(f)
      assert.match(src, /const registrationURI = await client\.readContract\(\{[\s\S]{0,160}functionName: "tokenURI"/, f)
      assert.doesNotMatch(src, /const agentURI = /, f)
      // Prose may name agentURI only to say the getter doesn't exist.
      for (const line of src.split("\n").filter((l) => l.includes("agentURI"))) assert.match(line, /no agentURI function/, `${f}: ${line.slice(0, 80)}`)
    }
  })
  it("wording: \"published agent card\", never \"active agent card\" or \"online\" in Ask Zulo's prompt and context", () => {
    for (const f of ["lib/agent-recommendations/buildContext.ts", "lib/agent-recommendations/composePrompt.ts"]) {
      const src = read(f)
      assert.match(src, /published agent card/, f)
      assert.doesNotMatch(src, /active agent card/, f)
      assert.doesNotMatch(src, /agent (is )?online/i, f)
    }
  })
})
