// lib/agent-recommendations/generate.ts

import { fetchWithTimeout, isTimeoutError } from "@/lib/fetch-with-timeout"

import { composeZuloPrompt } from "./composePrompt"
import type { ZuloRecommendationContext } from "./types"

/** xAI chat can be slow under load; abort before Vercel kills the function. */
const XAI_TIMEOUT_MS = 45_000

export class ZuloGenerateError extends Error {
  readonly code: "config" | "upstream" | "timeout" | "empty"
  readonly status: number

  constructor(
    code: ZuloGenerateError["code"],
    message: string,
    status = 502,
  ) {
    super(message)
    this.name = "ZuloGenerateError"
    this.code = code
    this.status = status
  }
}

export async function generateZuloResponse(
  context: ZuloRecommendationContext,
  userQuery: string,
): Promise<string> {
  const apiKey = process.env.XAI_API_KEY?.trim()
  if (!apiKey) {
    throw new ZuloGenerateError(
      "config",
      "XAI_API_KEY is not configured",
      500,
    )
  }

  const prompt = composeZuloPrompt(context, userQuery)

  let response: Response
  try {
    response = await fetchWithTimeout(
      "https://api.x.ai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "grok-4",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7,
          max_tokens: 1200,
        }),
      },
      XAI_TIMEOUT_MS,
    )
  } catch (err) {
    if (isTimeoutError(err)) {
      throw new ZuloGenerateError(
        "timeout",
        "xAI request timed out",
        504,
      )
    }
    throw new ZuloGenerateError(
      "upstream",
      `xAI network error: ${err instanceof Error ? err.message : "unknown"}`,
      502,
    )
  }

  if (!response.ok) {
    const errBody = await response.text().catch(() => "")
    console.error(
      "[agent-recommendations] xAI error:",
      response.status,
      errBody.slice(0, 300),
    )
    throw new ZuloGenerateError(
      "upstream",
      `xAI API error: ${response.status}`,
      response.status >= 500 ? 502 : 502,
    )
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }

  const content = data.choices?.[0]?.message?.content || ""
  if (!content.trim()) {
    throw new ZuloGenerateError(
      "empty",
      "xAI returned an empty recommendation",
      502,
    )
  }

  return content
}

/** Map generate errors to user-safe API payloads. */
export function zuloErrorToResponse(err: unknown): {
  status: number
  body: { error: string; code?: string; retryable?: boolean }
} {
  if (err instanceof ZuloGenerateError) {
    if (err.code === "config") {
      return {
        status: 500,
        body: {
          error: "Zulo is not fully configured on this server (missing model key).",
          code: err.code,
          retryable: false,
        },
      }
    }
    if (err.code === "timeout") {
      return {
        status: 504,
        body: {
          error:
            "Zulo took too long to think — the model timed out. Try a shorter question or retry in a moment.",
          code: err.code,
          retryable: true,
        },
      }
    }
    return {
      status: 502,
      body: {
        error:
          "Zulo could not reach the recommendation model. Strategy data may still be fine — please try again.",
        code: err.code,
        retryable: true,
      },
    }
  }

  const message = err instanceof Error ? err.message : "Unknown error"
  if (message.includes("XAI_API_KEY")) {
    return {
      status: 500,
      body: {
        error: "XAI_API_KEY is not configured on the server",
        code: "config",
        retryable: false,
      },
    }
  }

  return {
    status: 500,
    body: {
      error: "Internal error generating recommendations",
      code: "internal",
      retryable: true,
    },
  }
}
