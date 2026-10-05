import { describe, it } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

const walk = (dir: string, out: string[] = []): string[] => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".next", ".git", "supabase"].includes(e.name)) continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\./.test(e.name)) out.push(p)
  }
  return out
}

describe("the service-role key stays on the server", () => {
  const files = [...walk("app"), ...walk("components"), ...walk("hooks"), ...walk("lib")]
  it("no client component or hook imports the database module", () => {
    const offenders = files.filter((f) => {
      const src = fs.readFileSync(f, "utf8")
      return /^["']use client["']/m.test(src.slice(0, 200)) && /lib\/db\/supabase/.test(src)
    })
    assert.deepEqual(offenders, [])
  })
  it("the service-role key is read from a server-only variable, never a NEXT_PUBLIC one", () => {
    for (const f of files) {
      const src = fs.readFileSync(f, "utf8")
      assert.doesNotMatch(src, /NEXT_PUBLIC_[A-Z_]*SERVICE_ROLE/, f)
    }
  })
  it("the floor, burn and workflow tables are only reached through the private client", () => {
    const src = fs.readFileSync("lib/db/supabase.ts", "utf8")
    for (const fn of ["saveFloorPrice", "getHistoricalFloor", "getBurnOpportunities", "saveBurnOpportunity", "logWorkflowRun"]) {
      const body = src.slice(src.indexOf("export async function " + fn), src.indexOf("export async function " + fn) + 700)
      assert.match(body, /getPrivateDb\(\)/, fn)
      assert.doesNotMatch(body.split(".from(")[0], /getSupabase\(\)/, fn)
    }
  })
})
