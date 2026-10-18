import assert from "node:assert/strict"
import { test } from "node:test"

import { pulseBeats } from "../pulse/beats"
import { cleanBitmap, faceSvg, svgDataUri, traceSvg } from "./og-art"

const BITS = "0".repeat(1599) + "1"

test("bitmap must be exactly 1,600 zeros and ones; whitespace is ignored", () => {
  assert.equal(cleanBitmap(BITS), BITS)
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
