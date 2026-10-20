import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { BASE_TRAIT_TYPES, loadNormieTraits, pickBaseTraits, traitType, traitsFromMetadata, traitsSourceLabel } from "./normie-traits"

// Captured from api.normies.art on 2026-10-20 (image and animation_url shortened). Zombie #2: /metadata says Zombie,
// /traits still has the pre-zombie Human traits, /normie/2/zombie says isZombie: true.
const META_2 = {
  name: "Normie #2",
  attributes: [
    { trait_type: "Type", value: "Zombie" },
    { trait_type: "Gender", value: "Male" },
    { trait_type: "Age", value: "Young" },
    { trait_type: "Hair Style", value: "Messy Hair" },
    { trait_type: "Facial Feature", value: "High Cheekbones" },
    { trait_type: "Eyes", value: "No Glasses" },
    { trait_type: "Expression", value: "Serious" },
    { trait_type: "Accessory", value: "No Accessories" },
    { display_type: "number", trait_type: "Level", value: 1 },
    { display_type: "number", trait_type: "Pixel Count", value: 1370 },
    { display_type: "number", trait_type: "Action Points", value: 0 },
    { trait_type: "Customized", value: "No" },
    { trait_type: "Canvas Size", value: "40x40" },
    { trait_type: "Blank Canvas", value: "No" },
  ],
  image: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0i...",
  animation_url: "data:text/html;base64,PGh0bWw+...",
}
const TRAITS_2 = {
  raw: "0x00010111070b0201",
  attributes: [
    { trait_type: "Type", value: "Human" },
    { trait_type: "Gender", value: "Female" },
    { trait_type: "Age", value: "Middle-Aged" },
    { trait_type: "Hair Style", value: "Stringy Hair" },
    { trait_type: "Facial Feature", value: "Handlebars" },
    { trait_type: "Eyes", value: "Square Glasses" },
    { trait_type: "Expression", value: "Serious" },
    { trait_type: "Accessory", value: "Fedora" },
  ],
}

function getter(map: Record<string, unknown>, calls: string[] = []) {
  return async (path: string) => {
    calls.push(path)
    if (!(path in map)) return null
    const v = map[path]
    if (v instanceof Error) throw v
    return v
  }
}

describe("Normie traits come from the official /metadata", () => {
  it("Zombie #2: /metadata Zombie beats /traits Human", async () => {
    const calls: string[] = []
    const t = await loadNormieTraits(2, getter({ "/normie/2/metadata": META_2, "/normie/2/traits": TRAITS_2 }, calls))
    assert.equal(traitType(t), "Zombie")
    assert.equal(t?.source, "metadata")
    assert.deepEqual(t?.attributes.find((a) => a.trait_type === "Gender")?.value, "Male")
    assert.deepEqual(calls, ["/normie/2/metadata"], "/traits is not read when /metadata works")
  })

  it("keeps only the 8 base traits, in order, and never the image", () => {
    const t = traitsFromMetadata(META_2)!
    assert.deepEqual(t.attributes.map((a) => a.trait_type), [...BASE_TRAIT_TYPES])
    assert.equal(JSON.stringify(t).includes("base64"), false)
    assert.equal(t.raw, "")
  })

  it("falls back to /traits only when /metadata fails, and marks it", async () => {
    for (const meta of [null, new Error("timeout"), { name: "x", attributes: [] }]) {
      const t = await loadNormieTraits(2, getter({ "/normie/2/metadata": meta, "/normie/2/traits": TRAITS_2 }))
      assert.equal(t?.source, "traits_fallback")
      assert.equal(traitType(t), "Human")
      assert.equal(t?.raw, "0x00010111070b0201")
    }
  })

  it("null when both fail", async () => {
    assert.equal(await loadNormieTraits(2, getter({})), null)
  })

  it("source labels name the endpoint and the fallback", () => {
    assert.equal(traitsSourceLabel(2, "metadata"), "GET /normie/2/metadata (attributes)")
    assert.match(traitsSourceLabel(2, "traits_fallback"), /\/traits \(fallback/)
  })

  it("ignores junk attributes", () => {
    assert.deepEqual(pickBaseTraits([{ trait_type: "Type" }, null, { trait_type: 5, value: "x" }, { trait_type: "Eyes", value: "Big Shades" }]), [
      { trait_type: "Eyes", value: "Big Shades" },
    ])
    assert.equal(traitsFromMetadata({ attributes: [{ trait_type: "Eyes", value: "Big Shades" }] }), null, "no Type: not usable")
  })
})
