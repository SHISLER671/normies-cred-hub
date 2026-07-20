// lib/agent-recommendations/postProcess.ts

import type { ZuloResponse } from "./types"

function sanitizeSources(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim().slice(0, 500))
    .slice(0, 12)
}

export function postProcessZuloOutput(rawOutput: string): ZuloResponse {
  try {
    let clean = rawOutput.trim()
    if (clean.startsWith("```json")) {
      clean = clean.replace(/^```json\s*/i, "").replace(/```\s*$/, "")
    } else if (clean.startsWith("```")) {
      clean = clean.replace(/^```\s*/, "").replace(/```\s*$/, "")
    }

    const parsed = JSON.parse(clean) as Partial<ZuloResponse>

    const recommendation = (() => {
      if (Array.isArray(parsed.recommendation)) {
        return parsed.recommendation
          .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
          .map((item) => item.trim())
      }
      if (typeof parsed.recommendation === "string" && parsed.recommendation.trim()) {
        return parsed.recommendation.trim()
      }
      return "No specific recommendation available."
    })()

    const nextSteps = Array.isArray(parsed.nextSteps)
      ? parsed.nextSteps
          .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
          .map((item) => item.trim())
      : []

    return {
      understanding:
        typeof parsed.understanding === "string" && parsed.understanding.trim()
          ? parsed.understanding.trim()
          : "I received your request.",
      recommendation,
      reasoning:
        typeof parsed.reasoning === "string" && parsed.reasoning.trim()
          ? parsed.reasoning.trim()
          : "Based on current context.",
      nextSteps,
      confidence:
        typeof parsed.confidence === "number" && Number.isFinite(parsed.confidence)
          ? Math.max(0, Math.min(100, parsed.confidence))
          : 70,
      sources: sanitizeSources(parsed.sources),
    }
  } catch (e) {
    console.warn("[agent-recommendations] Post-processing failed:", e)
    return {
      understanding: "I received your request.",
      recommendation: rawOutput.slice(0, 600) || "No specific recommendation available.",
      reasoning: "Raw response (parsing issue).",
      nextSteps: ["Please try rephrasing your question for better results."],
      confidence: 50,
      sources: [],
    }
  }
}
