import { describe, it } from "node:test"
import assert from "node:assert/strict"

import { buildBurnBuy, ownerList, SourceError, type Deps, type MarketSnapshot, type RawListing, type RarityToken } from "./service"

const NOW = new Date("2026-10-01T00:00:00.000Z")

function snapshot(pixels: Record<number, number>, walletScores: Map<string, number> = new Map()): MarketSnapshot {
  const originalPixels = new Map(Object.entries(pixels).map(([k, v]) => [Number(k), v]))
  const pixelSupply = new Map<number, number>()
  for (const px of originalPixels.values()) pixelSupply.set(px, (pixelSupply.get(px) ?? 0) + 100) // common
  return { livingSupply: 7226, wallets: 1723, censusTotal: 25873, originalPixels, pixelSupply, oldestIndexedAt: "2026-09-29T20:00:00Z", walletScores }
}
const tk = (id: number, over: Partial<RarityToken> = {}): RarityToken => ({
  id, rank: 4000, type: "Human", actionPoints: 0, awakenedAgent: false, fairValueEth: 0.29, ...over,
})
const lst = (id: number, priceEth: number, over: Partial<RawListing> = {}): RawListing => ({ ...tk(id), priceEth, ...over })

function deps(over: Partial<Deps> = {}): Deps {
  return {
    resolveHolder: async () => ({ address: "0xabc", ens: null, tokenIds: [] }),
    fetchTokens: async () => [],
    fetchListings: async () => ({ items: [], floorEth: 0.286, total: 0 }),
    loadSnapshot: async () => snapshot({ 1: 700, 2: 900, 3: 500, 7141: 454 }),
    now: () => NOW,
    ...over,
  }
}

describe("buildBurnBuy", () => {
  it("market-only: no wallet, ranks fodder, carries census and promo info", async () => {
    const r = await buildBurnBuy({}, deps({ fetchListings: async () => ({ items: [lst(2, 0.3), lst(3, 0.29)], floorEth: 0.286, total: 2 }) }))
    assert.equal(r.wallet, null)
    assert.equal(r.market!.bestPixelFodder[0].tokenId, 2) // 36/0.30 = 120 beats 20/0.29 = 69
    assert.equal(r.census.wallets, 1723)
    assert.equal(r.promo.ratePercent, 4)
    assert.match(r.promo.ends, /official Normies Discord/)
    assert.equal(r.asOf, NOW.toISOString())
  })

  it("solo holder (#7141, awakened): keeps it, says nothing to burn, offers to add", async () => {
    const r = await buildBurnBuy(
      { wallet: "0xabc" },
      deps({
        resolveHolder: async () => ({ address: "0xabc", ens: null, tokenIds: [7141] }),
        fetchTokens: async () => [tk(7141, { awakenedAgent: true, actionPoints: 12, rank: 3905 })],
        fetchListings: async () => ({ items: [lst(2, 0.3)], floorEth: 0.286, total: 1 }),
      }),
    )
    const a = r.wallet!.advice
    assert.equal(a.held, 1)
    assert.equal(a.tokens[0].verdict, "keep")
    assert.ok(a.moves.every((m) => m.kind !== "burn-own"))
    assert.ok(a.moves.length > 0)
    assert.equal(r.wallet!.advice.holdings[0].originalPixels, 454)
  })

  it("an address with no Normies (e.g. an ENS pointing at a different wallet) gets an explicit note", async () => {
    const r = await buildBurnBuy({ wallet: "shisler671.eth" }, deps({ resolveHolder: async () => ({ address: "0xae34", ens: "shisler671.eth", tokenIds: [] }) }))
    assert.equal(r.wallet!.advice.held, 0)
    assert.equal(r.wallet!.advice.score, 0)
    assert.ok(r.wallet!.advice.notes.some((n) => /shisler671\.eth resolves to 0xae34/.test(n) && /another wallet/.test(n)))
    assert.equal(r.sources.rarity.note, "wallet holds no Normies")
  })

  it("listings down: says so per source, still answers the wallet, market is null (no silent fallback)", async () => {
    const r = await buildBurnBuy(
      { wallet: "0xabc" },
      deps({
        resolveHolder: async () => ({ address: "0xabc", ens: null, tokenIds: [1, 7141] }),
        fetchTokens: async () => [tk(1), tk(7141, { awakenedAgent: true })],
        fetchListings: async () => { throw new Error("upstream 503") },
      }),
    )
    assert.equal(r.sources.listings.ok, false)
    assert.match(r.sources.listings.error!, /503/)
    assert.equal(r.market, null)
    assert.equal(r.wallet!.advice.held, 2)
  })

  it("index down: refuses to guess and throws a typed error", async () => {
    await assert.rejects(
      buildBurnBuy({}, deps({ loadSnapshot: async () => { throw new Error("db timeout") } })),
      (e: unknown) => e instanceof SourceError && e.source === "index",
    )
  })

  it("invalid wallet input propagates as invalid-input, not a generic failure", async () => {
    await assert.rejects(
      buildBurnBuy({ wallet: "nope" }, deps({ resolveHolder: async () => { throw new SourceError("holder", "Invalid Ethereum address", "invalid-input") } })),
      (e: unknown) => e instanceof SourceError && e.kind === "invalid-input",
    )
  })

  it("a held token missing from the index is skipped with a visible caveat", async () => {
    const r = await buildBurnBuy(
      { wallet: "0xabc" },
      deps({ resolveHolder: async () => ({ address: "0xabc", ens: null, tokenIds: [1, 8888] }), fetchTokens: async () => [tk(1), tk(8888)] }),
    )
    assert.equal(r.wallet!.advice.held, 1)
    assert.ok(r.caveats.some((c) => /#8888/.test(c)))
  })

  it("a listing missing from the index is counted as skipped, not guessed", async () => {
    const r = await buildBurnBuy({}, deps({ fetchListings: async () => ({ items: [lst(2, 0.3), lst(9999, 0.3)], floorEth: 0.286, total: 2 }) }))
    assert.equal(r.market!.skippedListings, 1)
    assert.match(r.sources.listings.note!, /1 listings skipped/)
  })

  it("never recommends buying a token the wallet already owns", async () => {
    const r = await buildBurnBuy(
      { wallet: "0xabc" },
      deps({
        resolveHolder: async () => ({ address: "0xabc", ens: null, tokenIds: [7141] }),
        fetchTokens: async () => [tk(7141, { awakenedAgent: true })],
        fetchListings: async () => ({ items: [lst(7141, 0.3), lst(2, 0.3)], floorEth: 0.286, total: 2 }),
      }),
    )
    assert.ok(r.wallet!.advice.moves.every((m) => !m.tokenIds.includes(7141)))
  })

  it("refuses an oversized wallet instead of showing a wrong, truncated score", async () => {
    const ids = Array.from({ length: 1001 }, (_, i) => i)
    await assert.rejects(
      buildBurnBuy({ wallet: "0xabc" }, deps({ resolveHolder: async () => ({ address: "0xabc", ens: null, tokenIds: ids }) })),
      (e: unknown) => e instanceof SourceError && e.kind === "invalid-input" && /too many/.test(e.message),
    )
  })

  it("swaps the wallet's stale index score for its live score in the census (share is consistent)", async () => {
    // index thinks 0xabc scores 1.0 (no AP); live it carries 12 AP => score 3.4
    const snap = snapshot({ 7141: 454 }, new Map([["0xabc", 1]]))
    const r = await buildBurnBuy(
      { wallet: "0xABC" },
      deps({
        loadSnapshot: async () => snap,
        resolveHolder: async () => ({ address: "0xABC", ens: null, tokenIds: [7141] }),
        fetchTokens: async () => [tk(7141, { awakenedAgent: true, actionPoints: 12 })],
      }),
    )
    const a = r.wallet!.advice
    assert.equal(a.score, 3.4)
    // others = 25873 - 1 = 25872 ; share = 3.4 / (25872 + 3.4)
    assert.ok(Math.abs(a.sharePct - (3.4 / 25875.4) * 100) < 0.0002, String(a.sharePct))
  })

  it("adds a visible staleness caveat about the index", async () => {
    const r = await buildBurnBuy({}, deps())
    assert.ok(r.caveats.some((c) => /2026-09-29 20:00 UTC/.test(c)))
  })

  it("empty wallet that is a Canvas delegate: names the tokens, the limit, and the OWNER wallet to use", async () => {
    const r = await buildBurnBuy(
      { wallet: "32626.eth" },
      deps({
        resolveHolder: async () => ({ address: "0xb879", ens: "32626.eth", tokenIds: [] }),
        findDelegations: async () => [{ tokenId: 7141, owner: "0xfafd" }],
      }),
    )
    const w = r.wallet!
    assert.equal(w.advice.held, 0)
    assert.deepEqual(w.delegateOf, [{ tokenId: 7141, owner: "0xfafd" }])
    const note = w.advice.notes.join(" ")
    assert.match(note, /Canvas delegate for #7141/)
    assert.match(note, /cannot burn/)
    assert.match(note, /OWNER wallet: 0xfafd/)
  })

  it("empty wallet, not a delegate: says the ENS resolved to this address and to try another", async () => {
    const r = await buildBurnBuy(
      { wallet: "shisler671.eth" },
      deps({
        resolveHolder: async () => ({ address: "0xae34", ens: "shisler671.eth", tokenIds: [] }),
        findDelegations: async () => [],
      }),
    )
    const note = r.wallet!.advice.notes.join(" ")
    assert.match(note, /shisler671\.eth resolves to 0xae34/)
    assert.match(note, /not a Canvas or Delegate\.xyz delegate/)
    assert.deepEqual(r.wallet!.delegateOf, [])
  })

  it("delegate lookup failing is stated as a caveat, never silent, and the answer still comes back", async () => {
    const r = await buildBurnBuy(
      { wallet: "0xabc" },
      deps({ resolveHolder: async () => ({ address: "0xabc", ens: null, tokenIds: [] }), findDelegations: async () => { throw new Error("db down") } }),
    )
    assert.ok(r.caveats.some((c) => /Could not check whether this wallet is a delegate \(Canvas or Delegate\.xyz\): db down/.test(c)))
    assert.equal(r.wallet!.advice.held, 0)
  })

  it("a wallet that is a Delegate.xyz delegate (a whole vault) is told so, with the owner, and is NOT told it is not a delegate", async () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ tokenId: 100 + i, owner: "0xVAULT", via: "delegate.xyz" as const }))
    const r = await buildBurnBuy(
      { wallet: "0xhot" },
      deps({ resolveHolder: async () => ({ address: "0xhot", ens: null, tokenIds: [] }), findDelegations: async () => many }),
    )
    const note = r.wallet!.advice.notes.join(" ")
    assert.match(note, /Delegate\.xyz delegate for 30 Normies \(including #100, #101, #102\)/)
    assert.match(note, /OWNER wallet: 0xVAULT/)
    assert.doesNotMatch(note, /is not a/)
    assert.equal(r.wallet!.delegateOf.length, 30)
    assert.equal(r.wallet!.delegateOf[0].via, "delegate.xyz")
  })

  it("when the delegation check failed it never claims 'not a delegate': it says it could not check", async () => {
    const r = await buildBurnBuy(
      { wallet: "0xabc" },
      deps({ resolveHolder: async () => ({ address: "0xabc", ens: null, tokenIds: [] }), findDelegations: async () => { throw new Error("rpc down") } }),
    )
    const note = r.wallet!.advice.notes.join(" ")
    assert.match(note, /could not check whether it is a delegate/)
    assert.doesNotMatch(note, /is not a Canvas/)
  })

  it("a wallet that owns Normies and is ALSO a delegate gets its own answer plus a note about the rest (never including tokens it owns)", async () => {
    const r = await buildBurnBuy(
      { wallet: "0xabc" },
      deps({
        resolveHolder: async () => ({ address: "0xabc", ens: null, tokenIds: [7141] }),
        fetchTokens: async () => [tk(7141, { awakenedAgent: true })],
        findDelegations: async () => [
          { tokenId: 7141, owner: "0xabc" }, // its own token: not a delegation worth reporting
          { tokenId: 30, owner: "0xVAULT", via: "delegate.xyz" as const },
          { tokenId: 38, owner: "0xVAULT", via: "delegate.xyz" as const },
        ],
      }),
    )
    assert.equal(r.wallet!.advice.held, 1)
    assert.deepEqual(r.wallet!.delegateOf.map((d) => d.tokenId), [30, 38])
    assert.match(r.wallet!.advice.notes.join(" "), /also acts as a Delegate\.xyz delegate for #30 and #38/)
  })

  it("a delegation lookup failure for a wallet that owns Normies is silent: it still gets its answer, no scary caveat", async () => {
    const r = await buildBurnBuy(
      { wallet: "0xabc" },
      deps({
        resolveHolder: async () => ({ address: "0xabc", ens: null, tokenIds: [7141] }),
        fetchTokens: async () => [tk(7141, { awakenedAgent: true })],
        findDelegations: async () => { throw new Error("rpc down") },
      }),
    )
    assert.equal(r.wallet!.advice.held, 1)
    assert.ok(!r.caveats.some((c) => /delegate/i.test(c)))
  })
})

describe("ownerList", () => {
  it("lists up to three owners in full and summarises the rest", () => {
    const d = (owner: string) => ({ tokenId: 1, owner })
    assert.equal(ownerList([d("a"), d("b"), d("a")]), "a, b")
    assert.equal(ownerList(["a", "b", "c", "d", "e"].map(d)), "a, b, c and 2 more")
  })
})
