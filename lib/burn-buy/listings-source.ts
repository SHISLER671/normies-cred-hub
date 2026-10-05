// Which listings source answers. The Normies API is preferred (it carries rank, type and AP for every listing); OpenSea is the fallback.

/**
 * Try the Normies API once. If that fails (or answers empty, which the caller turns into a throw), retry it AND ask the fallback at the same
 * time, so the fallback costs no extra waiting. The retry wins when it works; otherwise the fallback; otherwise the retry's error is thrown.
 * With no fallback this is exactly the old "one automatic retry".
 */
export async function listingsWithFallback<T>(
  primary: (fresh: boolean) => Promise<T>,
  fallback: (() => Promise<T>) | null,
  pauseMs = 300,
): Promise<T> {
  try {
    return await primary(false)
  } catch {
    await new Promise((r) => setTimeout(r, pauseMs))
    if (!fallback) return primary(true)
    const [retry, other] = await Promise.allSettled([primary(true), fallback()])
    if (retry.status === "fulfilled") return retry.value
    if (other.status === "fulfilled") return other.value
    throw retry.reason
  }
}
