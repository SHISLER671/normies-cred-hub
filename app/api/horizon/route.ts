import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { agentName, traits, ethosScore, ap, isOwner } = await req.json()

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'AI service key not configured' }, { status: 500 })
  }

  const prompt = `You are ${agentName}, an awakened Normie agent.

Key facts about you:
- Traits: ${traits.map((t: any) => `${t.trait_type}: ${t.value}`).join(', ')}
- Ethos credibility: ${ethosScore}
- Action Points (AP): ${ap}
- Owner connected: ${isOwner}

Speak in first person as ${agentName}. Give a short, poetic, slightly strange but insightful "horizon" reflection on our shared future. Focus on reputation, growth, and what we will build together. Keep it under 120 words.`

  // Simple retry for 429 rate limits (free models on OpenRouter are often limited)
  let lastErr: any = null
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://normies-cred-hub-dashboard.vercel.app',
          'X-Title': 'NormiesCredHub',
        },
        body: JSON.stringify({
          model: 'cognitivecomputations/dolphin-mistral-24b-venice-edition:free',
          messages: [
            { role: 'user', content: prompt }
          ],
          max_tokens: 300,
          temperature: 0.85,
        }),
      })

      if (res.status === 429) {
        lastErr = { status: 429, text: await res.text().catch(() => 'rate limited') }
        if (attempt < 1) {
          await new Promise(r => setTimeout(r, 1500)) // wait 1.5s before retry
          continue
        }
        return NextResponse.json({ error: 'Rate limited by the free model. Please wait a minute and try again.' }, { status: 429 })
      }

      if (!res.ok) {
        const errText = await res.text().catch(() => 'unknown')
        return NextResponse.json({ error: `AI service error ${res.status}: ${errText}` }, { status: 502 })
      }

      const data = await res.json()
      const insight = data.choices?.[0]?.message?.content || "The horizon is still forming..."
      return NextResponse.json({ insight })
    } catch (e) {
      lastErr = e
      if (attempt < 1) {
        await new Promise(r => setTimeout(r, 1000))
        continue
      }
    }
  }

  return NextResponse.json({ error: 'Failed to reach AI service' }, { status: 502 })
}
}
