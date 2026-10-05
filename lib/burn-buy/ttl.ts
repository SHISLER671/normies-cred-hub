/** Tiny TTL cache that also shares one in-flight load between concurrent callers. A load that throws is never kept. */
export function ttl<T>(ms: number, load: () => Promise<T>): () => Promise<T> {
  let value: T | undefined
  let at = 0
  let inflight: Promise<T> | null = null
  return async () => {
    if (value !== undefined && Date.now() - at < ms) return value
    if (!inflight) {
      inflight = load()
        .then((v) => { value = v; at = Date.now(); return v })
        .finally(() => { inflight = null })
    }
    return inflight
  }
}
