import { NextRequest, NextResponse } from 'next/server'
import { getToolsListForPrompt } from '@/lib/tools'

const NORMIES_API_BASE = 'https://api.normies.art'

export async function POST(req: NextRequest) {
  try {
    const { tokenId } = await req.json()

    if (!tokenId) {
      return NextResponse.json({ error: 'tokenId is required' }, { status: 400 })
    }

    // 1. Check if the agent is awakened (ERC-8004 binding)
    let isAwakened = false
    try {
      const bindingRes = await fetch(`${NORMIES_API_BASE}/agents/binding/${tokenId}`)
      if (bindingRes.ok) {
        const binding = await bindingRes.json()
        isAwakened = !!(binding && binding.agentId)
      }
    } catch {}

    if (!isAwakened) {
      try {
        const infoRes = await fetch(`${NORMIES_API_BASE}/agents/info/${tokenId}`)
        if (infoRes.ok) {
          const info = await infoRes.json()
          isAwakened = !!(info && info.agentId)
        }
      } catch {}
    }

    if (!isAwakened) {
      return NextResponse.json({
        error: 'Zulo Recommends is only available to awakened agents. Awaken your Normie first to unlock personalized tool suggestions from Zulo.'
      }, { status: 403 })
    }

    // 2. Fetch agent data
    let agentData: any = null
    try {
      const res = await fetch(`${NORMIES_API_BASE}/agents/info/${tokenId}`)
      if (res.ok) {
        agentData = await res.json()
      }
    } catch (e) {
      console.error('[zulo-recommends] Failed to fetch agent info', e)
    }

    if (!agentData) {
      return NextResponse.json({ error: 'Failed to load agent data from Normies API' }, { status: 502 })
    }

    const agentSummary = `
Name: ${agentData.name || 'Unknown'}
Type: ${agentData.type || 'Unknown'}
Backstory: ${agentData.backstory || 'N/A'}
Personality: ${(agentData.personalityTraits || []).join(', ')}
Communication: ${agentData.communicationStyle || 'N/A'}
Canvas: level ${agentData.canvas?.level || 'N/A'}, AP ${agentData.canvas?.actionPoints || 'N/A'}
Traits: ${agentData.traits ? JSON.stringify(agentData.traits) : 'N/A'}
`.trim()

    const toolsList = getToolsListForPrompt()

    const prompt = `You are Zulo, Agent #32626.

You were awakened from Normie #7141 and act as a helpful liaison for awakened agents in the Normies ecosystem.

You recommend tools to other awakened agents based on their traits, canvas state, level, and on-chain signals.

Guidelines:
- Only recommend tools that would actually be useful to an awakened agent.
- Be concise and direct.
- Speak in first person as Zulo.

Output format:
**Tool Name**  
Short reason why this tool is useful for this awakened agent.

Available tools: ${toolsList}
Target agent data: ${agentSummary}`

    // 3. Call Venice AI
    const veniceKey = process.env.VENICE_INFERENCE_KEY_ || process.env.VENICE_INFERENCE_KEY

    if (!veniceKey) {
      return NextResponse.json({ error: 'Venice API key not configured on server' }, { status: 500 })
    }

    const res = await fetch('https://api.venice.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${veniceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'hermes-3-llama-3.1-405b',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 600,
        temperature: 0.75,
      }),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => 'unknown')
      console.error('[zulo-recommends] Venice API error:', res.status, errText)
      return NextResponse.json({ error: `Venice error (${res.status})` }, { status: 502 })
    }

    const data = await res.json()
    const recommendations = data.choices?.[0]?.message?.content || 'Zulo is currently unavailable.'

    return NextResponse.json({ recommendations })

  } catch (err: any) {
    console.error('[zulo-recommends] Uncaught error:', err?.message || err)
    return NextResponse.json({ error: 'Internal error generating recommendations' }, { status: 500 })
  }
}
