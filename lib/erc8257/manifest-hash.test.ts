import { describe, it } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { execSync } from "node:child_process"

import { canonicalJson, keccak256Hex, manifestHash } from "./manifest-hash"
import { OUR_AGENT_TOOLS, NORMIES_PIXEL_CHECK, registeredTools } from "./our-tools"
import { bodyToParams } from "../ap-check/body"

const root = path.resolve(__dirname, "../..")
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8")
const enc = (s: string) => new TextEncoder().encode(s)

describe("keccak256 (Ethereum flavour)", () => {
  it("matches the well-known vectors", () => {
    assert.equal(keccak256Hex(enc("")), "0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470")
    assert.equal(keccak256Hex(enc("{}")), "0xb48d38f93eaa084033fc5970bf96e559c33c4cdc07d889ab00b4d63f9590739d")
  })
  it("handles inputs that cross the 136-byte block boundary", () => {
    for (const n of [135, 136, 137, 272, 1000]) assert.match(keccak256Hex(new Uint8Array(n)), /^0x[0-9a-f]{64}$/)
    assert.notEqual(keccak256Hex(new Uint8Array(135)), keccak256Hex(new Uint8Array(136)))
  })
})

describe("canonical JSON (RFC 8785)", () => {
  it("sorts keys, drops whitespace, keeps unicode as is", () => {
    assert.equal(canonicalJson({ b: 1, a: [true, null, "3–5"] }), '{"a":[true,null,"3–5"],"b":1}')
  })
  it("refuses fractional numbers rather than hashing them wrong", () => {
    assert.throws(() => canonicalJson({ x: 0.5 }))
  })
})

describe("manifestHash", () => {
  it("reproduces the hash stored on chain for Paths (Ethereum #215, Base #530, Abstract #2)", () => {
    let original: string
    try {
      original = execSync("git show 96ff065:public/.well-known/ai-tool/normies-paths.json", { cwd: root, stdio: ["ignore", "pipe", "ignore"] }).toString()
    } catch {
      return // shallow clone without that commit (e.g. CI): the vectors above still cover the hash itself
    }
    assert.equal(manifestHash(original), "0xead3879fb3414a03c2134c08a4c5f10c84b853ad06724c3c8a029349f6047aab")
  })

  // If this fails you edited a served manifest. That is allowed, but the on-chain manifestHash then no longer matches and
  // OpenSea shows the tool as unverified. Either revert, or put the new hash here AND have the creator wallet call
  // updateToolMetadata(toolId, sameURI, newHash) on every chain listed for that tool.
  for (const tool of OUR_AGENT_TOOLS) {
    it(`${tool.slug}.json hashes to the pinned manifestHash`, () => {
      assert.equal(manifestHash(read(`public${tool.manifestPath}`)), tool.manifestHash)
    })
  }
})

describe("served manifests", () => {
  for (const tool of OUR_AGENT_TOOLS) {
    const m = JSON.parse(read(`public${tool.manifestPath}`))
    it(`${tool.slug}: endpoint and URL agree with our-tools.ts, on this origin`, () => {
      assert.equal(m.endpoint, tool.endpoint)
      assert.equal(tool.manifestUrl, `https://normiescredhub.vercel.app${tool.manifestPath}`)
      assert.ok(m.endpoint.startsWith("https://normiescredhub.vercel.app/api/"))
      assert.equal(m.creatorAddress, "0xb8792e6516b88e73ed0723f8c1c8a92531a98767")
    })
    it(`${tool.slug}: its images exist in /public`, () => {
      for (const k of ["image", "featuredImage"]) {
        const p = new URL(m[k]).pathname
        assert.ok(fs.existsSync(path.join(root, "public", p)), `${k} ${p}`)
      }
    })
  }

  it("Pixel Check is open: no access block, read-only wording, never named 'AP'", () => {
    const m = JSON.parse(read(`public${NORMIES_PIXEL_CHECK.manifestPath}`))
    assert.equal(m.access, undefined)
    assert.match(m.description, /never asks for keys, seeds or signatures/)
    assert.match(m.description, /not made or endorsed by the Normies team/)
    assert.doesNotMatch(m.name, /\bAP\b/)
    assert.deepEqual(Object.keys(m.inputs.properties).sort(), ["amount", "approvals", "calc", "contract", "listings", "token", "wallet"])
  })

  it("index.json lists every tool, and tool IDs match our-tools.ts", () => {
    const index = JSON.parse(read("public/.well-known/ai-tool/index.json"))
    for (const tool of OUR_AGENT_TOOLS) {
      const entry = index.tools.find((t: { slug: string }) => t.slug === tool.slug)
      assert.ok(entry, tool.slug)
      assert.equal(entry.manifest, tool.manifestPath)
      const ids = Object.fromEntries(tool.listings.map((l) => [l.chain, l.toolId]))
      assert.deepEqual(entry.chainToolIds, ids, tool.slug)
    }
  })

  it("llms.txt names every manifest", () => {
    const txt = read("public/llms.txt")
    for (const tool of OUR_AGENT_TOOLS) assert.ok(txt.includes(tool.manifestPath), tool.manifestPath)
  })

  it("only registered tools count as live", () => {
    assert.ok(registeredTools().every((t) => t.listings.length > 0))
  })
})

describe("POST body for /api/ap-check", () => {
  it("maps each question onto the GET parameters", () => {
    assert.equal(bodyToParams({ token: 7141 })!.get("token"), "7141")
    assert.equal(bodyToParams({ listings: true })!.get("listings"), "1")
    const calc = bodyToParams({ calc: "eth", amount: 0.5 })!
    assert.equal(calc.get("calc"), "eth")
    assert.equal(calc.get("amount"), "0.5")
    assert.equal(bodyToParams({ wallet: " 32626.eth " })!.get("wallet"), "32626.eth")
  })
  it("ignores unknown fields and refuses non-objects", () => {
    assert.equal(bodyToParams({ privateKey: "0xabc", signature: "0x1" })!.toString(), "")
    assert.equal(bodyToParams([1]), null)
    assert.equal(bodyToParams("token=1"), null)
    assert.equal(bodyToParams(null), null)
    assert.equal(bodyToParams({ listings: false })!.has("listings"), false)
  })
})
