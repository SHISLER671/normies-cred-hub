import { describe, it } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

import { buildPageModel, SIMULATOR_BASE, simulatorUrl } from "./narrate"
import { walletScore } from "./score"
import { buildBurnBuy, type Deps, type MarketSnapshot, type RarityToken } from "./service"

// The normies.art revenue share simulator, read on 2026-10-04 (https://simulator.normies.art/). Its default volumes give a pool of
// 25 ETH a month, and "everyone else" is 27,970. Its own published table of ETH a month by holdings:
const OTHERS = 27970
const POOL_ETH = 25
const PIXELS = [0, 15, 100, 500, 1500]
const SIMULATOR_TABLE: Record<number, number[]> = {
  1: [0.00089, 0.0041, 0.0253, 0.1436, 0.5267],
  2: [0.0021, 0.0054, 0.0269, 0.1454, 0.5290],
  5: [0.0058, 0.0098, 0.0319, 0.1514, 0.5362],
  10: [0.0130, 0.0180, 0.0416, 0.1627, 0.5498],
  25: [0.0357, 0.0441, 0.0722, 0.1986, 0.5934],
}

describe("our scoring agrees with the normies.art simulator (cross-checked 2026-10-04)", () => {
  it("all 25 cells of its published table match walletScore, to the digits it prints", () => {
    let cells = 0
    for (const [n, row] of Object.entries(SIMULATOR_TABLE)) {
      row.forEach((theirs, i) => {
        const w = walletScore(Number(n), PIXELS[i])
        const ours = (POOL_ETH * w) / (OTHERS + w)
        const decimals = (String(theirs).split(".")[1] ?? "").length
        assert.ok(Math.abs(ours - theirs) <= 0.5 * 10 ** -decimals + 1e-12, `${n} Normies, ${PIXELS[i]} #PIXEL: simulator ${theirs}, ours ${ours.toFixed(5)}`)
        cells++
      })
    }
    assert.equal(cells, 25)
  })

  it("its worked default (3 Normies, 100 #PIXEL): weight 31.66, share 0.11%, 0.0283 ETH a month", () => {
    const w = walletScore(3, 100)
    assert.equal(w.toFixed(2), "31.66")
    assert.equal((100 * w / (OTHERS + w)).toFixed(2), "0.11")
    assert.equal((POOL_ETH * w / (OTHERS + w)).toFixed(4), "0.0283")
  })

  it("Ryan's wallet (1 Normie, 12 #PIXEL) loads in the simulator with weight 3.40, as ours", () => {
    assert.equal(walletScore(1, 12).toFixed(2), "3.40")
  })
})

describe("the link to the simulator", () => {
  it("opens it with the holder's own numbers (it reads ?normies= and ?pixels=) and puts no wallet in the URL", () => {
    assert.equal(simulatorUrl(1, 12), "https://simulator.normies.art/?normies=1&pixels=12")
    assert.equal(simulatorUrl(57, 604), "https://simulator.normies.art/?normies=57&pixels=604")
    assert.ok(!/0x|\.eth/i.test(simulatorUrl(5, 5)))
    assert.ok(simulatorUrl(5, 5).startsWith(SIMULATOR_BASE))
  })
  it("clamps nonsense to whole non-negative numbers", () => {
    assert.equal(simulatorUrl(-3, 2.9), "https://simulator.normies.art/?normies=0&pixels=2")
  })
})

const snap = (): MarketSnapshot => ({
  livingSupply: 7226, wallets: 1723, censusTotal: 25873, oldestIndexedAt: "2026-10-04T20:00:00Z", walletScores: new Map(),
  originalPixels: new Map([[1, 600], [3, 640]]), pixelSupply: new Map([[600, 400], [640, 400]]),
})
const rt = (id: number): RarityToken => ({ id, rank: 4000, type: "Human", actionPoints: id === 1 ? 12 : 0, awakenedAgent: false, fairValueEth: 0.29 })
const deps = (tokenIds: number[]): Deps => ({
  resolveHolder: async () => ({ address: "0xabc", ens: null, tokenIds }), fetchTokens: async (ids) => ids.map(rt),
  fetchListings: async () => ({ items: [], floorEth: 0.286, total: 0 }), loadSnapshot: async () => snap(), now: () => new Date("2026-10-05T00:00:00Z"),
})

describe("the page model", () => {
  it("share goal with Normies: the link carries held Normies and total #PIXEL", async () => {
    const m = buildPageModel(await buildBurnBuy({ wallet: "0xabc" }, deps([1, 3])), "share")
    assert.equal(m.simulatorUrl, "https://simulator.normies.art/?normies=2&pixels=12")
  })
  it("no link for Arena or Art (money is not their question), nor for an empty wallet", async () => {
    const r = await buildBurnBuy({ wallet: "0xabc" }, deps([1, 3]))
    assert.equal(buildPageModel(r, "arena").simulatorUrl, null)
    assert.equal(buildPageModel(r, "art").simulatorUrl, null)
    assert.equal(buildPageModel(await buildBurnBuy({ wallet: "0xabc" }, deps([])), "share").simulatorUrl, null)
    assert.equal(buildPageModel(null, "share").simulatorUrl, null)
  })
  it("the revenue-share notes say paid MONTHLY and that holdings are checked four random times a day", () => {
    const notes = buildPageModel(null, "share").goalNotes.join(" ")
    assert.match(notes, /paid out monthly, in rounds, and claimed on chain/)
    assert.match(notes, /four random blocks a day/)
    assert.match(notes, /half the month earns half/)
    assert.match(notes, /not what you will be paid/)
  })
  it("the share line says 'at today's holdings'", async () => {
    const m = buildPageModel(await buildBurnBuy({ wallet: "0xabc" }, deps([1, 3])), "share")
    assert.match(m.lines[0], /of the pool at today's holdings\.$/)
  })
})

describe("llms.txt points agents at the simulator", () => {
  it("names it, with the URL pattern, and says it is on normies.art", () => {
    const txt = fs.readFileSync(path.resolve(__dirname, "../../public/llms.txt"), "utf8")
    assert.match(txt, /https:\/\/simulator\.normies\.art\/\?normies=<N>&pixels=<M>/)
    assert.match(txt, /on normies\.art/)
  })
})
