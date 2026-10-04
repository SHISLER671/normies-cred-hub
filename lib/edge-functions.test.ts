import { describe, it } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"

const read = (p: string) => fs.readFileSync(p, "utf8")

describe("scheduled Supabase functions", () => {
  it("each plan.ts is a byte-for-byte copy of the tested planner in lib/", () => {
    assert.equal(read("supabase/functions/census-refresh/plan.ts"), read("lib/census-refresh.ts"))
    assert.equal(read("supabase/functions/owners-refresh/plan.ts"), read("lib/owners-refresh.ts"))
    assert.equal(read("supabase/functions/delegates-refresh/plan.ts"), read("lib/delegate-refresh.ts"))
  })
  it("the planners stay free of imports, so the copy runs in Deno unchanged", () => {
    for (const f of ["lib/census-refresh.ts", "lib/owners-refresh.ts", "lib/delegate-refresh.ts"]) assert.doesNotMatch(read(f), /^import /m, f)
  })
  it("both functions check the cron secret before doing anything and never print it", () => {
    for (const f of ["census-refresh", "owners-refresh", "delegates-refresh"]) {
      const src = read(`supabase/functions/${f}/index.ts`)
      assert.ok(src.indexOf("unauthorized") < src.indexOf("run(db, dry)"), `${f}: auth must come before the work`)
      assert.doesNotMatch(src, /console\.log/, `${f}: no logging of anything`)
      assert.match(src, /cron_secret/)
    }
  })
  it("neither function can write anything but the columns it owns", () => {
    const census = read("supabase/functions/census-refresh/index.ts")
    const owners = read("supabase/functions/owners-refresh/index.ts")
    assert.doesNotMatch(owners, /action_points: /)
    assert.doesNotMatch(census.replace(/mark burned[\s\S]*?\n/, ""), /owner: (?!null)/)
  })
})
