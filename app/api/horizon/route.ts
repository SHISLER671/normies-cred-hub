import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { agentName, traits, ethosScore, ap, isOwner } = await req.json()

  const apiKey = process.env.VENICE_INFERENCE_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Venice API key not configured' }, { status: 500 })
  }

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
        model: 'llama-3.1-8b',
        messages: [
          { role: 'user', content: prompt }
        ],
        max_tokens: 300,
        temperature: 0.85,
      }),
    })

    if (!veniceRes.ok) {
      const errText = await veniceRes.text().catch(() => 'unknown')
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

