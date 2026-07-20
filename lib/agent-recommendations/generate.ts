// lib/agent-recommendations/generate.ts

import type { ZuloRecommendationContext } from "./types"
import { composeZuloPrompt } from "./composePrompt"

export async function generateZuloResponse(
  context: ZuloRecommendationContext,
  userQuery: string,
): Promise<string> {
  const apiKey = process.env.XAI_API_KEY?.trim()
  if (!apiKey) {
    throw new Error("XAI_API_KEY is not configured")
  }

  const prompt = composeZuloPrompt(context, userQuery)

  const response = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "grok-4",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 1000,
    }),
  })

  if (!response.ok) {
    const errBody = await response.text().catch(() => "")
    console.error(
      "[agent-recommendations] xAI error:",
      response.status,
      errBody.slice(0, 300),
    )
    throw new Error(`xAI API error: ${response.status}`)
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }

  return data.choices?.[0]?.message?.content || ""
}
