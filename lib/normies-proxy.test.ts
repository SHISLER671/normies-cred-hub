import assert from "node:assert/strict"
import { test } from "node:test"

import { resolveUpstream } from "./normies-proxy"

const B = "https://api.normies.art"

test("the proxy forwards only the routes the app uses", () => {
  assert.equal(resolveUpstream(["7141", "traits"]), `${B}/normie/7141/traits`)
  assert.equal(resolveUpstream(["7141", "canvas", "info"]), `${B}/normie/7141/canvas/info`)
  assert.equal(resolveUpstream(["0042", "owner"]), `${B}/normie/42/owner`)
  assert.equal(resolveUpstream(["7141", "agent"]), `${B}/agents/info/7141`)
  assert.equal(resolveUpstream(["agents", "binding", "7141"]), `${B}/agents/binding/7141`)
  assert.equal(resolveUpstream(["agents", "identity", "1"]), `${B}/agents/identity/1`)
  const addr = "0x1234567890abcdef1234567890ABCDEF12345678"
  assert.equal(resolveUpstream(["holders", addr]), `${B}/holders/${addr}`)
})

test("everything else is refused: traversal, encoded queries, other upstream paths, bad ids", () => {
  for (const segs of [
    [],
    ["7141"],
    ["7141", "..", "..", "v2", "admin"],
    ["..", "admin"],
    ["7141", "traits?x=1"],
    ["7141", "image.svg"],
    ["7141", "canvas", "pixels"],
    ["10000", "traits"],
    ["7141abc", "traits"],
    ["holders", "vitalik.eth"],
    ["holders", "0x123"],
    ["agents", "binding", "batch"],
    ["agents", "info", "7141"],
    ["history", "normie", "1", "versions"],
  ]) {
    assert.equal(resolveUpstream(segs), null, segs.join("/"))
  }
})
