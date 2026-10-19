import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { test } from "node:test"

import { composeScore } from "./compose"
import { MIN_SHARED, myceliumLinks, myceliumSummary, nodeLayout, pixelLine, singingAt } from "./mycelium"
import { scoreEvents } from "./timeline"

function grid(n: number, seed: number): string {
  let s = ""
  let x = seed
  for (let i = 0; i < n * n; i++) {
    x = (x * 1103515245 + 12345) >>> 0
    s += x % 3 === 0 ? "1" : "0"
  }
  return s
}
const t = (type: string, value: string) => ({ trait_type: type, value })
const A = { tokenId: 7141, name: "Zulo", pixels: grid(40, 7141), traits: [t("Type", "Agent"), t("Age", "Young"), t("Eyes", "Shades"), t("Expression", "Neutral")] }
const B = { tokenId: 1, name: "One", pixels: grid(40, 1), traits: [t("Type", "Agent"), t("Age", "Young"), t("Eyes", "Round"), t("Expression", "Smile")] }
const C = { tokenId: 42, name: "FortyTwo", pixels: grid(40, 42), traits: [t("Type", "Cat"), t("Age", "Old"), t("Eyes", "Round"), t("Expression", "Neutral")] }

test("threads join pairs that share at least MIN_SHARED traits, and only those", () => {
  const links = myceliumLinks([A, B, C])
  assert.equal(MIN_SHARED, 2)
  // A–B share Type + Age; A–C share only Expression; B–C share only Eyes.
  assert.deepEqual(links, [{ a: 0, b: 1, shared: ["Type", "Age"] }])
})

test("trait matching ignores case and empty values; same input → same web", () => {
  const b2 = { ...B, traits: [t("type", "AGENT"), t("AGE", "young"), t("Accessory", ""), t("Gender", "")] }
  const a2 = { ...A, traits: [...A.traits, t("Accessory", ""), t("Gender", "")] }
  assert.deepEqual(myceliumLinks([a2, b2]), [{ a: 0, b: 1, shared: ["Type", "Age"] }])
  assert.deepEqual(myceliumLinks([A, B, C]), myceliumLinks([A, B, C]))
})

test("layout: lead in the centre, everyone on whole pixels inside the canvas", () => {
  for (const n of [1, 2, 5, 12]) {
    const pts = nodeLayout(n, 160, 64)
    assert.equal(pts.length, n)
    assert.deepEqual(pts[0], { x: 80, y: 32 })
    for (const p of pts) {
      assert.ok(Number.isInteger(p.x) && Number.isInteger(p.y))
      assert.ok(p.x >= 2 && p.x < 158 && p.y >= 2 && p.y < 62, JSON.stringify(p))
    }
  }
})

test("pixel lines are connected and include both ends", () => {
  for (const [p, q] of [[{ x: 0, y: 0 }, { x: 10, y: 3 }], [{ x: 5, y: 9 }, { x: 1, y: 0 }], [{ x: 3, y: 3 }, { x: 3, y: 3 }]] as const) {
    const line = pixelLine(p, q)
    assert.deepEqual(line[0], p)
    assert.deepEqual(line[line.length - 1], q)
    for (let i = 1; i < line.length; i++) {
      assert.ok(Math.abs(line[i].x - line[i - 1].x) <= 1 && Math.abs(line[i].y - line[i - 1].y) <= 1)
    }
  }
})

test("singingAt finds who has a note sounding, by room position", () => {
  const room = [A, B, C]
  const score = composeScore(room)
  const ev = scoreEvents(score)
  const ids = room.map((v) => v.tokenId)
  let everyone = new Set<number>()
  for (let s = 0; s < score.loopSeconds; s += 0.25) {
    const now = singingAt(score, ev, ids, s)
    for (const i of now) assert.ok(i >= 0 && i < room.length)
    everyone = new Set([...everyone, ...now])
  }
  assert.deepEqual([...everyone].sort(), [0, 1, 2])
  assert.equal(singingAt(score, ev, [999], 1).size, 0)
})

test("summary reads in plain words", () => {
  assert.match(myceliumSummary(3, myceliumLinks([A, B, C])), /3 Normies, 1 thread between/)
  assert.match(myceliumSummary(1, []), /One Normie/)
})

test("the mycelium uses traits only: no wallets, owners, delegates, Pulse or rank", () => {
  const src = fs.readFileSync(path.join(__dirname, "mycelium.ts"), "utf8").replace(/\/\/.*$/gm, "")
  assert.doesNotMatch(src, /0x|owner|delegate|holder|wallet|address|fetch\(|pulse_level|\btrust\b|\brank\b|agentOrder/i)
})

test("Play my Normies is read-only: no signature, transaction or approval hooks, no address in links", () => {
  const src = fs.readFileSync(path.join(__dirname, "../../components/symphony/play-mine.tsx"), "utf8")
  assert.doesNotMatch(src, /useSignMessage|useSignTypedData|signTypedData|useWriteContract|writeContract|useSendTransaction|sendTransaction|approve|setApprovalForAll/)
  assert.doesNotMatch(src, /symphonyPath\([^)]*address|replaceState\([^)]*address/)
})
