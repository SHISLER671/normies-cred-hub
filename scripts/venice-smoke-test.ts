/**
 * Smoke test for the Venice AI integration.
 *
 * Run with env loaded, e.g.:
 *   node --env-file-if-exists=.env --import tsx scripts/venice-smoke-test.ts
 *
 * Confirms that VENICE_BASE_URL + VENICE_API_KEY reach Venice's
 * OpenAI-compatible /chat/completions endpoint with the GLM 5.2 model.
 */
import { veniceChat, VENICE_DEFAULT_MODEL } from '../lib/venice/client'

async function main() {
  console.log('[venice] base URL set:', !!process.env.VENICE_BASE_URL)
  console.log('[venice] api key set:', !!process.env.VENICE_API_KEY)
  console.log('[venice] model:', VENICE_DEFAULT_MODEL)

  const reply = await veniceChat(
    [
      { role: 'system', content: 'You are a terse assistant. Reply in one short sentence.' },
      { role: 'user', content: 'Say hello and confirm the Venice API is working.' },
    ],
    { maxTokens: 60 },
  )

  console.log('\n[venice] reply:\n' + reply.trim())

  if (!reply.trim()) {
    throw new Error('Empty response from Venice')
  }
  console.log('\n[venice] OK — /chat/completions call succeeded.')
}

main().catch((err) => {
  console.error('\n[venice] FAILED:', err?.message || err)
  process.exit(1)
})
