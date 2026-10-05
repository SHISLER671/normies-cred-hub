import { describe, it } from "node:test"
import assert from "node:assert/strict"

import { getToolsListForPrompt, tools } from "./tools"

// The normies.art hosts that really exist (verified against https://www.normies.art/api/tools and scripts/check-links.ts, 2026-10-05).
// A guessed subdomain (arena., zombies., card., grid., news., node., pup., normiecam., generator.) once put nine dead links in the Tools
// modal, and this list is what Zulo is told it may recommend from.
const REAL_NORMIES_HOSTS = new Set(["www.normies.art", "api.normies.art", "canvas.normies.art", "rarity.normies.art", "multisend.normies.art", "simulator.normies.art", "legacy.normies.art"])

describe("curated Tools list", () => {
  it("ids are unique and every url is https", () => {
    assert.equal(new Set(tools.map((t) => t.id)).size, tools.length)
    for (const t of tools) assert.match(t.url, /^https:\/\//, t.id)
  })
  it("any normies.art host is one that really exists (no guessed subdomains)", () => {
    for (const t of tools) {
      const host = new URL(t.url).hostname
      if (host.endsWith("normies.art")) assert.ok(REAL_NORMIES_HOSTS.has(host), `${t.id}: ${host} is not a known real host`)
    }
  })
  it("the official tools use the addresses the official directory publishes", () => {
    const byId = Object.fromEntries(tools.map((t) => [t.id, t.url]))
    assert.equal(byId["pvp"], "https://legacy.normies.art/pvp")
    assert.equal(byId["grid"], "https://legacy.normies.art/grid")
    assert.equal(byId["normie-cam"], "https://legacy.normies.art/normiecam")
    assert.equal(byId["normie-card"], "https://legacy.normies.art/normiecard")
    assert.equal(byId["normies-news"], "https://legacy.normies.art/normiesnews")
    assert.equal(byId["normies-node"], "https://normiesnode.up.railway.app/")
    assert.equal(byId["generator"], "https://legacy.normies.art/")
  })
  it("Arena and Zombies are not listed as tools until they are live", () => {
    const ids = tools.map((t) => t.id)
    assert.ok(!ids.includes("arena"))
    assert.ok(!ids.includes("zombies"))
  })
  it("the author handle is spelled right (@serc1n, with the digit one)", () => {
    for (const t of tools) assert.doesNotMatch(t.description, /@sercln/i, t.id)
  })
  it("the prompt list carries the same addresses", () => {
    assert.match(getToolsListForPrompt(), /legacy\.normies\.art\/normiecam/)
  })
})
