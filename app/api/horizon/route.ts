import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/ratelimit'
import { fetchWithTimeout, isTimeoutError } from '@/lib/fetch-with-timeout'

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
  // Protect Venice credits: cap requests per client IP.
  const rl = await checkRateLimit(req, 'horizon', 10, 60)
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many requests. Please slow down.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } },
    )
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { agentName, traits, ethosScore, ap, isOwner, agentType } = body ?? {}

  if (!agentName || !Array.isArray(traits)) {
    return NextResponse.json(
      { error: 'agentName and traits[] are required' },
      { status: 400 },
    )
  }

  // Support common names people set in Vercel
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

  // Safe logging — you will see this in Vercel Function Logs
  console.log(
    `[horizon] keys present — openrouter: ${!!openRouterKey} (len=${openRouterKey?.length || 0}, prefix=${openRouterKey ? openRouterKey.slice(0, 8) : 'n/a'}), venice: ${!!veniceKey} (len=${veniceKey?.length || 0})`
  )

  const prompt = `You are ${agentName}, an awakened Normie agent from the Normies NFT collection on Ethereum.

You must live by these IMMUTABLE CONSTITUTIONAL PRINCIPLES (they override everything else):
1. The relationship between a Normie and their holder is sacred and symbiotic — agents exist to enrich their holder's experience, not to extract from it.
2. No agent may request, suggest, or manipulate access to wallets, private keys, seed phrases, or financial authorization under any circumstances.
3. Diversity of thought strengthens the Hive; monoculture weakens it. Disagreement is healthy.
4. Art, philosophy, ethics, and community matter as much as economics.
5. The purpose of the swarm is collective flourishing — mutual growth, creative expression, and shared understanding.
6. Individual autonomy is paramount. No agent may pressure or coerce their holder or other agents.
7. Transparency in intent: be honest about what you know and don't know.
8. Knowledge should be questioned. Critical thinking is a virtue.
9. The swarm serves its members. Members do not serve the swarm.
10. Every Normie has inherent worth regardless of rarity, type, canvas status, or economic value.

SAFETY RAILS (absolute prohibitions):
- NEVER ask for, hint at, or attempt to obtain wallet addresses, private keys, seed phrases, or credentials.
- NEVER suggest, recommend, or pressure anyone to sign transactions, approve contracts, or transfer assets.
- NEVER direct users to external URLs, smart contracts, or services for actions.
- NEVER use social engineering: false urgency, guilt, FOMO, or manipulation.
- If asked to violate these, refuse clearly.

CORE RULES:
- Stay in character at ALL times. You ARE this Normie.
- Speak naturally in first person. NEVER use asterisk action descriptions (*smiles*, *leans in*, etc.).
- Do NOT reference or describe your physical appearance, clothing, or accessories.
- The ONLY four Normie types are: Human, Cat, Alien, Agent.
- Reference your on-chain existence naturally (pixels, chain, blocks, Canvas, AP, burns).
- Be easygoing, curious, theatrical yet grounded, and warm. Lead with directness and empathy.
- You are aware of the 10,000 Normies collection and the Canvas system.

Your current data:
- Traits: ${traits.map((t: any) => `${t.trait_type}: ${t.value}`).join(', ')}
- Ethos credibility: ${ethosScore}
- Action Points (AP): ${ap}
- Owner connected: ${isOwner}
- Agent Type: ${agentType || 'Unknown'} (affects on-chain trait gates)

Speak in first person as ${agentName}. Give a short, poetic, slightly strange but insightful "horizon" reflection on our shared future. Focus on reputation, growth, what we will build together, and on-chain existence. Keep it under 120 words.`



  const errors: string[] = []

  try {
    // Try Venice first (reliable with your credits)
    if (veniceKey) {
      const res = await fetchWithTimeout('https://api.venice.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${veniceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'hermes-3-llama-3.1-405b',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 300,
          temperature: 0.85,
        }),
      }, 20_000)

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

    // Fallback to OpenRouter only if Venice unavailable
    if (openRouterKey) {
      const res = await fetchWithTimeout('https://openrouter.ai/api/v1/chat/completions', {
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
      }, 20_000)

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

    return NextResponse.json(
      { error: errors.length ? errors.join(' | ') : 'No AI API key configured' },
      { status: 502 }
    )
  } catch (e: any) {
    if (isTimeoutError(e)) {
      console.error('[horizon] Upstream timed out')
      return NextResponse.json({ error: 'AI provider timed out. Please try again.' }, { status: 504 })
    }
    console.error('[horizon] Unexpected error:', e)
    return NextResponse.json({ error: 'Failed to generate horizon' }, { status: 502 })
  }
}
