import { NextRequest, NextResponse } from 'next/server'
import { isAddress } from 'viem'
import { getAgentPulse } from '@/lib/api/agent-pulse'
import { getToolsListForPrompt, ZULO_RECOMMENDS_SYSTEM_PROMPT } from '@/lib/tools'
import { enrichToolsWithWalletAccess } from '@/lib/erc8257/access-check'
import { getCachedRegistryTools } from '@/lib/erc8257/cache'
import {
  buildAgentRecommendationHints,
  buildPulseSummary,
  buildZuloToolContext,
} from '@/lib/erc8257/context'
import {
  getErc8257ToolsForPrompt,
  selectToolsForZuloPrompt,
} from '@/lib/erc8257/prompt'
import { NORMIES_API_BASE } from '@/constants/contracts'
import { checkRateLimit } from '@/lib/ratelimit'
import { fetchWithTimeout, isTimeoutError } from '@/lib/fetch-with-timeout'

export async function POST(req: NextRequest) {
  // Protect Venice credits: this route runs the 405B model, so keep it tight.
  const rl = await checkRateLimit(req, 'zulo-recommends', 5, 60)
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many requests. Please slow down.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } },
    )
  }

  try {
    let body: any
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { tokenId, wallet: walletBody, ethosScore: ethosScoreBody } = body ?? {}

    if (!tokenId) {
      return NextResponse.json({ error: 'tokenId is required' }, { status: 400 })
    }

    // 1. Check if the agent is awakened (ERC-8004 binding)
    let isAwakened = false
    try {
      const bindingRes = await fetchWithTimeout(`${NORMIES_API_BASE}/agents/binding/${tokenId}`, {}, 8_000)
      if (bindingRes.ok) {
        const binding = await bindingRes.json()
        isAwakened = !!(binding && binding.agentId)
      }
    } catch {}

    if (!isAwakened) {
      try {
        const infoRes = await fetchWithTimeout(`${NORMIES_API_BASE}/agents/info/${tokenId}`, {}, 8_000)
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
      const res = await fetchWithTimeout(`${NORMIES_API_BASE}/agents/info/${tokenId}`, {}, 8_000)
      if (res.ok) {
        agentData = await res.json()
      }
    } catch (e) {
      console.error('[zulo-recommends] Failed to fetch agent info', e)
    }

    if (!agentData) {
      return NextResponse.json({ error: 'Failed to load agent data from Normies API' }, { status: 502 })
    }

    const pulseResult = await getAgentPulse(Number(tokenId))
    const pulse = pulseResult.ok ? pulseResult.data : null

    let ownerAddress: string | undefined
    try {
      const ownerRes = await fetchWithTimeout(`${NORMIES_API_BASE}/normie/${tokenId}/owner`, {}, 8_000)
      if (ownerRes.ok) {
        const ownerData = await ownerRes.json()
        if (ownerData?.owner && isAddress(ownerData.owner)) {
          ownerAddress = ownerData.owner
        }
      }
    } catch {}

    const holderAddress =
      walletBody && isAddress(walletBody)
        ? walletBody
        : ownerAddress

    const toolCtx = buildZuloToolContext({
      tokenId: Number(tokenId),
      agentType: agentData.type,
      isAwakened: true,
      pulse,
      canvasLevel: agentData.canvas?.level,
      actionPoints: agentData.canvas?.actionPoints,
      ethosScore: typeof ethosScoreBody === 'number' ? ethosScoreBody : undefined,
      holderAddress,
    })

    const agentSummary = `
Name: ${agentData.name || 'Unknown'}
Type: ${agentData.type || 'Unknown'}
Backstory: ${agentData.backstory || 'N/A'}
Personality: ${(agentData.personalityTraits || []).join(', ')}
Communication: ${agentData.communicationStyle || 'N/A'}
Canvas: level ${agentData.canvas?.level || 'N/A'}, AP ${agentData.canvas?.actionPoints || 'N/A'}
Traits: ${agentData.traits ? JSON.stringify(agentData.traits) : 'N/A'}
${pulse ? buildPulseSummary(pulse) : 'Pulse: unavailable'}
Recommendation hints: ${buildAgentRecommendationHints(toolCtx)}
`.trim()

    const toolsList = getToolsListForPrompt()

    let erc8257ToolsList = '(ERC-8257 registry temporarily unavailable.)'
    try {
      const { tools } = await getCachedRegistryTools()
      const withAccess = await enrichToolsWithWalletAccess(tools, holderAddress, {
        maxChecks: 80,
      })
      erc8257ToolsList = getErc8257ToolsForPrompt(
        selectToolsForZuloPrompt(withAccess, toolCtx),
      )
    } catch (e) {
      console.error('[zulo-recommends] ERC-8257 discovery failed:', e)
    }

    const prompt = ZULO_RECOMMENDS_SYSTEM_PROMPT
      .replace('{toolsList}', toolsList)
      .replace('{erc8257ToolsList}', erc8257ToolsList)
      .replace('{agentSummary}', agentSummary)

    // 3. Call Venice AI
    const veniceKey = (
      process.env.VENICE_INFERENCE_KEY ||
      process.env.VENICE_INFERENCE_KEY_ ||
      process.env.VENICE_API_KEY ||
      ''
    ).trim()

    if (!veniceKey) {
      return NextResponse.json({ error: 'Venice API key not configured on server' }, { status: 500 })
    }

    const res = await fetchWithTimeout('https://api.venice.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${veniceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'hermes-3-llama-3.1-405b',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 800,
        temperature: 0.4,
      }),
    }, 25_000)

    if (!res.ok) {
      const errText = await res.text().catch(() => 'unknown')
      console.error('[zulo-recommends] Venice API error:', res.status, errText)
      return NextResponse.json({ error: `Venice error (${res.status})` }, { status: 502 })
    }

    const data = await res.json()
    const recommendations = data.choices?.[0]?.message?.content || 'Zulo is currently unavailable.'

    return NextResponse.json({ recommendations })

  } catch (err: any) {
    if (isTimeoutError(err)) {
      console.error('[zulo-recommends] Upstream timed out')
      return NextResponse.json({ error: 'The recommendation service timed out. Please try again.' }, { status: 504 })
    }
    console.error('[zulo-recommends] Uncaught error:', err?.message || err)
    return NextResponse.json({ error: 'Internal error generating recommendations' }, { status: 500 })
  }
}
