import OpenAI from 'openai'

/**
 * Venice AI is OpenAI-compatible, so we point the standard OpenAI client at
 * Venice's base URL and authenticate with the Venice API key.
 *
 * Env vars (never hardcode secrets):
 *   - VENICE_BASE_URL  e.g. https://api.venice.ai/api/v1
 *   - VENICE_API_KEY   secret, kept in .env (gitignored)
 */

/** Default Venice model for this project: GLM 5.2. */
export const VENICE_DEFAULT_MODEL = 'zai-org-glm-5-2'

function getBaseURL(): string {
  const baseURL = (process.env.VENICE_BASE_URL || '').trim()
  if (!baseURL) {
    throw new Error('VENICE_BASE_URL is not set. Add it to your .env file.')
  }
  return baseURL
}

function getApiKey(): string {
  const apiKey = (
    process.env.VENICE_API_KEY ||
    process.env.VENICE_INFERENCE_KEY ||
    ''
  ).trim()
  if (!apiKey) {
    throw new Error('VENICE_API_KEY is not set. Add it to your .env file.')
  }
  return apiKey
}

let cachedClient: OpenAI | null = null

/**
 * Returns a singleton OpenAI-compatible client configured for Venice.
 * Server-only: reads secrets from the environment.
 */
export function getVeniceClient(): OpenAI {
  if (cachedClient) return cachedClient
  cachedClient = new OpenAI({
    baseURL: getBaseURL(),
    apiKey: getApiKey(),
  })
  return cachedClient
}

/**
 * Convenience helper for a single-turn chat completion against Venice.
 */
export async function veniceChat(
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
  options: { model?: string; temperature?: number; maxTokens?: number } = {},
): Promise<string> {
  const client = getVeniceClient()
  const completion = await client.chat.completions.create({
    model: options.model ?? VENICE_DEFAULT_MODEL,
    messages,
    temperature: options.temperature ?? 0.4,
    max_tokens: options.maxTokens ?? 1024,
  })
  return completion.choices[0]?.message?.content ?? ''
}
