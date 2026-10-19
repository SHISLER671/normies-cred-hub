import assert from "node:assert/strict"
import { test } from "node:test"

import { pulseBeats } from "../pulse/beats"
import { cleanBitmap, faceSvg, svgDataUri, traceSvg } from "./og-art"

const BITS = "0".repeat(1599) + "1"

test("bitmap must be a Normie-sized square of zeros and ones (40 at mint, 50–80 enlarged); whitespace is ignored", () => {
  assert.equal(cleanBitmap(BITS), BITS)
  for (const n of [50, 60, 70, 80]) assert.equal(cleanBitmap("0".repeat(n * n)), "0".repeat(n * n))
  assert.equal(cleanBitmap("0".repeat(45 * 45)), null)
  assert.equal(cleanBitmap("0".repeat(256 * 256)), null)
  assert.equal(cleanBitmap(BITS.slice(0, 40) + "\n" + BITS.slice(40)), BITS)
  assert.equal(cleanBitmap("0101"), null)
  assert.equal(cleanBitmap(null), null)
  assert.equal(cleanBitmap("<html>404</html>"), null)
})

test("face draws one ink square per 1, at row-major position", () => {
  const svg = faceSvg(BITS)
  assert.match(svg, /viewBox="0 0 40 40"/)
  assert.match(svg, /M39 39h1v1h-1z/)
  assert.equal((svg.match(/h1v1h-1z/g) ?? []).length, 1)
})

test("an enlarged face keeps its own grid size", () => {
  const svg = faceSvg("0".repeat(80 * 80 - 1) + "1")
  assert.match(svg, /viewBox="0 0 80 80"/)
  assert.match(svg, /M79 79h1v1h-1z/)
})

test("trace draws lit beats in the lit colour and missing ones in the dim colour", () => {
  const svg = traceSvg(pulseBeats(["ERC-8004 registered"]), "#fff", "#555")
  const [dim, lit] = [...svg.matchAll(/<path d="([^"]*)" fill="([^"]+)"/g)]
  assert.equal(dim[2], "#555")
  assert.equal(lit[2], "#fff")
  assert.ok(lit[1].length > 0 && dim[1].length > 0)
})

test("data URI is base64 SVG", () => {
  const uri = svgDataUri("<svg/>")
  assert.ok(uri.startsWith("data:image/svg+xml;base64,"))
  assert.equal(Buffer.from(uri.split(",")[1], "base64").toString("utf8"), "<svg/>")
})
