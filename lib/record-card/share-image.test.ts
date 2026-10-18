import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { test } from "node:test"

import { PIXEL_EMOJI, recordCardImageFilename, recordCardImagePath, recordShareXText } from "./share-image"

test("download points at the same-origin share image route", () => {
  assert.equal(recordCardImagePath(7141), "/record/7141/opengraph-image")
  assert.equal(recordCardImagePath(0), "/record/0/opengraph-image")
  assert.ok(fs.existsSync(path.join(__dirname, "../../app/record/[tokenId]/opengraph-image.tsx")), "OG image route moved")
})

test("filename carries only the token id", () => {
  assert.equal(recordCardImageFilename(7141), "normie-7141-record-card.png")
  assert.match(recordCardImageFilename(9999), /^normie-\d{1,4}-record-card\.png$/)
})

test("bad ids are refused, never turned into a card for another Normie", () => {
  for (const bad of [-1, 10000, 1.5, Number.NaN]) {
    assert.throws(() => recordCardImagePath(bad), RangeError)
    assert.throws(() => recordCardImageFilename(bad), RangeError)
  }
})

test("the share component never puts a wallet or ENS into a link", () => {
  // Code only: the doc comment may say "no wallet".
  const src = fs
    .readFileSync(path.join(__dirname, "../../components/record-share.tsx"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
  assert.doesNotMatch(src, /\b(owner|address|wallet|ens|delegate)\b/i)
})

test("Post on X text: pixel squares first, official tag last, same shape for every Normie", () => {
  assert.equal(PIXEL_EMOJI, "\u{1F532}\u{1F533}")
  assert.equal(
    recordShareXText("Zulo", 7141),
    "🔲🔳 Zulo's record card on NCH: verified identity and trust gate. A track record, not a tip. @normiesART",
  )
  assert.equal(
    recordShareXText(null, 42),
    "🔲🔳 Normie #42's record card on NCH: verified identity and trust gate. A track record, not a tip. @normiesART",
  )
  assert.equal(recordShareXText("  ", 42), recordShareXText(undefined, 42))
})

test("the phone share sheet and Post on X use the same builder, with the url as its own field", () => {
  const src = fs.readFileSync(path.join(__dirname, "../../components/record-share.tsx"), "utf8")
  assert.match(src, /const text = recordShareXText\(name, tokenId\)/)
  assert.match(src, /navigator\.share\(\{.*\btext, url \}\)/)
  assert.match(src, /intent\/post\?text=\$\{encodeURIComponent\(text\)\}&url=/)
  assert.doesNotMatch(src, /record card on NCH/, "share text must come only from recordShareXText")
})
