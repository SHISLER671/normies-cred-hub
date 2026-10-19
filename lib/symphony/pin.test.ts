import assert from "node:assert/strict"
import { test } from "node:test"

import { MAX_ROOM, parseBlock, parseIds, pickVersionAtBlock, readVersions, symphonyPath, symphonyShareText } from "./pin"

test("ids: order kept, duplicates and out-of-range dropped, capped", () => {
  assert.deepEqual(parseIds("7141, 1 42;7141 10000 -3 0099"), [7141, 1, 42, 99])
  assert.deepEqual(parseIds("7141,42,1"), [7141, 42, 1])
  assert.deepEqual(parseIds(null), [])
  assert.equal(parseIds(Array.from({ length: 30 }, (_, i) => i).join(",")).length, MAX_ROOM)
})

test("block: positive integers only", () => {
  assert.equal(parseBlock("21034567"), 21034567)
  for (const bad of ["0", "-1", "1e9", "abc", "", null, "12345678901"]) assert.equal(parseBlock(bad), null)
})

test("versions: accepts array or {versions}, any block spelling, skips junk", () => {
  assert.deepEqual(readVersions([{ version: 2, blockNumber: 20 }, { version: 1, block: 10 }, { version: "x", block: 5 }]), [
    { version: 1, block: 10 },
    { version: 2, block: 20 },
  ])
  assert.deepEqual(readVersions({ versions: [{ version: 3, block_number: "30" }] }), [{ version: 3, block: 30 }])
  assert.deepEqual(readVersions("nope"), [])
})

test("block → version: newest at or before the block; none → original", () => {
  const v = [{ version: 1, block: 10 }, { version: 2, block: 20 }, { version: 3, block: 30 }]
  assert.equal(pickVersionAtBlock(v, 25)?.version, 2)
  assert.equal(pickVersionAtBlock(v, 30)?.version, 3)
  assert.equal(pickVersionAtBlock(v, 9), null)
})

test("share path and text", () => {
  assert.equal(symphonyPath([7141, 1], 21000000), "/symphony?ids=7141,1&block=21000000")
  assert.equal(symphonyPath([], null), "/symphony")
  assert.match(symphonyShareText(["Zulo"], 5), /^🔲🔳 Zulo singing .*block 5.*@normiesART$/)
  assert.match(symphonyShareText(["Zulo", "A", "B"], null), /Zulo \+ 2 Normies/)
})
