// lib/agent-recommendations/postProcess.ts

import type { ZuloResponse } from "./types"

function sanitizeSources(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim().slice(0, 500))
    .slice(0, 12)
}

/** Strip markdown code fences that models often wrap around JSON. */
function stripCodeFences(text: string): string {
  let clean = text.trim()
  const fullFence = clean.match(/^```(?:json)?\s*([\s\S]*?)\s*```\s*$/i)
  if (fullFence?.[1]) return fullFence[1].trim()

  if (clean.startsWith("```")) {
    clean = clean.replace(/^```(?:json)?\s*/i, "")
    // Drop a trailing fence if present (including truncated mid-content cases)
    const trailing = clean.lastIndexOf("```")
    if (trailing !== -1 && trailing > clean.length - 8) {
      clean = clean.slice(0, trailing)
    }
  }
  return clean.trim()
}

/**
 * Extract the outermost JSON object substring (balanced braces), or from the
 * first `{` to end of text when braces never close (truncated generation).
 */
function extractJsonCandidate(text: string): string | null {
  const start = text.indexOf("{")
  if (start === -1) return null

  let depth = 0
  let inString = false
  let escape = false
  for (let i = start; i < text.length; i++) {
    const c = text[i]
    if (escape) {
      escape = false
      continue
    }
    if (c === "\\" && inString) {
      escape = true
      continue
    }
    if (c === '"') {
      inString = !inString
      continue
    }
    if (inString) continue
    if (c === "{") depth++
    else if (c === "}") {
      depth--
      if (depth === 0) return text.slice(start, i + 1)
    }
  }

  // Truncated / unbalanced — return remainder for repair attempts
  return text.slice(start)
}

/** Close open strings / brackets / braces so partial JSON can often parse. */
function repairTruncatedJson(input: string): string {
  let s = input.trim()
  // Drop trailing incomplete key fragments like `,"next` or `, "conf`
  s = s.replace(/,\s*"[^"]*$/, "")
  s = s.replace(/,\s*$/, "")

  let inString = false
  let escape = false
  let braces = 0
  let brackets = 0

  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (escape) {
      escape = false
      continue
    }
    if (c === "\\" && inString) {
      escape = true
      continue
    }
    if (c === '"') {
      inString = !inString
      continue
    }
    if (inString) continue
    if (c === "{") braces++
    else if (c === "}") braces = Math.max(0, braces - 1)
    else if (c === "[") brackets++
    else if (c === "]") brackets = Math.max(0, brackets - 1)
  }

  if (inString) s += '"'
  while (brackets > 0) {
    s += "]"
    brackets--
  }
  while (braces > 0) {
    s += "}"
    braces--
  }
  return s
}

/** Pull a JSON string field even when the value is truncated mid-string. */
function extractStringField(text: string, key: string): string | undefined {
  const closed = new RegExp(
    `"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`,
    "s",
  )
  const closedMatch = text.match(closed)
  if (closedMatch?.[1] != null) {
    return unescapeJsonString(closedMatch[1]).trim() || undefined
  }

  // Truncated: "key": "value without closing quote
  const open = new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)`, "s")
  const openMatch = text.match(open)
  if (openMatch?.[1] != null) {
    const val = unescapeJsonString(openMatch[1]).trim()
    return val || undefined
  }
  return undefined
}

function unescapeJsonString(s: string): string {
  return s
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\")
}

/** Pull recommendation when it is a JSON string array (best-effort). */
function extractRecommendationArray(text: string): string[] | undefined {
  const m = text.match(/"recommendation"\s*:\s*\[([\s\S]*?)(?:\]|$)/)
  if (!m?.[1]) return undefined
  const items: string[] = []
  const re = /"((?:[^"\\]|\\.)*)"/g
  let match: RegExpExecArray | null
  while ((match = re.exec(m[1])) !== null) {
    const item = unescapeJsonString(match[1]).trim()
    if (item) items.push(item)
  }
  return items.length > 0 ? items : undefined
}

function extractNumberField(text: string, key: string): number | undefined {
  const m = text.match(new RegExp(`"${key}"\\s*:\\s*(-?\\d+(?:\\.\\d+)?)`))
  if (!m?.[1]) return undefined
  const n = Number(m[1])
  return Number.isFinite(n) ? n : undefined
}

function extractStringArrayField(text: string, key: string): string[] {
  const m = text.match(new RegExp(`"${key}"\\s*:\\s*\\[([\\s\\S]*?)(?:\\]|$)`))
  if (!m?.[1]) return []
  const items: string[] = []
  const re = /"((?:[^"\\]|\\.)*)"/g
  let match: RegExpExecArray | null
  while ((match = re.exec(m[1])) !== null) {
    const item = unescapeJsonString(match[1]).trim()
    if (item) items.push(item)
  }
  return items
}

function normalizeRecommendation(
  raw: unknown,
): string | string[] {
  if (Array.isArray(raw)) {
    const items = raw
      .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      .map((item) => item.trim())
    if (items.length > 0) return items
  }
  if (typeof raw === "string" && raw.trim()) {
    return raw.trim()
  }
  return ""
}

function buildFromPartial(parsed: Partial<ZuloResponse>): ZuloResponse | null {
  const recommendation = normalizeRecommendation(parsed.recommendation)
  const understanding =
    typeof parsed.understanding === "string" && parsed.understanding.trim()
      ? parsed.understanding.trim()
      : ""
  const reasoning =
    typeof parsed.reasoning === "string" && parsed.reasoning.trim()
      ? parsed.reasoning.trim()
      : ""

  // Need at least one useful body field — otherwise treat as empty parse
  if (!recommendation && !understanding && !reasoning) {
    return null
  }

  const nextSteps = Array.isArray(parsed.nextSteps)
    ? parsed.nextSteps
        .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        .map((item) => item.trim())
    : []

  return {
    understanding: understanding || "I received your request.",
    recommendation: recommendation || reasoning || understanding || "No specific recommendation available.",
    reasoning: reasoning || "Based on available model output.",
    nextSteps,
    confidence:
      typeof parsed.confidence === "number" && Number.isFinite(parsed.confidence)
        ? Math.max(0, Math.min(100, parsed.confidence))
        : 70,
    sources: sanitizeSources(parsed.sources),
  }
}

/** Best-effort field scrape when JSON.parse fails even after repair. */
function scrapePartialFields(text: string): Partial<ZuloResponse> {
  const recArray = extractRecommendationArray(text)
  const recString = extractStringField(text, "recommendation")
  const recommendation = recArray ?? recString

  return {
    understanding: extractStringField(text, "understanding"),
    recommendation,
    reasoning: extractStringField(text, "reasoning"),
    nextSteps: extractStringArrayField(text, "nextSteps"),
    confidence: extractNumberField(text, "confidence"),
    sources: extractStringArrayField(text, "sources"),
  }
}

/**
 * Prefer useful model text over a dead-end error card.
 * Never slice away the bulk of a long skill reply.
 */
function fallbackFromRaw(rawOutput: string): ZuloResponse {
  const cleaned = stripCodeFences(rawOutput).trim()
  // If it looked like JSON, surface the scraped fields we can still get
  if (cleaned.includes("{") && cleaned.includes("recommendation")) {
    const scraped = buildFromPartial(scrapePartialFields(cleaned))
    if (scraped) {
      return {
        ...scraped,
        reasoning:
          scraped.reasoning === "Based on available model output."
            ? "Partial model output (structured parse incomplete)."
            : scraped.reasoning,
        confidence: scraped.confidence ?? 60,
      }
    }
  }

  const useful =
    cleaned ||
    rawOutput.trim() ||
    "No specific recommendation available."

  return {
    understanding: "I received your request.",
    recommendation: useful,
    reasoning: "Showing the full model response (structured fields were incomplete).",
    nextSteps: [],
    confidence: 55,
    sources: [],
  }
}

export function postProcessZuloOutput(rawOutput: string): ZuloResponse {
  if (!rawOutput?.trim()) {
    return {
      understanding: "I received your request.",
      recommendation: "No specific recommendation available.",
      reasoning: "The model returned an empty response.",
      nextSteps: [],
      confidence: 40,
      sources: [],
    }
  }

  const cleaned = stripCodeFences(rawOutput)
  const candidates: string[] = [cleaned]

  const extracted = extractJsonCandidate(cleaned)
  if (extracted && extracted !== cleaned) {
    candidates.push(extracted)
  } else if (extracted) {
    // already have cleaned starting with { — still try repaired form
  }

  for (const candidate of candidates) {
    // 1) Strict parse
    try {
      const parsed = JSON.parse(candidate) as Partial<ZuloResponse>
      const built = buildFromPartial(parsed)
      if (built) return built
    } catch {
      // continue
    }

    // 2) Repair truncated JSON then parse
    try {
      const repaired = repairTruncatedJson(candidate)
      const parsed = JSON.parse(repaired) as Partial<ZuloResponse>
      const built = buildFromPartial(parsed)
      if (built) {
        return {
          ...built,
          // Slightly lower confidence when we had to repair
          confidence:
            typeof built.confidence === "number"
              ? Math.min(built.confidence, 75)
              : 65,
        }
      }
    } catch {
      // continue
    }

    // 3) Field scrape without full JSON validity
    const scraped = buildFromPartial(scrapePartialFields(candidate))
    if (scraped) {
      return {
        ...scraped,
        reasoning:
          scraped.reasoning === "Based on available model output."
            ? "Recovered fields from partial model output."
            : scraped.reasoning,
        confidence:
          typeof scraped.confidence === "number"
            ? Math.min(scraped.confidence, 70)
            : 60,
      }
    }
  }

  console.warn(
    "[agent-recommendations] Post-processing could not parse structured JSON; surfacing raw text",
  )
  return fallbackFromRaw(rawOutput)
}
