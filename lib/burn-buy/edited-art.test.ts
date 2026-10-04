import { describe, it } from "node:test"
import assert from "node:assert/strict"

import { adviseToken, adviseWallet, keepReasons, rankFodder, type HeldToken, type Listing } from "./advise"
import { buildPageModel } from "./narrate"
import { buildBurnBuy, type Deps, type MarketSnapshot, type RarityToken, type RawListing } from "./service"

const EDITED = /edited art: burning it erases the art that was drawn on it, for good/
const ctx = { livingSupply: 7226 }

const held = (id: number, over: Partial<HeldToken> = {}): HeldToken => ({
  tokenId: id, originalPixels: 600, actionPoints: 0, rank: 5000, type: "Human", awakenedAgent: false, pixelSupply: 400, forgoneValueEth: 0.29, ...over,
})
const listing = (id: number, over: Partial<Listing> = {}): Listing => ({
  tokenId: id, priceEth: 0.3, actionPoints: 0, originalPixels: 600, rank: 5000, type: "Human", awakenedAgent: false, pixelSupply: 400, ...over,
})

describe("edited art is a keep reason", () => {
  it("keepReasons: a customized Normie gets the reason; an ordinary one, or one with no flag, does not", () => {
    assert.ok(keepReasons(held(1, { customized: true }), ctx).some((r) => EDITED.test(r)))
    assert.deepEqual(keepReasons(held(1, { customized: false }), ctx), [])
    assert.deepEqual(keepReasons(held(1), ctx), [])
  })

  it("it comes right after 'awakened agent' and stacks with the other reasons", () => {
    const r = keepReasons(held(1, { customized: true, awakenedAgent: true, type: "Cat" }), ctx)
    assert.match(r[0], /awakened agent/)
    assert.match(r[1], EDITED)
    assert.match(r[2], /rarer type \(Cat\)/)
  })

  it("adviseToken: an otherwise plain customized Normie is KEEP, the same Normie unedited is a burn candidate", () => {
    const edited = adviseToken(held(1, { customized: true }), ctx)
    assert.equal(edited.verdict, "keep")
    assert.match(edited.reasons[0], EDITED)
    assert.ok(edited.yield.total > 0, "the yield is still computed and shown")
    assert.equal(adviseToken(held(1, { customized: false }), ctx).verdict, "burn")
  })

  it("moves: a customized Normie is never offered in a burn-own move", () => {
    const tokens = [held(1, { customized: true, originalPixels: 700 }), held(2), held(3)]
    const a = adviseWallet(tokens, [], { livingSupply: 7226, censusTotal: 25873 })
    const burned = a.moves.filter((m) => m.kind === "burn-own").flatMap((m) => m.tokenIds)
    assert.ok(burned.length > 0, "the other two are still burnable")
    assert.ok(!burned.includes(1), "the edited one never is")
  })

  it("fodder: an edited listing is never offered as something to buy and burn", () => {
    const l = [listing(1, { customized: true }), listing(2)]
    assert.deepEqual(rankFodder(l, ctx, { withAp: false }).map((f) => f.tokenId), [2])
    assert.deepEqual(adviseWallet([held(9)], l, { livingSupply: 7226, censusTotal: 25873 }).moves.filter((m) => m.kind === "buy-and-burn").flatMap((m) => m.tokenIds).includes(1), false)
  })
})

const snap = (): MarketSnapshot => ({
  livingSupply: 7226, wallets: 1723, censusTotal: 25873, oldestIndexedAt: "2026-10-04T20:00:00Z", walletScores: new Map(),
  originalPixels: new Map([[1, 600], [2, 700], [3, 640], [4, 660]]), pixelSupply: new Map([[600, 400], [700, 400], [640, 400], [660, 400]]),
})
const rt = (id: number, customized = false): RarityToken => ({ id, rank: 4000, type: "Human", actionPoints: 0, awakenedAgent: false, fairValueEth: 0.29, customized })
const lst = (id: number, priceEth: number, customized = false): RawListing => ({ ...rt(id, customized), priceEth })
const deps = (over: Partial<Deps> = {}): Deps => ({
  resolveHolder: async () => ({ address: "0xabc", ens: null, tokenIds: [1, 3] }),
  fetchTokens: async (ids) => ids.map((i) => rt(i, i === 1)),
  fetchListings: async () => ({ items: [lst(2, 0.3, true), lst(4, 0.32)], floorEth: 0.286, total: 2 }),
  loadSnapshot: async () => snap(),
  now: () => new Date("2026-10-05T00:00:00Z"),
  ...over,
})

describe("end to end through the service and the page", () => {
  it("a wallet's edited Normie is KEEP with the reason; its unedited sibling is a burn candidate", async () => {
    const r = await buildBurnBuy({ wallet: "0xabc" }, deps())
    const byId = new Map(r.wallet!.advice.tokens.map((t) => [t.tokenId, t]))
    assert.equal(byId.get(1)!.verdict, "keep")
    assert.match(byId.get(1)!.reasons[0], EDITED)
    assert.equal(byId.get(3)!.verdict, "burn")
  })

  it("market lists never include the edited listing", async () => {
    const r = await buildBurnBuy({}, deps())
    const ids = [...r.market!.bestPixelFodder, ...r.market!.bestApCarriers].map((f) => f.tokenId)
    assert.ok(!ids.includes(2))
    assert.ok(ids.includes(4))
  })

  it("Jev is only ever asked about burn candidates, so never about an edited Normie", async () => {
    let sent: number[] = []
    await buildBurnBuy({ wallet: "0xabc" }, deps({ marketState: () => "live", jevOpinions: async (t) => { sent = t.map((x) => x.tokenId); return { opinions: {} } } }))
    assert.deepEqual(sent, [3])
  })

  it("the page: KEEP in every goal, with the edited-art reason shown", async () => {
    const r = await buildBurnBuy({ wallet: "0xabc" }, deps())
    for (const g of ["share", "arena", "art"] as const) {
      const row = buildPageModel(r, g).rows.find((x) => x.tokenId === 1)!
      assert.equal(row.verdict, "keep", g)
      assert.equal(row.label, "KEEP", g)
      assert.match(row.reasons.join(" "), EDITED, g)
    }
  })

  it("a wallet whose only Normies are all edited has nothing to burn", async () => {
    const r = await buildBurnBuy({ wallet: "0xabc" }, deps({ resolveHolder: async () => ({ address: "0xabc", ens: null, tokenIds: [1, 3] }), fetchTokens: async (ids) => ids.map((i) => rt(i, true)) }))
    const m = buildPageModel(r, "share")
    assert.match(m.lines.join(" "), /Nothing here is a burn candidate: 2 to keep/)
    assert.ok(r.wallet!.advice.moves.every((mv) => mv.kind !== "burn-own"))
  })

  it("the Art notes say edited Normies are marked KEEP", () => {
    assert.match(buildPageModel(null, "art").goalNotes.join(" "), /marks every edited Normie KEEP/)
  })
})
