import { fetchWithTimeout } from "@/lib/fetch-with-timeout"

const RETRY_STATUSES = new Set([429, 500, 502, 503, 504, 529])
const MAX_RETRY_WAIT_MS = 2_000

type Options = {
  attempts?: number
  /** Injected in tests. */
  fetcher?: typeof fetchWithTimeout
  sleep?: (ms: number) => Promise<void>
}

function waitMs(res: Response | null, attempt: number): number {
  const retryAfter = Number(res?.headers.get("retry-after"))
  const base = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 400 * 2 ** attempt
  return Math.min(base, MAX_RETRY_WAIT_MS)
}

/**
 * fetchWithTimeout that retries rate limits (429), 5xx and network errors. Returns the last Response
 * if the retries run out on a bad status; throws if the last attempt failed at the network level.
 * Callers must still check `res.ok`: a 404 or other 4xx is returned at once, never retried.
 */
export async function fetchWithRetry(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 10_000,
  { attempts = 3, fetcher = fetchWithTimeout, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) }: Options = {},
): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const last = attempt >= attempts - 1
    let res: Response | null = null
    try {
      res = await fetcher(input, init, timeoutMs)
      if (!RETRY_STATUSES.has(res.status) || last) return res
    } catch (err) {
      if (last) throw err
    }
    await sleep(waitMs(res, attempt))
  }
}
