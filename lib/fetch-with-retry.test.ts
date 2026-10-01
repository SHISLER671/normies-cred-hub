import { describe, it } from "node:test"
import assert from "node:assert/strict"

import { fetchWithRetry } from "./fetch-with-retry"

const res = (status: number, headers: Record<string, string> = {}) => new Response("{}", { status, headers })
const run = (responses: Array<Response | Error>, attempts = 3) => {
  const waits: number[] = []
  let calls = 0
  const fetcher = async () => {
    const r = responses[calls++]
    if (r instanceof Error) throw r
    return r
  }
  const p = fetchWithRetry("https://x", {}, 1000, { attempts, fetcher, sleep: async (ms) => { waits.push(ms) } })
  return { p, waits, calls: () => calls }
}

describe("fetchWithRetry", () => {
  it("returns a 200 at once with no wait", async () => {
    const t = run([res(200)])
    assert.equal((await t.p).status, 200)
    assert.equal(t.calls(), 1)
    assert.deepEqual(t.waits, [])
  })

  it("retries a 429 and succeeds", async () => {
    const t = run([res(429), res(200)])
    assert.equal((await t.p).status, 200)
    assert.equal(t.calls(), 2)
  })

  it("honours Retry-After, capped at 2s", async () => {
    const t = run([res(429, { "retry-after": "30" }), res(200)])
    await t.p
    assert.deepEqual(t.waits, [2000])
  })

  it("retries network errors, then succeeds", async () => {
    const t = run([new Error("boom"), res(200)])
    assert.equal((await t.p).status, 200)
  })

  it("does not retry a 404", async () => {
    const t = run([res(404), res(200)])
    assert.equal((await t.p).status, 404)
    assert.equal(t.calls(), 1)
  })

  it("returns the last bad response when retries run out", async () => {
    const t = run([res(429), res(429), res(429)])
    assert.equal((await t.p).status, 429)
    assert.equal(t.calls(), 3)
  })

  it("throws when the last attempt fails at the network level", async () => {
    const t = run([res(429), res(429), new Error("down")])
    await assert.rejects(t.p, /down/)
  })
})
