// Parse Normie token IDs from free-text user messages.

const MAX_IDS_DEFAULT = 5

/**
 * Extract Normie token IDs (0–9999) from a prompt.
 * Matches: #4475, # 5506, token 7141, normie 123, tokenId: 99, id 42.
 * Order preserved; first mention wins for focus; capped per turn.
 */
export function parseNormieTokenIdsFromText(
  text: string,
  cap: number = MAX_IDS_DEFAULT,
): number[] {
  if (!text || typeof text !== "string") return []

  const patterns: RegExp[] = [
    /#\s*(\d{1,4})\b/g,
    /\b(?:token\s*id|tokenid|token|normie|id)\s*[#:=]?\s*(\d{1,4})\b/gi,
  ]

  const ids: number[] = []
  const seen = new Set<number>()

  for (const re of patterns) {
    re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(text)) !== null) {
      const n = Number(m[1])
      if (!Number.isFinite(n) || n < 0 || n > 9999 || seen.has(n)) continue
      seen.add(n)
      ids.push(n)
      if (ids.length >= cap) return ids
    }
  }

  return ids
}
