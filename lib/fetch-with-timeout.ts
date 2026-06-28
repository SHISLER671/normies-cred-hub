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
