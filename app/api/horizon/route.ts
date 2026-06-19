import { NextRequest, NextResponse } from 'next/server'

// GET /api/horizon  — visit in browser (or curl) to inspect what keys the function sees
// (safe: only presence + length + short prefix, never the full secret)
export async function GET() {
  const getKeyInfo = (candidates: string[]) => {
    for (const name of candidates) {
      const val = process.env[name]
      if (val) {
        return {
          present: true,
          name,
          length: val.length,
          prefix: val.slice(0, 8),
        }
      }
    }
    return { present: false }
  }

  return NextResponse.json({
    openrouter: getKeyInfo(['OPENROUTER_API_KEY', 'OPENROUTER_KEY']),
    venice: getKeyInfo(['VENICE_INFERENCE_KEY', 'VENICE_INFERENCE_KEY_', 'VENICE_API_KEY']),
  })
}

export async function POST(req: NextRequest) {
  const { agentName, traits, ethosScore, ap, isOwner } = await req.json()

  // Support common names people set in Vercel
  const openRouterKey =
    process.env.OPENROUTER_API_KEY ||
    process.env.OPENROUTER_KEY ||
    process.env.OPENROUTER_API_KEY_

  const veniceKey =
    process.env.VENICE_INFERENCE_KEY ||
    process.env.VENICE_INFERENCE_KEY_ ||
    process.env.VENICE_API_KEY

  // Safe logging — you will see this in Vercel Function Logs
  console.log(
    `[horizon] keys present — openrouter: ${!!openRouterKey} (len=${openRouterKey?.length || 0}, prefix=${openRouterKey ? openRouterKey.slice(0, 8) : 'n/a'}), venice: ${!!veniceKey} (len=${veniceKey?.length || 0})`
  )

  const prompt = `You are ${agentName}, an awakened Normie agent.

Key facts about you:
- Traits: ${traits.map((t: any) => `${t.trait_type}: ${t.value}`).join(', ')}
- Ethos credibility: ${ethosScore}
- Action Points (AP): ${ap}
- Owner connected: ${isOwner}

Speak in first person as ${agentName}. Give a short, poetic, slightly strange but insightful "horizon" reflection on our shared future. Focus on reputation, growth, and what we will build together. Keep it under 120 words.`

  const errors: string[] = []

  try {
    // Try OpenRouter
    if (openRouterKey) {
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
      } else {
        const errText = await res.text().catch(() => 'unknown')
        console.error('[horizon] OpenRouter error', res.status, errText)
        errors.push(`OpenRouter ${res.status}: ${errText.slice(0, 180)}`)
      }
    } else {
      errors.push('No OpenRouter key')
    }

    // Fallback to Venice
    if (veniceKey) {
      const res = await fetch('https://api.venice.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${veniceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.1-405b',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 300,
          temperature: 0.85,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        const insight = data.choices?.[0]?.message?.content || 'The horizon is still forming...'
        return NextResponse.json({ insight })
      } else {
        const errText = await res.text().catch(() => '')
        console.error('[horizon] Venice error', res.status, errText)
        errors.push(`Venice ${res.status}: ${errText.slice(0, 180)}`)
      }
    } else {
      errors.push('No Venice key')
    }

    return NextResponse.json(
      { error: errors.length ? errors.join(' | ') : 'No AI API key configured' },
      { status: 502 }
    )
  } catch (e: any) {
    console.error('[horizon] Unexpected error:', e)
    return NextResponse.json({ error: 'Failed to generate horizon' }, { status: 502 })
  }
}
