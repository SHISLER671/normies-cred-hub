// lib/agent-recommendations/generate.ts

import { fetchWithTimeout, isTimeoutError } from "@/lib/fetch-with-timeout"

import { composeZuloPrompt } from "./composePrompt"
import type { ZuloRecommendationContext } from "./types"

/** Inference can be slow under load; abort before Vercel kills the function. */
const INFERENCE_TIMEOUT_MS = 45_000

/** Venice GLM 5.2 is the primary model; xAI grok-4 is the fallback. */
const VENICE_MODEL = "zai-org-glm-5-2"
const XAI_MODEL = "grok-4"
const XAI_ENDPOINT = "https://api.x.ai/v1/chat/completions"

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

interface ProviderConfig {
  label: string
  endpoint: string
  apiKey: string
  model: string
}

/** Normalize a Venice base URL (e.g. ".../api/v1") into a chat endpoint. */
function veniceEndpoint(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/chat/completions`
}

/** Resolve the primary (Venice) and fallback (xAI) providers from env. */
function resolveProviders(): ProviderConfig[] {
  const providers: ProviderConfig[] = []

  const veniceKey = process.env.VENICE_API_KEY?.trim()
  const veniceBase = process.env.VENICE_BASE_URL?.trim()
  if (veniceKey && veniceBase) {
    providers.push({
      label: "venice",
      endpoint: veniceEndpoint(veniceBase),
      apiKey: veniceKey,
      model: VENICE_MODEL,
    })
  }

  const xaiKey = process.env.XAI_API_KEY?.trim()
  if (xaiKey) {
    providers.push({
      label: "xai",
      endpoint: XAI_ENDPOINT,
      apiKey: xaiKey,
      model: XAI_MODEL,
    })
  }

  return providers
}

/** Single OpenAI-compatible chat completion call. Throws ZuloGenerateError. */
async function callProvider(
  provider: ProviderConfig,
  prompt: string,
): Promise<string> {
  let response: Response
  try {
    response = await fetchWithTimeout(
      provider.endpoint,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${provider.apiKey}`,
        },
        body: JSON.stringify({
          model: provider.model,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7,
          max_tokens: 1200,
        }),
      },
      INFERENCE_TIMEOUT_MS,
    )
  } catch (err) {
    if (isTimeoutError(err)) {
      throw new ZuloGenerateError(
        "timeout",
        `${provider.label} request timed out`,
        504,
      )
    }
    throw new ZuloGenerateError(
      "upstream",
      `${provider.label} network error: ${err instanceof Error ? err.message : "unknown"}`,
      502,
    )
  }

  if (!response.ok) {
    const errBody = await response.text().catch(() => "")
    console.error(
      `[agent-recommendations] ${provider.label} error:`,
      response.status,
      errBody.slice(0, 300),
    )
    throw new ZuloGenerateError(
      "upstream",
      `${provider.label} API error: ${response.status}`,
      502,
    )
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }

  const content = data.choices?.[0]?.message?.content || ""
  if (!content.trim()) {
    throw new ZuloGenerateError(
      "empty",
      `${provider.label} returned an empty recommendation`,
      502,
    )
  }

  return content
}

export async function generateZuloResponse(
  context: ZuloRecommendationContext,
  userQuery: string,
): Promise<string> {
  const providers = resolveProviders()
  if (providers.length === 0) {
    throw new ZuloGenerateError(
      "config",
      "No inference provider is configured (set VENICE_API_KEY + VENICE_BASE_URL, or XAI_API_KEY)",
      500,
    )
  }

  const prompt = composeZuloPrompt(context, userQuery)

  let lastError: unknown
  for (let i = 0; i < providers.length; i++) {
    const provider = providers[i]
    try {
      return await callProvider(provider, prompt)
    } catch (err) {
      lastError = err
      const isLast = i === providers.length - 1
      console.error(
        `[agent-recommendations] provider "${provider.label}" failed${isLast ? " (no fallback left)" : ", trying fallback"}:`,
        err instanceof Error ? err.message : err,
      )
    }
  }

  // Every provider failed — surface the last error (already a ZuloGenerateError).
  if (lastError instanceof ZuloGenerateError) {
    throw lastError
  }
  throw new ZuloGenerateError(
    "upstream",
    "All inference providers failed",
    502,
  )
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

  return {
    status: 500,
    body: {
      error: "Internal error generating recommendations",
      code: "internal",
      retryable: true,
    },
  }
}
