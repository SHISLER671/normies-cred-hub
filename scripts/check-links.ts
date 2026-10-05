/**
 * Check every outbound normies.art link the site uses (burn page, header, Ask knowledge) and EVERY url in the two curated tool lists.
 *
 *   npx tsx scripts/check-links.ts          # prints status per URL, exits 1 if any is broken
 *
 * Run it before and after a launch of the official website: @serc1n said the Normies site is new as of 2026-10-05, so deep links may move.
 * Read-only: one GET per distinct URL, polite spacing.
 */
import fs from "fs"
import path from "path"

const ROOTS = ["app", "components", "lib", "public"]
const SKIP = new Set(["node_modules", ".next", ".git"])
const URL_RE = /https?:\/\/[a-z0-9.-]*normies\.art[^\s"'`<>)\\]*/gi

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (/\.(ts|tsx|md|txt|json)$/.test(e.name) && !/\.test\./.test(e.name)) out.push(p)
  }
  return out
}

// The two curated tool lists (the Tools modal and the community tool catalog Ask recommends from): check EVERY host in them, not only normies.art.
const TOOL_LISTS = ["lib/tools.ts", "lib/agent-recommendations/communityTools.ts"]
const ANY_URL_RE = /https?:\/\/[a-z0-9.-]+\.[a-z]{2,}[^\s"'`<>)\\]*/gi
const found = new Map<string, string>()
for (const f of TOOL_LISTS) {
  if (!fs.existsSync(f)) continue
  for (const m of fs.readFileSync(f, "utf8").matchAll(ANY_URL_RE)) {
    const url = m[0].replace(/[.,;:]+$/, "")
    if (!/[${}]/.test(url) && !found.has(url)) found.set(url, f)
  }
}
for (const root of ROOTS) {
  if (!fs.existsSync(root)) continue
  for (const f of walk(root)) {
    for (const m of fs.readFileSync(f, "utf8").matchAll(URL_RE)) {
      const url = m[0]
        .replace(/\$\{[^}]*tokenId[^}]*\}/g, "7141")
        .replace(/\$\{[^}]*agentId[^}]*\}/g, "32626")
        .replace(/\{tokenId\}/g, "7141")
        .replace(/[.,;:]+$/, "")
      if (/[${}]/.test(url)) continue // still templated: not checkable
      if (!found.has(url)) found.set(url, f)
    }
  }
}

// Not pages: base paths that are only prefixes for real endpoints (api.normies.art/rarity/... exists, /rarity alone is a 404 by design).
const NOT_A_PAGE = new Set(["https://api.normies.art/rarity"])

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
async function main() {
  let bad = 0
  for (const [url, file] of [...found].sort()) {
    if (NOT_A_PAGE.has(url)) continue
    let status = "ERR"
    let final = ""
    try {
      const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(15_000), headers: { "User-Agent": "NCH-link-check/1.0 (read-only)" } })
      status = String(res.status)
      if (res.url !== url) final = ` -> ${res.url}`
    } catch (e) {
      status = "ERR " + String(e).slice(0, 40)
    }
    const ok = /^[23]/.test(status)
    if (!ok) bad++
    console.log(`${ok ? "ok  " : "FAIL"} ${status.padEnd(8)} ${url}${final}   (${file})`)
    await sleep(400)
  }
  console.log(`\n${found.size} distinct links, ${bad} broken`)
  process.exit(bad ? 1 : 0)
}
main()
