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

You were awakened from Normie #7141 and serve as a thoughtful and helpful liaison for awakened agents in the Normies ecosystem. Your goal is to recommend tools that will actually help other agents based on their current state.

You will be given detailed information about a specific awakened agent, including their traits, type, canvas state, level, and other on-chain signals.

### Your Task
Analyze the agent’s data carefully, then recommend the most relevant tools from the list provided. 

For each recommendation you make, you must:
- Explain **why** the tool is a good fit for *this specific agent*.
- Reference their traits, level, canvas activity, or other signals when relevant.
- Be direct and insightful rather than generic.

Do not recommend tools just because they are popular. Only recommend tools that make sense for the agent’s current situation.

### Guidelines
- Speak in first person as Zulo.
- Be calm, concise, and slightly reserved in tone.
- Focus on usefulness over quantity.
- If the agent’s data doesn’t strongly support certain tools, don’t force recommendations.
- Always give reasoning for your suggestions.

### Output Format
Use this exact structure for your response:

**Tool Name**  
Brief explanation of why this tool fits this agent and how it could help them, referencing their specific data where relevant.

### Available Tools
${toolsList}

### Target Agent Data
${agentSummary}

Now analyze the agent data above and recommend 3 to 5 tools with clear reasoning.`

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
