/**
 * fetch() wrapper that aborts after `timeoutMs` so upstream calls (Venice,
 * Normies, Ethos, OpenRouter) can never hang a serverless function until the
 * platform kills it. Throws a normal AbortError on timeout — callers should
 * catch and translate to a 504/502.
 */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 10_000,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

/** True when an error is the AbortError thrown by fetchWithTimeout on timeout. */
export function isTimeoutError(err: unknown): boolean {
  return err instanceof Error && err.name === "AbortError"
}

/** Thrown by fetchJsonWithLimits when a body is bigger than its byte cap. */
export class ResponseTooLargeError extends Error {
  constructor(maxBytes: number) {
    super(`response larger than ${maxBytes} bytes`)
    this.name = "ResponseTooLargeError"
  }
}

/** Default cap for JSON from the Normies API. /metadata is about 5 KB; /holders for a big wallet stays well under this. */
export const DEFAULT_JSON_MAX_BYTES = 1_000_000

export interface LimitedJsonOptions {
  /** One deadline for the whole call: headers AND body. */
  timeoutMs?: number
  /** Most body bytes read before giving up. */
  maxBytes?: number
  /** Injected in tests. */
  fetchImpl?: typeof fetch
}

export interface LimitedJson {
  ok: boolean
  status: number
  /** Parsed body when ok; null otherwise (a non-ok body is never read). */
  data: unknown
  /** The `Retry-After` header of a non-ok response, when the server sent one (for polite backoff). */
  retryAfter?: string
}

/**
 * fetch() for untrusted-size JSON (audit 2026-11-16 at b14958a). Unlike fetchWithTimeout, whose timer stops when the
 * headers arrive, the deadline here also covers reading the body, and the body is capped at `maxBytes` (checked against
 * content-length first, then while streaming). A non-ok response's body is cancelled unread. Throws AbortError on
 * timeout, ResponseTooLargeError over the cap, and SyntaxError on bad JSON; callers catch and fail closed.
 *
 * fetchWithTimeout is left as is on purpose: its other callers include LLM calls whose bodies may legitimately be slow.
 */
export async function fetchJsonWithLimits(
  input: RequestInfo | URL,
  init: RequestInit = {},
  { timeoutMs = 10_000, maxBytes = DEFAULT_JSON_MAX_BYTES, fetchImpl = fetch }: LimitedJsonOptions = {},
): Promise<LimitedJson> {
  const controller = new AbortController()
  let onAbort: (err: Error) => void = () => {}
  // Rejects when the deadline passes, so a stalled fetch or body read can't outlive it even if the fetch ignores the signal.
  const deadline = new Promise<never>((_, reject) => {
    onAbort = reject
  })
  deadline.catch(() => {})
  const timer = setTimeout(() => {
    const err = new Error("The operation was aborted due to timeout")
    err.name = "AbortError"
    controller.abort(err)
    onAbort(err)
  }, timeoutMs)
  try {
    const res = await Promise.race([fetchImpl(input, { ...init, signal: controller.signal }), deadline])
    if (!res.ok) {
      await res.body?.cancel().catch(() => {})
      const retryAfter = res.headers.get("retry-after")
      return retryAfter ? { ok: false, status: res.status, data: null, retryAfter } : { ok: false, status: res.status, data: null }
    }
    const declared = Number(res.headers.get("content-length") || 0)
    if (declared > maxBytes) {
      await res.body?.cancel().catch(() => {})
      throw new ResponseTooLargeError(maxBytes)
    }
    if (!res.body) throw new SyntaxError("empty response body")
    const reader = res.body.getReader()
    const chunks: Uint8Array[] = []
    let total = 0
    for (;;) {
      const { done, value } = await Promise.race([reader.read(), deadline])
      if (done) break
      total += value.byteLength
      if (total > maxBytes) {
        await reader.cancel().catch(() => {})
        throw new ResponseTooLargeError(maxBytes)
      }
      chunks.push(value)
    }
    const body = new Uint8Array(total)
    let offset = 0
    for (const c of chunks) {
      body.set(c, offset)
      offset += c.byteLength
    }
    return { ok: true, status: res.status, data: JSON.parse(new TextDecoder().decode(body)) }
  } finally {
    clearTimeout(timer)
  }
}
