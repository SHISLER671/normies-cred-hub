// Untrusted-metadata helpers for Ask Zulo's context (audit 2026-11-16 at b14958a, Claude).
//
// NFT metadata and the community rarity API are outside data. Their attribute lists can be malformed, and their text
// (names, trait names and values) ends up in the LLM prompt. These helpers read attributes without throwing, treat
// "" and null as missing, refuse prototype keys, and turn text into one clipped line with no control characters.

export type MetaAttribute = { trait_type: string; value: string | number }

/** Keys never copied into a plain object (prototype pollution). */
const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"])

/** Well-formed attributes only: an array of objects with a string trait_type and a string or finite-number value. */
export function attributeList(attrs: unknown): MetaAttribute[] {
  if (!Array.isArray(attrs)) return []
  const out: MetaAttribute[] = []
  for (const a of attrs) {
    if (a === null || typeof a !== "object") continue
    const { trait_type, value } = a as Record<string, unknown>
    if (typeof trait_type !== "string") continue
    if (typeof value === "string" || (typeof value === "number" && Number.isFinite(value))) out.push({ trait_type, value })
  }
  return out
}

/** The first attribute named `name` with a usable number. "" and whitespace are missing, never 0. */
export function attrNumber(attrs: unknown, name: string): number | undefined {
  for (const a of attributeList(attrs)) {
    if (a.trait_type !== name) continue
    if (typeof a.value === "number") return a.value
    if (a.value.trim() === "") continue
    const n = Number(a.value)
    if (Number.isFinite(n)) return n
  }
  return undefined
}

/** The first attribute named `name`, as a string. "" counts as missing. */
export function attrString(attrs: unknown, name: string): string | undefined {
  for (const a of attributeList(attrs)) {
    if (a.trait_type !== name) continue
    const s = String(a.value)
    if (s.trim() === "") continue
    return s
  }
  return undefined
}

/** Max length of one piece of outside text in the prompt. Normie names are "Normie #1234"; agent names are short. */
export const PROMPT_TEXT_MAX = 64

// C0 and C1 control characters (newline, tab, escape …) plus the Unicode line and paragraph separators.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f  ]/g

/**
 * Outside text made safe to place in the prompt: control characters and newlines become spaces, runs of spaces
 * collapse, and the result is clipped to `max` characters (with "…"). Not a string → "".
 */
export function cleanPromptText(text: unknown, max = PROMPT_TEXT_MAX): string {
  if (typeof text !== "string") return ""
  const flat = text.replace(CONTROL_CHARS, " ").replace(/\s+/g, " ").trim()
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat
}

/** A trait map from outside data: unsafe keys dropped, keys and string values cleaned, empty keys skipped. */
export function cleanTraitRecord(record: Record<string, string | number>): Record<string, string | number> {
  const out: Record<string, string | number> = {}
  for (const [k, v] of Object.entries(record)) {
    const key = cleanPromptText(k)
    if (!key || UNSAFE_KEYS.has(key)) continue
    out[key] = typeof v === "string" ? cleanPromptText(v) : v
  }
  return out
}

/**
 * Trait entries from a metadata attributes list, skipping the canvas numbers (stored separately) and unsafe keys.
 * Used only when the base traits couldn't be read.
 */
export function traitsFromAttributes(attrs: unknown, skip: ReadonlySet<string>): Record<string, string | number> {
  const out: Record<string, string | number> = {}
  for (const a of attributeList(attrs)) {
    if (skip.has(a.trait_type) || UNSAFE_KEYS.has(a.trait_type)) continue
    out[a.trait_type] = a.value
  }
  return out
}
