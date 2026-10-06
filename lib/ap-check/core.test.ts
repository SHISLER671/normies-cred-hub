import { describe, it } from "node:test"
import assert from "node:assert/strict"

import { apiDisagrees, judgeAp, judgeListing, parseItemOffers, parsePixelSplit, parseShownPixels, parseTokenInput, type ApReading, type ListingInput } from "./core"

const NORMIES = "0x9eb6e2025b64f340691e424b7fe7022ffde12438"
const MAKER = "0x1111111111111111111111111111111111111111"
const hash = (n: number) => "0x" + n.toString(16).padStart(64, "0")

// Shaped after OpenSea API v2 OffersResponse / Offer (openapi.json, read 2026-10-06): price { currency, decimals, value },
// protocol_data.parameters { offerer, endTime, consideration[] }, optional asset { contract, identifier }, optional criteria.
const offer = (n: number, over: Record<string, unknown> = {}) => ({
  order_hash: hash(n),
  chain: "ethereum",
  status: "ACTIVE",
  remaining_quantity: 1,
  asset: { contract: NORMIES, identifier: String(n) },
  price: { currency: "WETH", decimals: 18, value: "700000000000000000" },
  protocol_data: { parameters: { offerer: MAKER, endTime: "1798761600", consideration: [] } },
  ...over,
})

describe("parseTokenInput", () => {
  it("accepts a plain id, #id, 'Normie id' and links ending in the id", () => {
    assert.equal(parseTokenInput("7141"), 7141)
    assert.equal(parseTokenInput(" #7141 "), 7141)
    assert.equal(parseTokenInput("Normie #42"), 42)
    assert.equal(parseTokenInput("0"), 0)
    assert.equal(parseTokenInput(`https://opensea.io/item/ethereum/${NORMIES}/7141`), 7141)
    assert.equal(parseTokenInput("https://www.normies.art/normie/9999?tab=art"), 9999)
  })
  it("rejects anything that is not one id from 0 to 9999", () => {
    for (const bad of ["", "10000", "-1", "71.41", "abc", "0x9eb6e2025b64f340691e424b7fe7022ffde12438", "https://opensea.io/collection/normies", null, undefined]) {
      assert.equal(parseTokenInput(bad as string), null, String(bad))
    }
  })
})

describe("parsePixelSplit", () => {
  it("reads the documented shape for the token asked about", () => {
    const raw = { tokenId: 7141, attached: 12, locked: 0, free: 12, level: 2, gridSize: 40 }
    assert.deepEqual(parsePixelSplit(raw, 7141), { attached: 12, locked: 0, free: 12 })
  })
  it("refuses another token's answer or a malformed body", () => {
    assert.equal(parsePixelSplit({ tokenId: 1, attached: 12, locked: 0, free: 12 }, 7141), null)
    assert.equal(parsePixelSplit({ tokenId: 7141, attached: "12", locked: 0, free: 12 }, 7141), null)
    assert.equal(parsePixelSplit({ tokenId: 7141, attached: -1, locked: 0, free: 12 }, 7141), null)
    assert.equal(parsePixelSplit(null, 7141), null)
  })
})

describe("judgeAp", () => {
  const r = (over: Partial<ApReading>): ApReading => ({ tokenId: 7141, onchain: 12, split: null, census: null, ...over })
  it("has AP: no risk", () => {
    const j = judgeAp(r({}))
    assert.equal(j.verdict, "has-ap")
    assert.equal(j.offerRisk, false)
    assert.match(j.line, /12 AP/)
  })
  it("no AP at all: risky for offers", () => {
    const j = judgeAp(r({ onchain: 0, census: { ap: 0, burned: false, at: null } }))
    assert.equal(j.verdict, "no-ap")
    assert.equal(j.offerRisk, true)
  })
  it("AP removed since the census: says what it was", () => {
    const j = judgeAp(r({ onchain: 0, census: { ap: 300, burned: false, at: "2026-10-06T06:01:00Z" } }))
    assert.equal(j.verdict, "dropped")
    assert.equal(j.offerRisk, true)
    assert.match(j.line, /300 at our last census \(2026-10-06 06:01 UTC\), 0 now/)
  })
  it("AP only partly removed still counts as dropped", () => {
    assert.equal(judgeAp(r({ onchain: 5, census: { ap: 12, burned: false, at: null } })).verdict, "dropped")
  })
  it("more AP than the census is fine (burned for more)", () => {
    assert.equal(judgeAp(r({ onchain: 20, census: { ap: 12, burned: false, at: null } })).verdict, "has-ap")
  })
  it("a failed chain read is unknown, never zero", () => {
    const j = judgeAp(r({ onchain: null, census: { ap: 12, burned: false, at: null } }))
    assert.equal(j.verdict, "unknown")
    assert.equal(j.offerRisk, false)
  })
  it("a burned Normie is flagged", () => {
    assert.equal(judgeAp(r({ onchain: 0, census: { ap: 0, burned: true, at: null } })).verdict, "burned")
  })
  it("notices when the API lags the chain", () => {
    assert.equal(apiDisagrees(r({ onchain: 0, split: { attached: 12, locked: 0, free: 12 } })), true)
    assert.equal(apiDisagrees(r({ onchain: 12, split: { attached: 12, locked: 0, free: 12 } })), false)
  })
})

describe("parseItemOffers", () => {
  it("keeps ACTIVE WETH item offers on Normies, highest first, with maker and expiry", () => {
    const p = parseItemOffers({ offers: [offer(1, { price: { currency: "WETH", decimals: 18, value: "100000000000000000" } }), offer(7141)], next: "abc" })
    assert.ok(p)
    assert.equal(p.next, "abc")
    assert.deepEqual(p.offers.map((o) => [o.tokenId, o.price]), [[7141, 0.7], [1, 0.1]])
    assert.equal(p.offers[0].maker, MAKER)
    assert.equal(p.offers[0].expiresAt, "2027-01-01T00:00:00.000Z")
  })
  it("finds the token in the consideration when there is no asset block", () => {
    const o = offer(42, { asset: null, protocol_data: { parameters: { offerer: MAKER, endTime: "1798761600", consideration: [{ itemType: 2, token: NORMIES, identifierOrCriteria: "42", startAmount: "1", endAmount: "1", recipient: MAKER }] } } })
    assert.deepEqual(parseItemOffers({ offers: [o] })?.offers.map((x) => x.tokenId), [42])
  })
  it("counts criteria (collection / trait) offers instead of listing them", () => {
    const c = offer(9, { asset: null, criteria: { collection: { slug: "normies" } } })
    const p = parseItemOffers({ offers: [c, offer(3)] })
    assert.equal(p?.criteria, 1)
    assert.deepEqual(p?.offers.map((x) => x.tokenId), [3])
  })
  it("drops inactive, filled, other-contract, other-currency, bad-maker and duplicate offers", () => {
    const p = parseItemOffers({
      offers: [
        offer(1, { status: "CANCELLED" }),
        offer(2, { remaining_quantity: 0 }),
        offer(3, { asset: { contract: "0x2222222222222222222222222222222222222222", identifier: "3" } }),
        offer(4, { price: { currency: "USDC", decimals: 6, value: "1000000" } }),
        offer(5, { protocol_data: { parameters: { offerer: "nope", endTime: "1798761600", consideration: [] } } }),
        offer(6),
        offer(6),
      ],
    })
    assert.deepEqual(p?.offers.map((x) => x.tokenId), [6])
  })
  it("a body that is not the documented shape is null", () => {
    assert.equal(parseItemOffers({ orders: [] }), null)
    assert.equal(parseItemOffers(null), null)
  })
})

// Shaped after OpenSea API v2 NftBatchResponse { nfts: NftDetailed[] } / NftResponse { nft } (openapi.json, read 2026-10-06).
const nft = (id: number, traits: unknown[]) => ({ identifier: String(id), contract: NORMIES, collection: "normies", traits })

describe("parseShownPixels", () => {
  it("reads 'Action Points' as a number or a numeric string, from a batch or a single NFT", () => {
    const m = parseShownPixels({ nfts: [nft(1, [{ trait_type: "Action Points", value: 300 }]), nft(2, [{ trait_type: "Action Points", value: "12" }])] })
    assert.deepEqual([...(m ?? [])], [[1, 300], [2, 12]])
    assert.deepEqual([...(parseShownPixels({ nft: nft(7141, [{ trait_type: "Action Points", value: 12 }]) }) ?? [])], [[7141, 12]])
  })
  it("a Normie without the trait is null (OpenSea shows none), never 0", () => {
    assert.deepEqual([...(parseShownPixels({ nfts: [nft(5, [{ trait_type: "Level", value: 2 }])] }) ?? [])], [[5, null]])
  })
  it("ignores other contracts and refuses a body of the wrong shape", () => {
    const other = { identifier: "1", contract: "0x2222222222222222222222222222222222222222", traits: [{ trait_type: "Action Points", value: 9 }] }
    assert.equal(parseShownPixels({ nfts: [other] })?.size, 0)
    assert.equal(parseShownPixels({ items: [] }), null)
    assert.equal(parseShownPixels(null), null)
  })
})

describe("judgeListing", () => {
  const l = (over: Partial<ListingInput>): ListingInput => ({ tokenId: 9, priceEth: 0.3, live: 300, shown: 300, census: { ap: 300, burned: false, at: null }, ...over })
  it("matching numbers: no flag", () => {
    assert.equal(judgeListing(l({})), null)
  })
  it("OpenSea shows more than the chain: stale", () => {
    const f = judgeListing(l({ live: 0, census: { ap: 0, burned: false, at: null } }))
    assert.equal(f?.kind, "stale")
    assert.match(f?.line ?? "", /OpenSea still shows 300 pixels; it has 0 now/)
  })
  it("census had more than the chain: dropped (even if OpenSea already caught up)", () => {
    assert.equal(judgeListing(l({ live: 0, shown: 0 }))?.kind, "dropped")
  })
  it("both at once", () => {
    assert.equal(judgeListing(l({ live: 10 }))?.kind, "both")
  })
  it("never flags on a failed chain read, a burned token, or more pixels than shown", () => {
    assert.equal(judgeListing(l({ live: null })), null)
    assert.equal(judgeListing(l({ live: 0, census: { ap: 300, burned: true, at: null } })), null)
    assert.equal(judgeListing(l({ live: 400 })), null)
    assert.equal(judgeListing(l({ live: 300, shown: null })), null)
  })
})
