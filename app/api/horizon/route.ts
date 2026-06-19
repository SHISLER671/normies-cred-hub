import { NextRequest, NextResponse } from 'next/server'

// Visit /api/horizon in the browser to see which keys the function can read.
// Only reports presence + length, never the secret value itself.
export async function GET() {
  const veniceRaw =
    process.env.VENICE_INFERENCE_KEY_ ||
    process.env.VENICE_INFERENCE_KEY ||
    process.env.VENICE_API_KEY ||
    ''
  return NextResponse.json({
    venice: {
      present: Boolean(veniceRaw),
      length: veniceRaw.length,
      // Venice keys must start with this prefix; if false, the value is mis-pasted.
      hasExpectedPrefix: veniceRaw.startsWith('VENICE_INFERENCE_KEY_'),
      readFrom: process.env.VENICE_INFERENCE_KEY_
        ? 'VENICE_INFERENCE_KEY_'
        : process.env.VENICE_INFERENCE_KEY
          ? 'VENICE_INFERENCE_KEY'
          : process.env.VENICE_API_KEY
            ? 'VENICE_API_KEY'
            : null,
    },
    openRouter: { present: Boolean(process.env.OPENROUTER_API_KEY) },
  })
}

export async function POST(req: NextRequest) {
  const { agentName, traits, ethosScore, ap, isOwner } = await req.json()

  // Accept whichever name the key was stored under (Venice's key literally
  // begins with "VENICE_INFERENCE_KEY_", so people often mis-split it).
  const veniceKey =
    process.env.VENICE_INFERENCE_KEY_ ||
    process.env.VENICE_INFERENCE_KEY ||
    process.env.VENICE_API_KEY
  const openRouterKey = process.env.OPENROUTER_API_KEY

  const prompt = `You are ${agentName}, an awakened Normie agent.

Key facts about you:
- Traits: ${traits.map((t: any) => `${t.trait_type}: ${t.value}`).join(', ')}
- Ethos credibility: ${ethosScore}
- Action Points (AP): ${ap}
- Owner connected: ${isOwner}

Speak in first person as ${agentName}. Give a short, poetic, slightly strange but insightful "horizon" reflection on our shared future. Focus on reputation, growth, and what we will build together. Keep it under 120 words.`

  if (!veniceKey && !openRouterKey) {
    return NextResponse.json(
      { error: 'No AI API key configured. Set VENICE_INFERENCE_KEY_ in your Vercel project.' },
      { status: 500 },
    )
  }

  const errors: string[] = []

  // === Try Venice first (verified working) ===
  if (veniceKey) {
    try {
      const res = await fetch('https://api.venice.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${veniceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b', // valid current Venice slug
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 300,
          temperature: 0.85,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        const insight = data.choices?.[0]?.message?.content || 'The horizon is still forming...'
        return NextResponse.json({ insight })
      }

      const errText = await res.text().catch(() => '')
      console.error('[v0] Venice error:', res.status, errText)
      errors.push(`Venice ${res.status}`)
    } catch (e) {
      console.error('[v0] Venice request threw:', e)
      errors.push('Venice request failed')
    }
  }

  // === Fall back to OpenRouter ===
  if (openRouterKey) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openRouterKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://normies-cred-hub-dashboard.vercel.app',
          'X-Title': 'Normies Cred Hub',
        },
        body: JSON.stringify({
          model: 'meta-llama/llama-3.1-70b-instruct',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 300,
          temperature: 0.85,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        const insight = data.choices?.[0]?.message?.content || 'The horizon is still forming...'
        return NextResponse.json({ insight })
      }

      const errText = await res.text().catch(() => '')
      console.error('[v0] OpenRouter error:', res.status, errText)
      errors.push(`OpenRouter ${res.status}`)
    } catch (e) {
      console.error('[v0] OpenRouter request threw:', e)
      errors.push('OpenRouter request failed')
    }
  }

  return NextResponse.json(
    { error: `All providers failed: ${errors.join(', ')}` },
    { status: 502 },
  )
}

