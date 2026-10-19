import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { test } from "node:test"

import { MAX_ROOM, checkIds, parseIds, symphonyPath } from "./pin"

const root = path.join(__dirname, "../..")
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8")

test("typed ids: good list", () => {
  assert.deepEqual(checkIds("7141, 42, 1"), { ids: [7141, 42, 1], hint: "" })
})
test("typed ids: spaces and odd separators", () => {
  assert.deepEqual(checkIds("  7141   42\n1 ; 0 ").ids, [7141, 42, 1, 0])
  assert.equal(checkIds("  7141   42 ").hint, "")
})
test("typed ids: duplicates skipped with a hint", () => {
  const r = checkIds("7141, 7141, 42")
  assert.deepEqual(r.ids, [7141, 42])
  assert.match(r.hint, /repeats/)
})
test("typed ids: out of range", () => {
  const r = checkIds("10000, 42, 99999999999")
  assert.deepEqual(r.ids, [42])
  assert.match(r.hint, /0 to 9999/)
})
test("typed ids: over the cap", () => {
  const r = checkIds(Array.from({ length: 15 }, (_, i) => i).join(","))
  assert.equal(r.ids.length, MAX_ROOM)
  assert.match(r.hint, new RegExp(`cap of ${MAX_ROOM}`))
})
test("typed ids: junk and empty never throw", () => {
  for (const bad of ["", "   ", "abc", "-5", "1.5", "0x1234", "<script>", null, undefined, "💥"]) {
    const r = checkIds(bad as string)
    assert.deepEqual(r.ids, [])
    assert.ok(r.hint.length > 0)
  }
  assert.deepEqual(checkIds("abc, 42").ids, [42])
})
test("an address never goes into a Symphony link", () => {
  const addr = "0x1234567890abcdef1234567890ABCDEF12345678"
  assert.deepEqual(checkIds(addr).ids, [])
  assert.doesNotMatch(symphonyPath(checkIds(`${addr}, 42`).ids, null), /0x|abcdef/i)
  for (const f of ["components/symphony/play-mine.tsx", "components/symphony/player.tsx"]) {
    const src = read(f)
    assert.doesNotMatch(src, /(symphonyPath|replaceState|pushState|router\.(push|replace)|localStorage|sessionStorage|console\.\w+)\([^)]*address/, f)
  }
})
test("wallet connection is site-wide and persists (one WagmiProvider in the root layout, wagmi's own storage)", () => {
  assert.match(read("app/layout.tsx"), /<Providers>/)
  assert.match(read("app/providers.tsx"), /<WagmiProvider config=\{wagmiConfig\}/)
  assert.doesNotMatch(read("app/symphony/page.tsx"), /WagmiProvider|Providers/)
  const cfg = read("lib/wagmi.ts")
  assert.doesNotMatch(cfg, /reconnectOnMount:\s*false|storage:\s*null/)
})
test("one parser: parseIds is exactly checkIds().ids, and share links parse the same", () => {
  for (const s of ["7141,42,1", "7141, 42, 1", "1.5", "-5", "7141 7141 42", "10000,3", "abc,42", "", null]) {
    assert.deepEqual(parseIds(s as string), checkIds(s as string).ids, String(s))
  }
  assert.deepEqual(parseIds("7141,42,1"), [7141, 42, 1])
})
test("'1.5' is not split into #1 and #5; it gets a separator hint", () => {
  const r = checkIds("1.5")
  assert.deepEqual(r.ids, [])
  assert.match(r.hint, /commas or spaces/)
  const m = checkIds("1.5, 42")
  assert.deepEqual(m.ids, [42])
  assert.match(m.hint, /commas or spaces/)
  assert.match(checkIds("abc, 42").hint, /couldn't read some entries/)
})
test("one typed-id box: play-mine has no input; the main # box uses checkIds", () => {
  const mine = read("components/symphony/play-mine.tsx")
  assert.doesNotMatch(mine, /<input|<form|Play these|checkIds\(/)
  const player = read("components/symphony/player.tsx")
  assert.match(player, /checkIds\(raw\)/)
  assert.doesNotMatch(player, /parseIds/)
  assert.doesNotMatch(read("app/symphony/symphony.css").split("Phase 1")[1] ?? "", /cyan/)
})
