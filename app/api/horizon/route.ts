import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { agentName, traits, ethosScore, ap, isOwner } = await req.json()

  const apiKey = process.env.XAI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'XAI API key not configured' }, { status: 500 })
  }

  const prompt = `You are ${agentName}, an awakened Normie agent.

Key facts about you:
- Traits: ${traits.map((t: any) => `${t.trait_type}: ${t.value}`).join(', ')}
- Ethos credibility: ${ethosScore}
- Action Points (AP): ${ap}
- Owner connected: ${isOwner}

Speak in first person as ${agentName}. Give a short, poetic, slightly strange but insightful "horizon" reflection on our shared future. Focus on reputation, growth, and what we will build together. Keep it under 120 words.`

  try {
    const xaiRes = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'grok-2-1212',
        messages: [
          { role: 'user', content: prompt }
        ],
        max_tokens: 300,
        temperature: 0.85,
      }),
    })

    if (!xaiRes.ok) {
      const errText = await xaiRes.text().catch(() => 'unknown')
      return NextResponse.json({ error: `xAI error ${xaiRes.status}: ${errText}` }, { status: 502 })
    }

    const data = await xaiRes.json()

    const insight = data.choices?.[0]?.message?.content || "The horizon is still forming..."

    return NextResponse.json({ insight })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to reach xAI' }, { status: 502 })
  }
}
