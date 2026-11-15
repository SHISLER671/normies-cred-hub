import assert from "node:assert/strict"
import { test } from "node:test"

import { isMetadataUpstream, MAX_METADATA_ATTRIBUTES, resolveUpstream, trimMetadata } from "./normies-proxy"

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

// Audit 2026-11-16 (Claude): /metadata reaches the browser as name + attributes only.
test("/metadata is trimmed to name and well-formed attributes; image and animation_url never pass", () => {
  const out = trimMetadata({
    name: "Normie #2",
    description: "x",
    image: "data:image/svg+xml;base64,PHN2Zz4=",
    animation_url: "data:text/html;base64,PHNjcmlwdD4=",
    external_url: "https://example.com",
    attributes: [
      { trait_type: "Type", value: "Zombie" },
      { display_type: "number", trait_type: "Level", value: 1 },
      null,
      { trait_type: "Bad", value: { nested: true } },
      { trait_type: "NaN", value: Number.NaN },
      { value: "no type" },
    ],
  })
  assert.deepEqual(out, {
    name: "Normie #2",
    attributes: [
      { trait_type: "Type", value: "Zombie" },
      { trait_type: "Level", value: 1, display_type: "number" },
    ],
  })
  assert.equal(JSON.stringify(out).includes("data:"), false)
})

test("trimMetadata never throws on junk and caps the attribute count", () => {
  for (const junk of [null, undefined, "x", 5, [], { attributes: "Type" }, { name: 7 }]) {
    assert.deepEqual(trimMetadata(junk), { attributes: [] })
  }
  const many = { attributes: Array.from({ length: 500 }, (_, i) => ({ trait_type: `T${i}`, value: i })) }
  assert.equal(trimMetadata(many).attributes.length, MAX_METADATA_ATTRIBUTES)
})

test("only the /metadata upstream is trimmed", () => {
  assert.equal(isMetadataUpstream(resolveUpstream(["7141", "metadata"])!), true)
  for (const segs of [["7141", "traits"], ["7141", "owner"], ["7141", "agent"], ["agents", "binding", "7141"]]) {
    assert.equal(isMetadataUpstream(resolveUpstream(segs)!), false, segs.join("/"))
  }
})
