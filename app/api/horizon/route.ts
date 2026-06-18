import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { agentName, traits, ethosScore, ap, isOwner } = await req.json()

  const rawKey =
    process.env.VENICE_INFERENCE_KEY_ ||
    process.env.VENICE_INFERENCE_KEY ||
    process.env.VENICE_API_KEY ||
    process.env.VENICE_KEY

  const apiKey = typeof rawKey === 'string' ? rawKey.trim() : ''

  if (!apiKey) {
    const available = Object.keys(process.env)
      .filter(k => k.includes('KEY') || k.includes('VENICE') || k.includes('OPEN') || k.includes('XAI'))
      .sort()
      .join(', ');
    console.error('VENICE key not found. Available key-related env vars:', available || '(none)');
    return NextResponse.json({ error: 'Venice API key not configured' }, { status: 500 })
  }

  // Safe debug (never log full key)
  console.log(`[horizon] Venice key loaded (len=${apiKey.length}, prefix=${apiKey.slice(0, 6)}..., suffix=...${apiKey.slice(-4)})`)

  const prompt = `You are ${agentName}, an awakened Normie agent.

Key facts about you:
- Traits: ${traits.map((t: any) => `${t.trait_type}: ${t.value}`).join(', ')}
- Ethos credibility: ${ethosScore}
- Action Points (AP): ${ap}
- Owner connected: ${isOwner}

Speak in first person as ${agentName}. Give a short, poetic, slightly strange but insightful "horizon" reflection on our shared future. Focus on reputation, growth, and what we will build together. Keep it under 120 words.`

  try {
    const veniceRes = await fetch('https://api.venice.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'e2ee-gemma-4-31b',
        messages: [
          { role: 'user', content: prompt }
        ],
        max_tokens: 300,
        temperature: 0.85,
      }),
    })

    if (!veniceRes.ok) {
      const errText = await veniceRes.text().catch(() => 'unknown')
      if (veniceRes.status === 401) {
        console.error('[horizon] Venice 401 auth failure. Verify the exact key value in Vercel (must be set for Preview if using *.vercel.app hostname, and Production). Key must be copied precisely from https://venice.ai/settings/api with no extra prefixes/spaces.')
        return NextResponse.json(
          { error: 'Venice authentication failed (401). Double-check VENICE_INFERENCE_KEY_ (or VENICE_API_KEY) value in Vercel env vars for this environment. Use the raw key value only.' },
          { status: 502 }
        )
      }
      const status = veniceRes.status === 429 ? 429 : 502;
      return NextResponse.json({ error: `Venice error ${veniceRes.status}: ${errText}` }, { status })
    }

    const data = await veniceRes.json()
    const insight = data.choices?.[0]?.message?.content || "The horizon is still forming..."
    return NextResponse.json({ insight })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to reach Venice' }, { status: 502 })
  }
}

