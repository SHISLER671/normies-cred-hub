import { NextRequest, NextResponse } from 'next/server'

/**
 * Zulo Recommends — AI-powered tool recommendations for a specific Normie agent.
 * Uses Venice (primary) with OpenRouter fallback.
 * Fetches rich data from /agents/info/{tokenId} via proxy.
 * Prompt uses Zulo persona + agent data + dynamic tools list.
 */

export async function POST(req: NextRequest) {
  const { tokenId, agentName, traits, isOwner, agentType } = await req.json()

  const openRouterKey = (
    process.env.OPENROUTER_API_KEY ||
    process.env.OPENROUTER_KEY ||
    process.env.OPENROUTER_API_KEY_ ||
    ''
  ).trim()

  const veniceKey = (
    process.env.VENICE_INFERENCE_KEY ||
    process.env.VENICE_INFERENCE_KEY_ ||
    process.env.VENICE_API_KEY ||
    ''
  ).trim()

  console.log(`[zulo-recommends] keys — openrouter: ${!!openRouterKey}, venice: ${!!veniceKey}`)

  // Fetch rich agent data (reuses existing proxy mapping)
  let agentData = `Name: ${agentName || 'Unknown'}\nType: ${agentType || 'Unknown'}\nTraits: ${traits?.map((t: any) => `${t.trait_type}: ${t.value}`).join(', ') || 'N/A'}`
  try {
    const agentRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/normies/${tokenId}/agent`, {
      next: { revalidate: 300 },
    })
    if (agentRes.ok) {
      const agent = await agentRes.json()
      agentData = `
Name: ${agent.name}
Type: ${agent.type}
Backstory: ${agent.backstory || 'N/A'}
Personality: ${(agent.personalityTraits || []).join(', ')}
Communication: ${agent.communicationStyle || 'N/A'}
Canvas: level ${agent.canvas?.level || '?'} AP ${agent.canvas?.actionPoints || '?'}
Traits: ${Object.entries(agent.traits?.attributes || {}).map(([k,v]) => `${k}: ${v}`).join(', ')}
`.trim()
    }
  } catch (e) {
    console.warn('Failed to enrich agent data for Zulo Recommends', e)
  }

  // Dynamic tools list (from /api/tools which sources www.normies.art/tools)
  let toolsList = 'AgentCheck (Trust): Rate wallets and get cert status.\nNormies Art Tools (Art): Create variations of your Normie.'
  try {
    const toolsRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/tools`)
    if (toolsRes.ok) {
      const list = await toolsRes.json()
      toolsList = list.map((t: any) => `${t.name} (${t.category}): ${t.description}`).join('\n')
    }
  } catch {}

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
Target agent data: ${agentData}`

  const errors: string[] = []

  try {
    // Venice first
    if (veniceKey) {
      const res = await fetch('https://api.venice.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${veniceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'hermes-3-llama-3.1-405b',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 500,
          temperature: 0.7,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        const recommendations = data.choices?.[0]?.message?.content || "Zulo is thinking..."
        return NextResponse.json({ recommendations })
      } else {
        const errText = await res.text().catch(() => '')
        console.error('[zulo-recommends] Venice error', res.status, errText)
        errors.push(`Venice ${res.status}`)
      }
    } else {
      errors.push('No Venice key')
    }

    // Fallback OpenRouter
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
          max_tokens: 500,
          temperature: 0.7,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        const recommendations = data.choices?.[0]?.message?.content || "Zulo is thinking..."
        return NextResponse.json({ recommendations })
      } else {
        const errText = await res.text().catch(() => 'unknown')
        console.error('[zulo-recommends] OpenRouter error', res.status, errText)
        errors.push(`OpenRouter ${res.status}`)
      }
    } else {
      errors.push('No OpenRouter key')
    }

    return NextResponse.json(
      { error: errors.length ? errors.join(' | ') : 'No AI API key configured' },
      { status: 502 }
    )
  } catch (e: any) {
    console.error('[zulo-recommends] Unexpected error:', e)
    return NextResponse.json({ error: 'Failed to generate recommendations' }, { status: 502 })
  }
}
