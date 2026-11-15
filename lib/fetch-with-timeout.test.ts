// fetchJsonWithLimits: one deadline for headers and body, and a byte cap (audit 2026-11-16, Claude).
import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { fetchJsonWithLimits, ResponseTooLargeError } from "./fetch-with-timeout"

const URL_ = "https://api.normies.art/normie/7141/metadata"
const enc = new TextEncoder()

/** A fetch stub that returns `res` and records the signal it was given. */
function stub(res: Response | (() => Promise<Response>)) {
  const calls: Array<AbortSignal | null | undefined> = []
  const impl = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    calls.push(init?.signal)
    return typeof res === "function" ? res() : res
  }) as unknown as typeof fetch
  return { impl, calls }
}

/** A body that sends `first` and then never sends anything else. */
function stallingBody(first: string): ReadableStream<Uint8Array> {
  let sent = false
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (!sent) {
        sent = true
        controller.enqueue(enc.encode(first))
        return
      }
      return new Promise<void>(() => {})
    },
  })
}

/** A body that sends `n` chunks of `size` bytes, with no content-length. */
function bigBody(n: number, size: number): ReadableStream<Uint8Array> {
  let i = 0
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i++ >= n) return controller.close()
      controller.enqueue(new Uint8Array(size).fill(32))
    },
  })
}

describe("fetchJsonWithLimits", () => {
  it("reads and parses a normal JSON body, passing an abort signal to fetch", async () => {
    const { impl, calls } = stub(new Response(JSON.stringify({ name: "Normie #7141", attributes: [] }), { status: 200 }))
    const r = await fetchJsonWithLimits(URL_, {}, { fetchImpl: impl })
    assert.deepEqual(r, { ok: true, status: 200, data: { name: "Normie #7141", attributes: [] } })
    assert.ok(calls[0] instanceof AbortSignal)
  })

  it("a non-ok response returns its status and null data, without reading the body", async () => {
    const { impl } = stub(new Response(bigBody(10_000, 1024), { status: 404 }))
    const r = await fetchJsonWithLimits(URL_, {}, { fetchImpl: impl, maxBytes: 10 })
    assert.deepEqual(r, { ok: false, status: 404, data: null })
  })

  it("refuses a declared content-length over the cap before reading", async () => {
    const { impl } = stub(new Response("{}", { status: 200, headers: { "content-length": "5000" } }))
    await assert.rejects(fetchJsonWithLimits(URL_, {}, { fetchImpl: impl, maxBytes: 1000 }), ResponseTooLargeError)
  })

  it("stops reading a streamed body (no content-length) once it passes the cap", async () => {
    const { impl } = stub(new Response(bigBody(100, 1024), { status: 200 }))
    await assert.rejects(fetchJsonWithLimits(URL_, {}, { fetchImpl: impl, maxBytes: 4096 }), ResponseTooLargeError)
  })

  it("times out a body that starts and then stalls (the old fetchWithTimeout stopped its timer at the headers)", async () => {
    const { impl } = stub(new Response(stallingBody('{"name":'), { status: 200 }))
    const t0 = Date.now()
    await assert.rejects(fetchJsonWithLimits(URL_, {}, { fetchImpl: impl, timeoutMs: 50 }), (e: Error) => e.name === "AbortError")
    assert.ok(Date.now() - t0 < 2_000)
  })

  it("times out a fetch that never answers, even if it ignores the abort signal", async () => {
    const { impl } = stub(() => new Promise<Response>(() => {}))
    await assert.rejects(fetchJsonWithLimits(URL_, {}, { fetchImpl: impl, timeoutMs: 50 }), (e: Error) => e.name === "AbortError")
  })

  it("bad JSON throws a SyntaxError (callers fail closed)", async () => {
    const { impl } = stub(new Response("<html>not json</html>", { status: 200 }))
    await assert.rejects(fetchJsonWithLimits(URL_, {}, { fetchImpl: impl }), SyntaxError)
  })

  it("a body exactly at the cap is read", async () => {
    const body = JSON.stringify({ a: "x".repeat(20) })
    const { impl } = stub(new Response(body, { status: 200 }))
    const r = await fetchJsonWithLimits(URL_, {}, { fetchImpl: impl, maxBytes: enc.encode(body).byteLength })
    assert.equal(r.ok, true)
  })
})
