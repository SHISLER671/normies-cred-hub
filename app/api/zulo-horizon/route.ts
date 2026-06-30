import { NextRequest, NextResponse } from "next/server"

import { fetchWithTimeout, isTimeoutError } from "@/lib/fetch-with-timeout"
import { checkRateLimitById, getClientId } from "@/lib/ratelimit"
import { enrichToolsWithWalletAccess } from "@/lib/erc8257/access-check"
import { getCachedRegistryTools } from "@/lib/erc8257/cache"
import {
  buildAgentRecommendationHints,
  horizonAgentToToolContext,
} from "@/lib/erc8257/context"
import {
  buildHorizonToolsBlock,
  getErc8257ToolsForPrompt,
  selectToolsForHorizonPrompt,
} from "@/lib/erc8257/prompt"
import { getToolsListForPrompt } from "@/lib/tools"
import {
  buildZuloSystemPrompt,
  countUserMessages,
  type HorizonAgentContext,
  type HorizonChatMessage,
  type HorizonModelTier,
  ZULO_HORIZON_LIMITS,
  ZULO_HORIZON_MODELS,
} from "@/lib/zulo-horizon"

interface HorizonRequestBody {
  sessionId?: string
  sessionStartedAt?: number
  lastActivityAt?: number
  messages?: HorizonChatMessage[]
  message?: string
  agentContext?: HorizonAgentContext | null
}

interface OpenRouterProviderConfig {
  max_price?: { prompt: number; completion: number }
}

interface ModelAttempt {
  tier: HorizonModelTier
  model: string
  provider?: OpenRouterProviderConfig
}

const MODEL_ATTEMPTS: ModelAttempt[] = [
  {
    tier: "free",
    model: ZULO_HORIZON_MODELS.free,
    provider: { max_price: { prompt: 0, completion: 0 } },
  },
  { tier: "primary", model: ZULO_HORIZON_MODELS.primary },
  { tier: "backup", model: ZULO_HORIZON_MODELS.backup },
]

function sanitizeMessages(raw: unknown): HorizonChatMessage[] {
  if (!Array.isArray(raw)) return []

  return raw
    .filter(
      (m): m is HorizonChatMessage =>
        !!m &&
        typeof m === "object" &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim().length > 0,
    )
    .map((m) => ({
      role: m.role,
      content: m.content.trim().slice(0, ZULO_HORIZON_LIMITS.maxInputChars),
    }))
    .slice(-ZULO_HORIZON_LIMITS.maxTotalMessages)
}

function buildSuccessResponse(
  reply: string,
  model: string,
  tier: HorizonModelTier,
  priorUserCount: number,
  historyLength: number,
  sessionStartedAt: number,
) {
  const userMessages = priorUserCount + 1
  const totalMessages = historyLength + 2
  return NextResponse.json({
    reply,
    model,
    tier,
    limits: {
      userMessages,
      maxUserMessages: ZULO_HORIZON_LIMITS.maxUserMessages,
      totalMessages,
      maxTotalMessages: ZULO_HORIZON_LIMITS.maxTotalMessages,
      sessionExpiresAt: sessionStartedAt + ZULO_HORIZON_LIMITS.sessionTimeoutMs,
    },
  })
}

async function callOpenRouter(
  apiKey: string,
  attempt: ModelAttempt,
  messages: Array<{ role: string; content: string }>,
): Promise<{ content: string; model: string; tier: HorizonModelTier } | { error: string }> {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://normies-cred-hub.vercel.app")

  const body: Record<string, unknown> = {
    model: attempt.model,
    messages,
    max_tokens: 450,
    temperature: 0.85,
  }

  if (attempt.provider) {
    body.provider = attempt.provider
  }

  try {
    const res = await fetchWithTimeout(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": siteUrl,
          "X-Title": "Normies Cred Hub - Zulo Horizon",
        },
        body: JSON.stringify(body),
      },
      25_000,
    )

    if (!res.ok) {
      const errText = await res.text().catch(() => "unknown")
      return { error: `[${attempt.tier}] ${attempt.model} ${res.status}: ${errText.slice(0, 200)}` }
    }

    const data = await res.json()
    const content = data.choices?.[0]?.message?.content?.trim()
    if (!content) {
      return { error: `[${attempt.tier}] ${attempt.model} returned empty response` }
    }

    const usedModel = (data.model as string | undefined) || attempt.model
    return { content, model: usedModel, tier: attempt.tier }
  } catch (e) {
    if (isTimeoutError(e)) {
      return { error: `[${attempt.tier}] ${attempt.model} timed out` }
    }
    return { error: `[${attempt.tier}] ${attempt.model} ${String(e)}` }
  }
}

async function chatWithModelFallback(
  apiKey: string,
  messages: Array<{ role: string; content: string }>,
): Promise<{ content: string; model: string; tier: HorizonModelTier } | null> {
  const errors: string[] = []

  for (const attempt of MODEL_ATTEMPTS) {
    const result = await callOpenRouter(apiKey, attempt, messages)

    if ("content" in result) {
      console.log(
        `[zulo-horizon] response via ${result.tier} tier (requested=${attempt.model}, used=${result.model})`,
      )
      return result
    }

    errors.push(result.error)
    console.warn(`[zulo-horizon] ${attempt.tier} tier failed, trying next:`, result.error)
  }

  console.error("[zulo-horizon] all model tiers failed:", errors.join(" | "))
  return null
}

export async function POST(req: NextRequest) {
  let body: HorizonRequestBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body", code: "BAD_REQUEST" }, { status: 400 })
  }

  const sessionId = body.sessionId?.trim()
  const sessionStartedAt = body.sessionStartedAt
  const lastActivityAt = body.lastActivityAt ?? sessionStartedAt
  const history = sanitizeMessages(body.messages)
  const userMessage = body.message?.trim() ?? ""
  const agentContext = body.agentContext ?? null

  if (!sessionId || sessionId.length > 64) {
    return NextResponse.json(
      { error: "A valid sessionId is required.", code: "BAD_REQUEST" },
      { status: 400 },
    )
  }

  if (!sessionStartedAt || !Number.isFinite(sessionStartedAt)) {
    return NextResponse.json(
      { error: "sessionStartedAt is required.", code: "BAD_REQUEST" },
      { status: 400 },
    )
  }

  if (lastActivityAt && Number.isFinite(lastActivityAt)) {
    const inactiveMs = Date.now() - lastActivityAt
    if (inactiveMs > ZULO_HORIZON_LIMITS.sessionTimeoutMs) {
      return NextResponse.json(
        {
          error:
            "This chat session has timed out after 10 minutes of inactivity. Start a new chat to continue!",
          code: "SESSION_EXPIRED",
        },
        { status: 410 },
      )
    }
  }

  if (!userMessage) {
    return NextResponse.json(
      { error: "Message cannot be empty.", code: "INPUT_EMPTY" },
      { status: 400 },
    )
  }

  if (userMessage.length > ZULO_HORIZON_LIMITS.maxInputChars) {
    return NextResponse.json(
      {
        error: `Messages are limited to ${ZULO_HORIZON_LIMITS.maxInputChars} characters.`,
        code: "INPUT_TOO_LONG",
      },
      { status: 400 },
    )
  }

  const priorUserCount = countUserMessages(history)
  if (priorUserCount >= ZULO_HORIZON_LIMITS.maxUserMessages) {
    return NextResponse.json(
      {
        error:
          "You've reached the message limit for this session. Feel free to start a new chat!",
        code: "SESSION_USER_LIMIT",
      },
      { status: 429 },
    )
  }

  if (history.length >= ZULO_HORIZON_LIMITS.maxTotalMessages) {
    return NextResponse.json(
      {
        error:
          "This session has reached its maximum length. Start a new chat to keep talking with Zulo!",
        code: "SESSION_MESSAGE_LIMIT",
      },
      { status: 429 },
    )
  }

  const clientId = getClientId(req)
  const rl = await checkRateLimitById(
    `${clientId}:${sessionId}`,
    "zulo-horizon-msg",
    ZULO_HORIZON_LIMITS.rateLimitPerMinute,
    60,
  )
  if (!rl.ok) {
    return NextResponse.json(
      {
        error: "You're sending messages too quickly. Please wait a moment and try again.",
        code: "RATE_LIMIT",
      },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    )
  }

  const apiKey = (process.env.OPENROUTER_API_KEY || "").trim()
  if (!apiKey) {
    return NextResponse.json(
      { error: "Zulo Horizon is not configured. Missing OPENROUTER_API_KEY.", code: "AI_UNAVAILABLE" },
      { status: 503 },
    )
  }

  let toolsBlock: string | undefined
  try {
    const toolCtx = horizonAgentToToolContext(agentContext)
    const { tools } = await getCachedRegistryTools()
    const withAccess = await enrichToolsWithWalletAccess(
      tools,
      agentContext?.holderAddress,
      { maxChecks: 40 },
    )
    const erc8257List = getErc8257ToolsForPrompt(
      selectToolsForHorizonPrompt(withAccess, toolCtx),
    )
    const hints = toolCtx ? buildAgentRecommendationHints(toolCtx) : ""
    toolsBlock = `${buildHorizonToolsBlock(getToolsListForPrompt(), erc8257List)}${
      hints ? `\n\nRecommendation hints for the loaded agent:\n${hints}` : ""
    }`
  } catch (e) {
    console.warn("[zulo-horizon] ERC-8257 tools unavailable for prompt:", e)
  }

  const systemPrompt = buildZuloSystemPrompt(agentContext, toolsBlock)
  const llmMessages: Array<{ role: string; content: string }> = [
    { role: "system", content: systemPrompt },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: userMessage },
  ]

  try {
    const result = await chatWithModelFallback(apiKey, llmMessages)

    if (result) {
      return buildSuccessResponse(
        result.content,
        result.model,
        result.tier,
        priorUserCount,
        history.length,
        sessionStartedAt,
      )
    }

    return NextResponse.json(
      {
        error: "Zulo is having trouble connecting right now. Try again in a moment.",
        code: "AI_UNAVAILABLE",
      },
      { status: 502 },
    )
  } catch (e) {
    console.error("[zulo-horizon] Unexpected error:", e)
    return NextResponse.json(
      { error: "Something went wrong. Please try again.", code: "AI_UNAVAILABLE" },
      { status: 502 },
    )
  }
}