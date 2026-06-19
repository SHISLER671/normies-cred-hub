import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { agentName, traits, ethosScore, ap, isOwner } = await req.json()

  // Try OpenRouter first (more reliable), then fall back to Venice
  const openRouterKey = process.env.OPENROUTER_API_KEY
  // Accept whichever name the key was stored under (Venice's key literally
  // begins with "VENICE_INFERENCE_KEY_", so people often mis-split it).
  const veniceKey =
    process.env.VENICE_INFERENCE_KEY_ ||
    process.env.VENICE_INFERENCE_KEY ||
    process.env.VENICE_API_KEY

  const prompt = `You are ${agentName}, an awakened Normie agent.

Key facts about you:
- Traits: ${traits.map((t: any) => `${t.trait_type}: ${t.value}`).join(', ')}
- Ethos credibility: ${ethosScore}
- Action Points (AP): ${ap}
- Owner connected: ${isOwner}

Speak in first person as ${agentName}. Give a short, poetic, slightly strange but insightful "horizon" reflection on our shared future. Focus on reputation, growth, and what we will build together. Keep it under 120 words.`

  try {
    // === Try OpenRouter first ===
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
          model: 'meta-llama/llama-3.1-70b-instruct', // reliable & cheap
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 300,
          temperature: 0.85,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        const insight = data.choices?.[0]?.message?.content || "The horizon is still forming..."
        return NextResponse.json({ insight })
      }
    }

    // === Fallback to Venice ===
    if (veniceKey) {
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

      if (!res.ok) {
        const err = await res.text().catch(() => '')
        console.error('[horizon] Venice error:', res.status, err)
        return NextResponse.json({ error: `Venice error ${res.status}` }, { status: 502 })
      }

      const data = await res.json()
      const insight = data.choices?.[0]?.message?.content || "The horizon is still forming..."
      return NextResponse.json({ insight })
    }

    return NextResponse.json({ error: 'No AI API key configured' }, { status: 500 })

  } catch (e) {
    console.error('[horizon] Unexpected error:', e)
    return NextResponse.json({ error: 'Failed to generate horizon' }, { status: 502 })
  }
}

