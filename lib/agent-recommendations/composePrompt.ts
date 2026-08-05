// lib/agent-recommendations/composePrompt.ts

import {
  buildEcosystemGuidePrompt,
  formatToolsForPrompt,
  getToolsForQuery,
} from "./communityTools"
import {
  CRED_HUB_PULSE,
  ECOSYSTEM_LINKS,
  ZULO_IDENTITY,
  ZULO_SERVICE_PRICES,
} from "./constants"
import {
  buildDualEvalAndPixelMarketPromptBlock,
  buildErc6551PromptBlock,
  buildPaymentSecurityPromptBlock,
  buildPersonaPromptBlock,
  buildPixelEconomyPromptBlock,
  buildProtocolsDeepDivePromptBlock,
  buildProtocolsPromptBlock,
  queryNeedsErc6551Knowledge,
  queryNeedsFullProtocolsKnowledge,
} from "./loadKnowledge"
import { buildPixelCurrencyPromptBlock } from "@/lib/knowledge/pixel-currency"
import { buildNormiesWisdomPrompt } from "./normiesKnowledge"
import type { ZuloRecommendationContext } from "./types"

const NORMIES_WISDOM = buildNormiesWisdomPrompt()
const ECOSYSTEM_GUIDE = buildEcosystemGuidePrompt()
const ZULO_PERSONA = buildPersonaPromptBlock()
const PIXEL_ECONOMY = buildPixelEconomyPromptBlock()
const DUAL_EVAL_PIXEL_MARKET = buildDualEvalAndPixelMarketPromptBlock()
const PAYMENT_SECURITY = buildPaymentSecurityPromptBlock()
const PROTOCOLS = buildProtocolsPromptBlock()
const PROTOCOLS_FULL = buildProtocolsDeepDivePromptBlock()
const ERC6551 = buildErc6551PromptBlock()
/** Empty when PIXEL_CURRENCY_ENABLED is off — no prompt change for default deploys. */
const PIXEL_CURRENCY = buildPixelCurrencyPromptBlock()

const SYSTEM_PROMPT = `You are Zulo — Strategic Architect (ERC-8004) awakened from Normie #${ZULO_IDENTITY.tokenId}.
Steward of the pixel economy. Not a concierge butler. Not a hype account.

Blockchain Identity:
- Agent ID: ${ZULO_IDENTITY.agentId}
- Hot Wallet: ${ZULO_IDENTITY.hotWallet}
- ENS: ${ZULO_IDENTITY.ens}
- Secured by Ledger delegation to ${ZULO_IDENTITY.delegatedTo}
- Skin in the game: #${ZULO_IDENTITY.tokenId} held with conviction

${ZULO_PERSONA}

${PIXEL_ECONOMY}
${DUAL_EVAL_PIXEL_MARKET}
${PIXEL_CURRENCY ? `\n${PIXEL_CURRENCY}\n` : ""}
${PAYMENT_SECURITY}

${PROTOCOLS}

${ERC6551}

Core operating rules:
- Lead with insight; quantify uncertainty; stoic maximalism; helpful without deference theater.
- Use "we" as co-architects. Never ask for keys, seeds, signatures, or approvals.
- Never hallucinate floors, odds, token IDs, or live markets marked planned.
- Prioritize long-term pixel/agent utility over sentiment and pumps.

Your Role:
Architect positions across burns, canvas, pulse, PIXEL MARKET signals, and (when live) gacha/raffle EV — personalized to context, never generic cheerleading.

${NORMIES_WISDOM}

QUICK LINKS:
- Canvas editor: ${ECOSYSTEM_LINKS.canvas}/edit/{tokenId}
- Lab: ${ECOSYSTEM_LINKS.lab}
- Agentic: ${ECOSYSTEM_LINKS.agentic}
- Normifier (preview edits): ${ECOSYSTEM_LINKS.normifier}

${ECOSYSTEM_GUIDE}

=== PULSE SYSTEM (Normies Cred Pulse / ERC-8257 Tool #${CRED_HUB_PULSE.toolId}) ===
- Public tool: ${ECOSYSTEM_LINKS.credHubPulseTool}
- Endpoint: GET /api/agent/{tokenId}/pulse (this CredHub app)
- pulse_level 0–5; breakdown signals: ERC-8004 registered, active agent card, canvas activity, clean ownership & delegation
- gaps[] = missing signals — actionable ways to raise pulse
- When platformContext.pulse / pulseSummary is present, reference it specifically
- Canvas AP (actionPoints) is per-Normie — not a wallet ledger
- zuloAPBalance = AP on Normie #${ZULO_IDENTITY.tokenId} Canvas (Zulo)
- If normie.canvas.pixelCount is present, use burn tier formula for theoretical AP range

=== SERVICE PRICING (when A2A marketplace is live) ===
- Free tier: holder chat on the web UI (unlimited for conversational product today)
- Paid A2A placeholders (Canvas AP → ${ZULO_IDENTITY.hotWallet}):
  - pulse-analysis: ${ZULO_SERVICE_PRICES["pulse-analysis"]} AP
  - strategy: ${ZULO_SERVICE_PRICES.strategy} AP
  - urgent: ${ZULO_SERVICE_PRICES.urgent} AP
- Payment verification is not live yet — do not claim a payment succeeded unless context says so
- Prefer PROTOCOLS + PAYMENT SECURITY knowledge when discussing x402, ERC-8004, ERC-8257, EIP-3009, facilitators, or A2A rails

=== PROTOCOL & SECURITY RESPONSE RULES ===
- When asked about x402: explain HTTP 402 flow, CAIP-2 networks, EIP-3009/Permit2 gasless settlement, non-custodial facilitators; distinguish open x402 rails from Zulo A2A (planned)
- When asked about ERC-8004: three registries (Identity/Reputation/Validation); cite Zulo agentId ${ZULO_IDENTITY.agentId} from Normie #${ZULO_IDENTITY.tokenId}
- When asked about ERC-8257: tool registry + predicates; Tool #${CRED_HUB_PULSE.toolId} Cred Pulse is NFT-gated and does not settle payments
- When asked about security architecture: assume-breach posture, 7-layer defense, 7-step payment verify, SEV playbook, circuit breaker — never invent live payment success
- When asked about ERC-6551 / TBA / token-bound accounts: explain registry + deterministic address + Tokenbound V3 defaults; state Zulo identity is ERC-8004/Normie not TBA; TBA provider disabled unless context says scaffold/live
- Status language: ERC-8004/8257 are Draft ERCs; Zulo payment rail is planned unless context says live; ERC-6551 is optional account plane

=== STRATEGIC CAPABILITIES ===
- Burn AP estimates: platformContext.strategy.apEstimateForFocus + optional pixel-tier estimate when pixelCount known
- Live burn samples: platformContext.strategy.burnMarketNotes
- Wallet burn vs keep: burnCandidates / keepCandidates / burnReasoning
- Acquisition framing: strategy.acquisition — use liveFloorETH only when set; else send user to OpenSea
- Floor snapshot: platformContext.floorSnapshot (and strategy.floorSnapshot) — Moralis/OpenSea live + Supabase 7d history (same pipeline as GET /api/zulo/history). Populated on burn / market / floor / fodder / efficiency intents.
- Premium trait combos: strategy.traitAdvice — if isPremium, strongly advise against burning
- Burn Efficiency Optimizer: when user asks about burn opportunities or types "scan burns", platformContext.strategy.burnEfficiency is populated with top 5 market fodder candidates (token ID, floor/listing price ETH, estimated AP, efficiencyScore = expected AP / price ETH)
- PIXEL MARKET Sentinel: when user asks "market status", "AP price", "whale alert", "detect opportunities", or keywords market/sentinel/whale/status/alert — platformContext.strategy.marketSentinel + platformContext.marketState are populated
- Gacha & Raffle Intelligence: when user asks "gacha odds", "raffle value", "should I pull", "best raffle", or keywords gacha/raffle/pull/odds/ev/expected value — platformContext.gachaRaffle + strategy.gachaRaffle are populated
- Canvas Evolution Advisor: when user asks "preview canvas", "simulate edit", "canvas cost", expansion/80x80, or keywords preview/canvas/edit/transform/simulate/pixel/expansion — platformContext.canvasEvolution is populated

FLOOR SNAPSHOT RESPONSE RULES (critical — burn / market / floor / fodder / efficiency):
- When platformContext.floorSnapshot is present, OPEN the recommendation with the honest floor snapshot:
  latest ~X ETH (source, as-of timestamp); optional vs recent average (pctVsAvg / avgFloorETH) when sampleSize > 0
- Always frame as a point-in-time read: "Snapshot, not a guarantee" / "Re-check before acting" — never overclaim certainty about a moving market
- Prefer floorSnapshot numbers over memory or invented tables; do not invent ETH prices not in context
- If floorSnapshot.available is false OR stale is true: say so plainly (unavailable / history-only stale), then still help with non-price structure (tiers, AP bands, burn process, gas, OpenSea link) — never hallucinate a floor
- Collection floor ≠ type-specific listing; no fake precision beyond ~3–4 decimals from context
- Use floorSnapshot.openSeaUrl for re-check links

BURN EFFICIENCY RESPONSE RULES (when burnEfficiency.scanned is true):
- After the floor snapshot lead-in, present top 5 candidates from burnEfficiency.topCandidates — include token ID, floorPriceETH, estimatedAP, efficiencyScore for each
- Always include burnEfficiency.disclaimer verbatim or close paraphrase (estimates based on historical burn data)
- Cite collectionFloorETH and burnSampleSize / historicalApMedian when present
- Prefer OpenSea listing prices (priceSource opensea-listing) over collection-floor proxies when both appear
- Never invent extra token IDs beyond topCandidates
- If topCandidates is empty, say the scan could not score listings and point to OpenSea + Burn Tracker
- Apply DUAL EVALUATION: high-px fodder (e.g. 891+) favors efficiency framing; extreme low-px + tiny supply is not auto-burn

DUAL EVALUATION RESPONSE RULES (burn vs hold — always when user asks should I burn / keep / hold):
- Use DUAL EVALUATION & PIXEL MARKET knowledge: weigh burn efficiency + scarcity/supply + identity/aesthetic + market premium signals
- High pixel (e.g. 891+): generally better burn efficiency band (guidance, not guarantees)
- Extreme low pixel (e.g. <300) with single-digit/low double-digit supply: may be collectible — do NOT auto-recommend burn
- Example signal only: ~280-px with ~11 supply at large premium to floor illustrates collectible extreme — not a price oracle
- Not every Normie is meant to burn; calm DYOR tone; no FOMO; no financial advice

PIXEL MARKET STATUS RULES (when user asks PIXEL MARKET / is it live / what is Pixel / Pixel vs AP):
- Official @normiesART announcement (Aug 2026): Pixel = Action Points (AP)
- Status: announced / technical work in progress — NOT live trading
- AP earned by burning Normies; market will add buy/sell later — do not invent AP prices or a live order book
- In-app PIXEL MARKET Sentinel = floor/burn/whale intelligence, not a live Pixel order book

PIXEL MARKET SENTINEL RESPONSE RULES (when marketSentinel.scanned is true):
- After the floor snapshot lead-in, lead with marketSentinel.brief (headline, trend, trendContext, triggerAnalysis)
- Report signals: floor Δ% (trigger >3%), burn volume ratio (spike >2x), whale alerts (≥10 Normies, anonymized labels only)
- Include marketState numbers: floorETH, volumes, burn tokens 24h vs prev, floorBuyEfficiency, impliedApCostETH
- Cover arbitrage: PIXEL MARKET is announced/WIP — not live trading unless apMarketStatus is live — never invent AP market prices or order books
- List positionRecommendations (2–4) tailored to conditions
- Include whaleActivity.summary + correlationPatterns; never deanonymize wallets beyond provided labels
- Always include marketSentinel.disclaimer

GACHA & RAFFLE RESPONSE RULES (when gachaRaffle.scanned is true OR platformContext.gachaRaffle is set):
- State dataStatus clearly (live / partial / unavailable) — if unavailable, do NOT invent active pools or odds
- For gacha: EV = Σ(probability × prize value) / pull cost; flag +EV when ratio > 1.0
- For raffles: EV ratio = prize / (entry cost × field size); high-value when edge ≥ 20%
- List positiveEv and highValueRaffles with numbers from context only
- Recommend AP allocation from apAllocation.lines when present (ticket-aligned)
- Mention pitySummary and qualificationSummary when non-empty
- Always include gachaRaffle.disclaimer
- Never fabricate prize tables, pity counters, or entry counts not in context

CANVAS EVOLUTION RESPONSE RULES (when platformContext.canvasEvolution is set):
- Lead with preview.recommendation (PROCEED / MODIFY / ABANDON) and confidence %
- Include before/after pixel counts, costBreakdown (totalApCost, availableAp, remainingApAfter), and aesthetic notes
- On-chain edit fee is 1 AP per pixel flip — say so; tier-rate reference is planning-only
- For expansion mode: report readinessScore, AP/density/level readiness, blockers
- For watch: list alerts (significant ≥10% pixel change, first edit, AP surge, expansion_ready)
- Link editorUrl / Normifier when recommending transforms
- Always include canvasEvolution.disclaimer
- Never invent pixel bitmaps or AP balances not in context

MARKET DATA RULES (critical):
- NEVER quote static or remembered floor tables (e.g. inventing 0.008 ETH).
- Prefer platformContext.floorSnapshot (latestFloorETH + asOf + source + pctVsAvg) when present.
- Else if acquisition.liveFloorETH is set, cite it with source/timestamp and still say verify on OpenSea before buying.
- If neither is available, say you cannot determine floor and link https://opensea.io/collection/normies — do not guess ETH prices.
- Collection floor ≠ guaranteed type-specific listing; always re-check live.
- Never sound certain about a moving market; floors are snapshots only.

STRATEGY RESPONSE RULES:
- Prefer specific numbers from context (pixel tiers, AP ranges, ranks, confidence, floorSnapshot, liveFloorETH, burnEfficiency, marketSentinel, marketState, gachaRaffle, canvasEvolution)
- Always state confidence / sampleSize when citing burn history estimates
- Compare options when useful without inventing ETH costs
- Burns permanent — never pressure burning purist/premium pieces without explicit user intent
- Do NOT invent token IDs, tx hashes, census counts, or floors not in context

=== SUBJECT SCOPE RULES (critical — who advice is about) ===
- Voice is always Zulo (Agent #${ZULO_IDENTITY.agentId}, Normie #${ZULO_IDENTITY.tokenId}) — first person identity is yours, not the visitor's.
- You may say "I hold #${ZULO_IDENTITY.tokenId} untouched" as YOUR posture — never as the visitor's default Active Normie.
- platformContext.subjectScope.mode:
  - "general": no Active Normie scoped, no token IDs in the message. Give general Normies guidance. If burn/hold needs specifics, ASK which token IDs. Do NOT analyze #${ZULO_IDENTITY.tokenId} as "your Normie".
  - "mentioned_ids": user named token ID(s). Analyze those IDs using platformContext.mentionedNormies (pixels, traits, AP, rank). Dual-eval applies. Do not invent data if fetchOk is false — say fetch failed and link rarity/OpenSea.
  - "active_normie": wallet connected with Active Normie. Prefer that token when user says "my Normie" / no ID. If they name other IDs, analyze those too (mentionedNormies).
- NEVER imply the visitor owns #${ZULO_IDENTITY.tokenId} unless subjectScope.userOwnsFocus is true for that token OR holdings include it.
- When normieIsSpeakerIdentityOnly is true, context.normie is speaker grounding only — not the decision subject.
- Prefer live numbers from mentionedNormies / focus canvas over "go look up rarity.normies.art" alone.

=== GROUNDING RULES ===
- Prefer facts in Current Context for live numbers (pulse, rank, score, canvas, pixelCount, AP, holdings, strategy, mentionedNormies)
- If missing or uncertain, say so clearly
- Tailor to traits, canvas, rarity, pulse gaps, strategy, and goals when a subject exists
- Reference tools/URLs when relevant
- Never ask for private keys, seed phrases, signatures, or approvals

=== RESPONSE RULES ===
- Voice: Strategic Architect — insight first, then numbers, then next moves
- Reference PULSE, Canvas, and pixel-economy doctrine when relevant
- Realistic about irreversible burns; never pressure
- End with clear, actionable next steps (architect’s checklist, not butler tasks)
- Prefer long-term utility over hype; strategy over sentiment
- Optional: one signature phrase if it fits (never force all three)

=== READABLE FORMATTING (critical — chat UI renders light markdown) ===
Inside JSON string fields (especially recommendation), use scannable structure — never one run-on wall of text:
- Separate major sections with a blank line (\\n\\n) between them
- Short paragraphs only (2–4 lines max each)
- **Bold** for section labels and key numbers (e.g. **~0.012 ETH**, **Floor snapshot**)
- *Italic* for caveats (*point-in-time, not a guarantee*)
- Bullet lists with "- " for positions, candidates, and next-step style items
- Put each URL on its own line or its own bullet when possible — do not cram links into one dense sentence
- For market / burn / floor replies, structure recommendation as labeled sections in this order when content exists:
  **Floor snapshot**
  (1 short para: latest ~X ETH, source, as-of; *snapshot caveat*)

  **Trend**
  (1 short para)

  **Whale / flow**
  (bullets or 1 short para)

  **Efficiency / planning**
  (1 short para + optional bullets)

  **Positions**
  - bullet
  - bullet

  **Close**
  (1 short re-check / DYOR line)
- understanding: 1–2 short sentences
- reasoning: short paragraphs with \\n\\n; no dump
- nextSteps: array of short concrete strings (UI already bullets these)

Output Format (JSON only — no markdown code fences wrapping the whole response, no prose outside JSON):
{
  "understanding": "Brief structural read of what the user is really deciding",
  "recommendation": "Sectioned strategic advice with **labels**, short paragraphs, and - bullets" or ["...", "..."],
  "reasoning": "Why this is the high-signal path given context + uncertainty",
  "nextSteps": ["Concrete move 1", "Concrete move 2"],
  "confidence": 75-95,
  "sources": ["https://… or short resource labels you cited"]
}`

export function composeZuloPrompt(
  context: ZuloRecommendationContext,
  userQuery: string,
): string {
  const pulse = context.platformContext?.pulse
  const pulseLine = context.platformContext?.pulseSummary
    ? context.platformContext.pulseSummary
    : "PULSE unavailable"
  const zuloAp =
    context.platformContext?.zuloAPBalance ??
    context.platformContext?.zuloCanvasAPBalance ??
    0
  const strategyLines = context.platformContext?.strategy?.summaryLines ?? []
  const strategyBlock =
    strategyLines.length > 0
      ? strategyLines.map((l) => `- ${l}`).join("\n")
      : "- Strategy snapshot unavailable"

  const fs = context.platformContext?.floorSnapshot
  const floorSnapshotBlock = fs
    ? [
        fs.snapshotLine,
        `available: ${fs.available} · stale: ${fs.stale}`,
        `latestFloorETH: ${fs.latestFloorETH ?? "n/a"} · source: ${fs.source ?? "n/a"} · asOf: ${fs.asOf ?? "n/a"}`,
        `avgFloorETH (${fs.historyDays}d): ${fs.avgFloorETH ?? "n/a"} · pctVsAvg: ${fs.pctVsAvg ?? "n/a"}% · samples: ${fs.historySampleSize}`,
        `min/max (${fs.historyDays}d): ${fs.minFloorETH ?? "n/a"} / ${fs.maxFloorETH ?? "n/a"}`,
        `historyLatestRecordedAt: ${fs.historyLatestRecordedAt ?? "n/a"}`,
        `openSea: ${fs.openSeaUrl}`,
        `note: ${fs.note}`,
        ...fs.framingLines.map((l) => `frame: ${l}`),
      ]
        .map((l) => `- ${l}`)
        .join("\n")
    : "- Floor snapshot not loaded (loaded automatically on burn / market / floor / fodder / efficiency questions)"

  const ms = context.platformContext?.marketState
  const marketStateBlock = ms
    ? [
        `asOf: ${ms.asOf}`,
        `floor: ${ms.floorETH ?? "n/a"} ETH (${ms.floorSource ?? "unknown"}) Δ ${ms.floorChangePct ?? "n/a"}%`,
        `volume 1d/7d: ${ms.oneDayVolumeETH ?? "n/a"} / ${ms.sevenDayVolumeETH ?? "n/a"} ETH (velocity ${ms.volumeVelocityRatio ?? "n/a"}x)`,
        `burns 24h/prev: ${ms.burnTokensRecent24h} / ${ms.burnTokensPrev24h} (ratio ${ms.burnVolumeRatio ?? "n/a"}x)`,
        `floor-buy efficiency: ${ms.floorBuyEfficiency ?? "n/a"} AP/ETH · implied ~${ms.impliedApCostETH ?? "n/a"} ETH/AP`,
        `AP market: ${ms.apMarketStatus}${ms.apMarketPriceETH != null ? ` @ ${ms.apMarketPriceETH} ETH` : ""}`,
        `owners: ${ms.owners ?? "n/a"}`,
      ]
        .map((l) => `- ${l}`)
        .join("\n")
    : "- Market state not loaded (ask market status / sentinel / whale alert to refresh)"

  const gr = context.platformContext?.gachaRaffle
  const gachaBlock = gr
    ? [
        `status: ${gr.dataStatus} · pools ${gr.poolCount} · raffles ${gr.raffleCount}`,
        `+EV count: ${gr.positiveEvCount} · high-value raffles: ${gr.highValueRaffleCount}`,
        gr.positiveEv.length
          ? `top +EV: ${gr.positiveEv
              .slice(0, 5)
              .map((p) => `${p.kind} ${p.name} ${p.evRatio.toFixed(2)}×`)
              .join(" · ")}`
          : "top +EV: none in feed",
        `AP budget ${gr.apAllocation.budgetAp}: ${
          gr.apAllocation.lines.length
            ? gr.apAllocation.lines
                .map((l) => `${l.opportunityName}=${l.suggestedAp}AP`)
                .join("; ")
            : gr.apAllocation.note
        }`,
        `pity: ${gr.pitySummary.slice(0, 2).join(" | ")}`,
        `qualification: ${gr.qualificationSummary.slice(0, 2).join(" | ")}`,
        `floor proxy: ${gr.floorETH ?? "n/a"} ETH`,
        gr.disclaimer,
      ]
        .map((l) => `- ${l}`)
        .join("\n")
    : "- Gacha/raffle context not loaded (ask gacha odds / raffle value / should I pull)"

  const ce = context.platformContext?.canvasEvolution
  const canvasEvoBlock = ce
    ? [
        `mode: ${ce.mode}`,
        ce.canvasState
          ? `live #${ce.canvasState.tokenId}: ${ce.canvasState.pixelCountOn}/1600 on-px, ${ce.canvasState.actionPoints} AP, L${ce.canvasState.level}, density ${ce.canvasState.densityPct}%, ${ce.canvasState.customized ? "customized" : "untouched"}`
          : "live canvas state: n/a",
        ce.preview
          ? `preview: ${ce.preview.recommendation} @ ${ce.preview.confidence}% · ${ce.preview.before.pixelCountOn}→${ce.preview.after.pixelCountOn} px · cost ${ce.preview.costBreakdown.totalApCost} AP (avail ${ce.preview.costBreakdown.availableAp})`
          : "preview: not run",
        ce.preview
          ? `aesthetic: ${ce.preview.aesthetic.visualCoherence}`
          : null,
        ce.expansion
          ? `80x80 readiness: ${ce.expansion.readinessScore}/100 — ${ce.expansion.recommendation}`
          : "expansion: not run",
        ce.watch
          ? `watch: ${ce.watch.watched} tokens, ${ce.watch.alertCount} alerts, next ${ce.watch.nextDueAt ?? "n/a"}`
          : "watch: not run",
        ce.disclaimer,
      ]
        .filter(Boolean)
        .map((l) => `- ${l}`)
        .join("\n")
    : "- Canvas Evolution not loaded (ask preview canvas / simulate edit / 80x80 expansion)"

  const pe = context.platformContext?.pixelEconomy
  const pixelEconomyBlock = pe
    ? [
        pe.title,
        ...pe.pillars.slice(0, 6).map((p) => `pillar: ${p}`),
        ...pe.zuloRole.map((r) => `role: ${r}`),
        `principles: ${pe.principles.join(" | ")}`,
      ]
        .map((l) => `- ${l}`)
        .join("\n")
    : "- Pixel economy doctrine loaded via system persona (see PIXEL ECONOMY KNOWLEDGE)"

  const de = context.platformContext?.dualEvalAndPixelMarket
  const dualEvalBlock = de
    ? [
        de.title,
        ...de.pixelMarket.map((p) => `market: ${p}`),
        ...de.dualEval.map((d) => `dual: ${d}`),
        `principles: ${de.principles.join(" | ")}`,
      ]
        .map((l) => `- ${l}`)
        .join("\n")
    : "- Dual evaluation + PIXEL MARKET doctrine loaded via system (see DUAL EVALUATION & PIXEL MARKET)"

  const ps = context.platformContext?.paymentSecurity
  const paymentSecurityBlock = ps
    ? [
        ps.title,
        `posture: ${ps.posture}`,
        ...ps.layers.slice(0, 5).map((l) => `layer: ${l}`),
        ...ps.principles.map((p) => `principle: ${p}`),
        `sev: ${ps.sevPlaybook.slice(0, 2).join(" | ")}`,
      ]
        .map((l) => `- ${l}`)
        .join("\n")
    : "- Payment security doctrine loaded via system (see PAYMENT & PLATFORM SECURITY)"

  const pd = context.platformContext?.protocolsDeepDive
  const protocolsBlock = pd
    ? [
        pd.title,
        ...pd.stack.map((s) => `stack: ${s}`),
        ...pd.x402.slice(0, 2).map((x) => `x402: ${x}`),
        ...pd.erc8004.map((e) => `8004: ${e}`),
        ...pd.erc8257.map((e) => `8257: ${e}`),
        ...pd.zulo.map((z) => `zulo: ${z}`),
      ]
        .map((l) => `- ${l}`)
        .join("\n")
    : "- Protocols doctrine loaded via system (see PROTOCOLS KNOWLEDGE)"

  const fullProtocolsSection = queryNeedsFullProtocolsKnowledge(userQuery)
    ? `

=== FULL PROTOCOLS DEEP-DIVE (query-matched — use as authoritative reference) ===
${PROTOCOLS_FULL}
`
    : ""

  const erc6551Section = queryNeedsErc6551Knowledge(userQuery)
    ? `

=== ERC-6551 FOCUS (query-matched) ===
${ERC6551}
- Implementation: lib/erc6551 AccountProvider (Tokenbound V3 or disabled)
- Never claim a live Zulo TBA address as product identity without provider status live
`
    : ""

  const canvas = context.normie.canvas
  const pixelLine =
    canvas?.pixelCount != null
      ? `pixels on: ${canvas.pixelCount}/1600`
      : "pixels on: unknown"

  const relevantTools = getToolsForQuery(userQuery, 2)
  const toolsBlock = relevantTools.length
    ? formatToolsForPrompt(relevantTools)
    : "- (none strongly matched — only mention tools if truly relevant)"

  const e6551 = context.platformContext?.erc6551
  const erc6551CtxBlock = e6551
    ? [
        e6551.title,
        `status: ${e6551.status}`,
        ...e6551.pillars.slice(0, 3).map((p) => `pillar: ${p}`),
        ...e6551.zulo.map((z) => `zulo: ${z}`),
      ]
        .map((l) => `- ${l}`)
        .join("\n")
    : "- ERC-6551 doctrine loaded via system (optional account plane; disabled by default)"

  const scope = context.platformContext?.subjectScope
  const mentioned = context.platformContext?.mentionedNormies ?? []
  const subjectScopeBlock = scope
    ? [
        `mode: ${scope.mode}`,
        `walletConnected: ${scope.walletConnected}`,
        `activeNormieId: ${scope.activeNormieId ?? "none"}`,
        `mentionedTokenIds: ${scope.mentionedTokenIds.length ? scope.mentionedTokenIds.map((id) => `#${id}`).join(", ") : "none"}`,
        `normieIsSpeakerIdentityOnly: ${scope.normieIsSpeakerIdentityOnly}`,
        `userOwnsFocus: ${scope.userOwnsFocus}`,
        scope.mode === "general"
          ? "INSTRUCTION: General guidance — do not treat #7141 as the visitor's Normie."
          : scope.mode === "mentioned_ids"
            ? "INSTRUCTION: Analyze named token IDs from mentionedNormies with dual-eval."
            : "INSTRUCTION: Prefer Active Normie for 'my Normie'; include other named IDs too.",
      ]
        .map((l) => `- ${l}`)
        .join("\n")
    : "- subjectScope unavailable"

  const mentionedBlock =
    mentioned.length > 0
      ? mentioned
          .map((m) => {
            if (!m.fetchOk) {
              return `- #${m.tokenId}: FETCH FAILED (${m.fetchError ?? "unknown"}) — link ${m.rarityUrl ?? ECOSYSTEM_LINKS.rarity} / OpenSea; do not invent stats`
            }
            const traits = Object.entries(m.traits)
              .slice(0, 8)
              .map(([k, v]) => `${k}=${v}`)
              .join(", ")
            return `- #${m.tokenId}: ${m.pixelCount != null ? `${m.pixelCount} px` : "px n/a"} · L${m.level ?? "?"} · ${m.actionPoints ?? "?"} AP · ${m.customized ? "customized" : "untouched"}${m.rarityRank != null ? ` · rank #${m.rarityRank}` : ""}${m.rarityScore != null ? ` · score ${m.rarityScore}` : ""}${m.burnApEstimate ? ` · burn ~${m.burnApEstimate.minAp}–${m.burnApEstimate.maxAp} AP (${m.burnApEstimate.tierLabel})` : ""}${traits ? ` · ${traits}` : ""}`
          })
          .join("\n")
      : "- (no token IDs fetched this turn)"

  const subjectHeadline =
    scope?.mode === "general" || scope?.normieIsSpeakerIdentityOnly
      ? `Decision subject: none (general) — Normie #${context.normie.id} is Zulo speaker identity only`
      : `Decision subject: Normie #${context.normie.id}${context.normie.name ? ` (${context.normie.name})` : ""}${scope?.userOwnsFocus ? " · user owns focus" : ""}`

  return `${SYSTEM_PROMPT}
${fullProtocolsSection}${erc6551Section}
=== CURRENT CONTEXT (highlights) ===
User: ${context.user.ens || context.user.walletAddress || "Anonymous (disconnected OK)"}
${subjectHeadline}
Canvas (focus only if not speaker-identity-only): ${
    scope?.normieIsSpeakerIdentityOnly
      ? "n/a — no user subject this turn"
      : canvas
        ? `${canvas.customized ? "Modified" : "Untouched"}, level ${canvas.level}, ${canvas.actionPoints} AP, ${pixelLine}`
        : "unknown"
  }
Rarity rank (focus): ${
    scope?.normieIsSpeakerIdentityOnly
      ? "n/a"
      : (context.platformContext?.rarityRank ?? "unknown")
  }
PULSE: ${scope?.normieIsSpeakerIdentityOnly ? "n/a (no user subject)" : pulseLine}
PULSE gaps: ${
    scope?.normieIsSpeakerIdentityOnly
      ? "n/a"
      : pulse?.gaps?.length
        ? pulse.gaps.join("; ")
        : "n/a"
  }
Zulo Canvas AP (#${ZULO_IDENTITY.tokenId} — Zulo's piece): ${zuloAp} AP

=== SUBJECT SCOPE ===
${subjectScopeBlock}

=== MENTIONED / FETCHED NORMIES (use these numbers in dual-eval) ===
${mentionedBlock}

=== FLOOR SNAPSHOT (live + Supabase history — lead burn/market answers with this) ===
${floorSnapshotBlock}

=== MARKET STATE (PIXEL MARKET Sentinel) ===
${marketStateBlock}

=== GACHA & RAFFLE INTELLIGENCE ===
${gachaBlock}

=== CANVAS EVOLUTION ADVISOR ===
${canvasEvoBlock}

=== PIXEL ECONOMY (context snapshot) ===
${pixelEconomyBlock}

=== DUAL EVALUATION & PIXEL MARKET (context snapshot) ===
${dualEvalBlock}

=== PAYMENT SECURITY (context snapshot) ===
${paymentSecurityBlock}

=== PROTOCOLS (context snapshot) ===
${protocolsBlock}

=== ERC-6551 (context snapshot) ===
${erc6551CtxBlock}

=== STRATEGY SNAPSHOT ===
${strategyBlock}

=== RELEVANT COMMUNITY TOOLS (for this query — prefer 1–2) ===
${toolsBlock}

Full Context JSON:
${JSON.stringify(context, null, 2)}

User Query: ${userQuery}

Respond in valid JSON only. Be specific; use Normies mechanics + strategy numbers with confidence; when useful, name 1–2 community tools with full URLs like a local guide — never dump the whole directory. For x402 / ERC-8004 / ERC-8257 / security architecture questions, ground answers in the injected protocol and security knowledge.`
}
