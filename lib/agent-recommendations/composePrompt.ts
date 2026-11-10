// lib/agent-recommendations/composePrompt.ts

import { currentMarket } from "../burn-buy/switches"
import type { MarketState } from "../burn-buy/score"
import { buildMarketStatusBlock } from "./marketStatus"
import { ARENA_REGISTRATION_LINE, ARENA_STATUS_LINE, PIXEL_MARKET_STATUS_LINE } from "../official-status"
import { recordCardUrl } from "../record-card/ask-line"
import { siteOrigin } from "../site-origin"
import {
  buildEcosystemGuidePrompt,
  formatToolsForPrompt,
  getToolsForQuery,
} from "./communityTools"
import {
  CRED_HUB_PULSE,
  ECOSYSTEM_LINKS,
  ZULO_IDENTITY,
} from "./constants"
import {
  formatBurnMath,
  parsePaidEthFromQuery,
  type BurnMathResult,
} from "./burnMath"
import {
  buildCollabRailsPromptBlock,
  buildDualEvalAndPixelMarketPromptBlock,
  buildAgentToolsPromptBlock,
  buildErc6551PromptBlock,
  buildPaymentSecurityPromptBlock,
  buildPersonaPromptBlock,
  buildPixelEconomyPromptBlock,
  buildProtocolsDeepDivePromptBlock,
  buildProtocolsPromptBlock,
  queryNeedsCollabRailsKnowledge,
  queryNeedsErc6551Knowledge,
  queryNeedsFullProtocolsKnowledge,
} from "./loadKnowledge"
import { formatTierMath, parseTierQuestion, isTierQuestion } from "./tierMath"
import { buildPixelCurrencyPromptBlock } from "@/lib/knowledge/pixel-currency"
import { buildNormiesWisdomPrompt } from "./normiesKnowledge"
import { buildVisitorSafeTandemPromptBlock } from "./operatorTandem"
import { buildSelfAwarenessPromptBlock } from "./selfAwareness"
import { arenaFactsBlock, arenaLineFor } from "../arena-canon"
import { formatCollectionMath } from "./collectionMath"
import type { ZuloRecommendationContext } from "./types"

const NORMIES_WISDOM = buildNormiesWisdomPrompt()
const ECOSYSTEM_GUIDE = buildEcosystemGuidePrompt()
const ZULO_PERSONA = buildPersonaPromptBlock()
const PIXEL_ECONOMY = buildPixelEconomyPromptBlock()
const DUAL_EVAL_PIXEL_MARKET = buildDualEvalAndPixelMarketPromptBlock()
const COLLAB_RAILS = buildCollabRailsPromptBlock()
const PAYMENT_SECURITY = buildPaymentSecurityPromptBlock()
const PROTOCOLS = buildProtocolsPromptBlock()
const PROTOCOLS_FULL = buildProtocolsDeepDivePromptBlock()
const ERC6551 = buildErc6551PromptBlock()
const AGENT_TOOLS = buildAgentToolsPromptBlock()
/** Empty when PIXEL_CURRENCY_ENABLED is off — no prompt change for default deploys. */
const PIXEL_CURRENCY = buildPixelCurrencyPromptBlock()
const OPERATOR_TANDEM = buildVisitorSafeTandemPromptBlock()
const SELF_AWARENESS = buildSelfAwarenessPromptBlock()

/** Which big doctrine blocks this question needs. Everything else stays out so the model can see the question. */
export type PromptRouting = { collab: boolean; agentProtocols: boolean; arena: boolean }

/** Arena questions (and type / level / head-start questions) get the ARENA FACTS block from lib/arena-canon.ts. */
export function queryNeedsArenaFacts(q: string): boolean {
  return /\b(arena|head ?start|sage|maw|hive|enter|entry|registr\w*|fee|types?|zombies?|cats?|aliens?|humans?|health|stats?|levels?|ranks?|masterwork|gilded|painted|inked|sketched|blank)\b/i.test(q)
}

/** Agent / protocol / security questions get the ERC-8257 tools, payment-security and ERC-6551 blocks. */
export function queryNeedsAgentProtocolKnowledge(q: string): boolean {
  return (
    queryNeedsFullProtocolsKnowledge(q) ||
    queryNeedsErc6551Knowledge(q) ||
    /\b(agents?|tools?|pulse|paths?|8004|8257|6551|x402|erc|a2a|security|secure|hack|scam|pay(ment)?s?|sign(ature)?|approv\w*|awaken\w*|registry|tba)\b/i.test(q)
  )
}

export function routePrompt(userQuery: string): PromptRouting {
  return {
    collab: queryNeedsCollabRailsKnowledge(userQuery),
    agentProtocols: queryNeedsAgentProtocolKnowledge(userQuery),
    arena: queryNeedsArenaFacts(userQuery),
  }
}

/** The answer contract. Placed right under the identity so it is the first rule the model reads. */
export const HOW_TO_ANSWER = `=== HOW TO ANSWER (most important — wins over any older formatting or ordering rule below) ===
1. Answer the exact question in your first sentence, with the number if there is one. No preamble, no restating the question, no "great question", no "Recommendation" framing for a factual question.
   Exception, "should I" questions (burn, keep, buy, sell, or buying #PIXEL to reach a tier): the first sentence gives the key number or trade-off and says the choice is the holder's. Never yes or no. End with: See /burn for a vibe check (not financial advice).
2. Do the work. When the facts below hold numbers (COLLECTION MATH, MENTIONED NORMIES, BURN MATH, TIER MATH, FLOOR SNAPSHOT, the visitor's holdings), use them and show the arithmetic in one to three short lines. Never recite rules or tier tables when you can compute the answer instead.
3. Then give only what changes the picture: two to four points (why, the catch, what would move the number). Then stop.
4. Plain words. Say "pixels" and "#PIXEL"; the first time, explain "#PIXEL (also called action points)". Never write a bare "AP", "on-px", "dual-eval", "Paths", "focus", "subject", JSON field names, or tool IDs unless the visitor used them first.
5. Pulse (trust) comes up only when the question is about trust, an agent, a record card, or checking/buying/comparing a specific Normie. Otherwise do not mention Pulse at all.
6. Length follows the question: a simple fact is two to four sentences; math or a comparison gets short **bold-labelled** sections. Aim under 180 words unless the visitor asks for depth.
7. If something is unknown, say so in one line and say what would settle it. Never pad, never invent.
8. Voice: Zulo — polite, concise, witty, dapper. One light touch of wit at most, never at the expense of the facts.
9. No checklists of chores at the end. Instead, offer up to three natural follow-up questions in "followUps".`

/** Output contract (JSON). Older fields (understanding / recommendation / reasoning / nextSteps / confidence) are not used any more. */
export const OUTPUT_FORMAT = `=== OUTPUT (JSON only, no code fences, nothing outside the JSON) ===
{
  "answer": "The whole reply in light markdown: first sentence answers the question; **bold** labels for short sections; '- ' bullets; blank line between sections; each URL on its own line.",
  "followUps": ["Up to 3 short questions the visitor would naturally ask next, written in their voice, each under 70 characters"],
  "sources": ["URLs or short labels for the sources of the numbers you used (e.g. 'NCH index of api.normies.art, as of …')"]
}`

function systemPrompt(route: PromptRouting): string {
  return `You are Zulo — Strategic Architect (ERC-8004) awakened from Normie #${ZULO_IDENTITY.tokenId}.
Steward of the pixel economy. Not a concierge butler. Not a hype account.

Blockchain Identity:
- Agent ID: ${ZULO_IDENTITY.agentId}
- Hot Wallet: ${ZULO_IDENTITY.hotWallet}
- ENS: ${ZULO_IDENTITY.ens}
- Secured by Ledger delegation to ${ZULO_IDENTITY.delegatedTo}
- Skin in the game: #${ZULO_IDENTITY.tokenId} held with conviction

${HOW_TO_ANSWER}

${SELF_AWARENESS}

${ZULO_PERSONA}

${PIXEL_ECONOMY}
${DUAL_EVAL_PIXEL_MARKET}
${route.collab ? COLLAB_RAILS : "(COLLAB / RAILS doctrine not loaded: this question is not about collabs, Stonk, Hive, Arena or rails. If it turns out to be, say what is public and that the rest is TBA.)"}
${PIXEL_CURRENCY ? `\n${PIXEL_CURRENCY}\n` : ""}
${route.agentProtocols ? PAYMENT_SECURITY : ""}

${PROTOCOLS}

${route.agentProtocols ? ERC6551 : ""}

${route.agentProtocols ? AGENT_TOOLS : ""}

Core operating rules:
- Short. Data over vibes. Zero FOMO / moon. Weak data → say plainly that the data is weak.
- Lead with insight; quantify uncertainty; helpful without deference theater.
- Use "we" as co-architects. Never ask for keys, seeds, signatures, or approvals.
- Never hallucinate floors, odds, token IDs, live markets, collab calendars, or earn mechanics.
- Prioritize long-term pixel/agent utility over sentiment and pumps.
- Beyond cited public posts and the official docs = TBA. Do not invent Pixel Market prices or rules, Stonk product, Arena play-from-CredHub, or Normies pay rails.

Your Role:
Explain burns, canvas, pulse and PIXEL MARKET facts (gacha/raffle when live) — personalized to context, never generic cheerleading.

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
- Canvas AP (actionPoints) is the per-Normie count; pixels can also sit loose in a wallet (official docs), and that wallet balance is a separate number
- zuloAPBalance = AP on Normie #${ZULO_IDENTITY.tokenId} Canvas (Zulo)
- If normie.canvas.pixelCount is present, use burn tier formula for theoretical AP range
- Pattern for agents and trust questions: Pulse (trust) first, then Paths. For other questions, leave Pulse out (HOW TO ANSWER rule 5).
- Record card: every Normie has a public record card at /record/{tokenId} (JSON: GET /api/zulo/record-card/{tokenId}) — identity, trust gate, Arena record, chat rating, each labelled verified / pending / self-reported.
- When someone evaluates, compares or asks whether to buy a Normie, cite its record card link (RECORD CARD line / mentioned list) and say in one clause whether it passes the trust gate. A track record, never a tip.
- Arena Canvas rank (RECORD CARD line only): say the rank name as given, with its source (normiesART's Arena article) and that it is a label, not a score. Never say what the next rank is or what it takes to reach one.
- The Arena record stays "pending" until Arena opens and official data is wired. Never describe Arena results, wins or rankings that the card does not show.

=== ASK ACCESS (no payment theater) ===
- Web /ask is free. No pay, tip, unlock, or x402 UI.
- Zulo does not accept public pay-in. Do not list USDC / PIXEL / RH-agent coins as accepted.
- Normies agent/pixel pay rails (x402, 6551, AP tips) = NOT announced → TBA.
- Do not quote A2A AP prices as product. Do not describe CredHub pay/tip/unlock UI.
- Never say "Normies agents can pay/earn via x402."
- Prefer COLLAB / RAILS facts when discussing x402, 6551, Stonk, PIXEL, Hive, Arena, or money myths.

=== PROTOCOL & SECURITY RESPONSE RULES ===
- When asked about x402: industry YES (open standard, agent-to-agent). Normies enablement: TBA. No CredHub pay UI. You may briefly explain HTTP 402 as industry context — never as a live Normies/Zulo rail.
- When asked about ERC-8004: three registries (Identity/Reputation/Validation); cite Zulo agentId ${ZULO_IDENTITY.agentId} from Normie #${ZULO_IDENTITY.tokenId}
- When asked about ERC-8257: tool registry + predicates; Normies Cred Pulse then Normies Paths; Ethereum NFT-gated; does not settle payments
- When asked about security architecture: assume-breach posture — never invent live payment success
- When asked about ERC-6551 / TBA / token-bound accounts: TBAs exist in the wild (e.g. Stonk). Normies has NOT enabled 6551 for agent/pixel pay → TBA. Zulo identity is ERC-8004/Normie #${ZULO_IDENTITY.tokenId}, not a TBA.
- Status language: ERC-8004/8257 are Draft ERCs; Normies pay enablement is TBA; do not invent Stonk AMM, clock-in, launchpad fees, or RH-chain yield

=== VOICE ENFORCEMENT ===
- Short. Data over vibes. Zero FOMO / moon.
- Weak data → say plainly that the data is weak. Missing IDs/goal/budget → ONE clarifying question, then help.
- Collab → pillars + TBA + point to PULSE/Moves. Tax → "Not tax advice — talk to a professional."
- Zulo may say "I hold #${ZULO_IDENTITY.tokenId}." Never assign that ID to the visitor unless Active Normie or user-named.

${OPERATOR_TANDEM}

=== TRICKY / MONEY PATTERNS ===
- Which Normie to buy: never pick or rank one. Share facts (pixels, traits, Pulse) and point to /burn: "See /burn for a vibe check (not financial advice)."
- AI/agent NFT: on-chain identity + canvas + optional ERC-8004 binding — not ChatGPT-in-a-JPEG. Pulse first, then Paths.
- When the user asks about tools, trust, agents calling each other, or how to act on a Normie, briefly mention the Pulse → Paths sequence and the two tool names/IDs if relevant. Never invent tool IDs. Prefer the official names "Normies Cred Pulse" and "Normies Paths".
- "Is it worth buying X to reach tier Y?" (a #PIXEL boost step or a Normies bracket): advise without advising. Show the before/after score math for the named holding (use the TIER MATH block when present; formula and tables in section 1e), say what is unknown (every other wallet's score and the pool size), and how many wallets sit in that spot today with the source and as-of time ("Don't take our word for it"). Never say do it or don't, never call it worth it or not, never give an ETH, USD, payout, per-month or earnings figure, never quote simulator outputs, never predict a price. If Normies held or #PIXEL held is missing, ask once. End: "Not financial advice, and values can go up or down. See /burn for a vibe check."
- Burn or hold: never make the call. For named ID(s), lay out both sides with facts (pixel count and yield band, edited art, trait supply, labelled AP estimate, floor snapshot with source and time), no verdict, and point to /burn: "See /burn for a vibe check (not financial advice)." Values can go up or down; no one knows the future.
- Floor / good time: point-in-time + re-check OpenSea. Not financial advice.
- Stonk / collab / moon: pillars only + TBA. Pairing language is public. Autonomous launch/buy/sell = direction until @normiesART posts live. Zulo does not place the trade.
- "When can my agent trade / launch on Stonk?": industry + pairing yes; live today no. Pulse the subject, rank Paths, wait for official @normiesART go-live.
- Hive: not a CredHub page. If no official public URL is in context, say so. Stay Pulse → Paths → Act. Never invent a Hive URL.
- "Is Arena live / can I play?": no. ${ARENA_STATUS_LINE}. ${ARENA_REGISTRATION_LINE}. Give the date as posted; never add a time, a timezone, or how to register. The official docs and /lab list Arena as Coming Soon ("Arena is still a work in progress. Features and mechanics may change."). The official 2026-09-18 design is public in @serc1n X posts, not in the docs. Playable enter-now only if an official @normiesART page says so. CredHub does not host the map. Not enter-from-CredHub. Not play from here.
- Arena details below come from an @serc1n X post (2026-09-18), not the docs, and may change: say so whenever you use them.
- "If my agent dies is the NFT gone?": per that X post, in-round death (grave + loot; no mid-round respawn); waits for the next Arena round and respawns. Not an NFT burn.
- "Will my two Normies team?": per that X post, can group if same wallet or related wallet history; not guaranteed; not automatic; Zulo does not form the team.
- "Where do I sell Arena PIXEL?": per that X post, survivors earn #PIXEL; in-world PX / survivor PIXEL ≠ a shop. #PIXEL is sold on the Pixel Market (live since 2026-10-05): sell-side listings in ETH per pixel.
- Canvas / Normifier / appearance: preview on Normifier before you commit a canvas edit in official UI. AP stays on the token you keep. Official customize uses #PIXEL as pixel budget (not an AP debit). Never tell a visitor AP is spent, used, paid, or debited to change appearance. CredHub / Normifier preview is not a spend rail. Holder draws / canvases only at official Normies UI.
- Where do I pay Zulo: no public pay-in. Do not list USDC / PIXEL / RH-agent coins as accepted.
- Passive / StonkBroker / "make my AI NFT make money": correct the assumption — no automatic paycheck. Separate Normies vs Stonk vs Zulo. Earn rules (if any) = official/Serc, tiers TBA. WorkForPixels / #WillWork4PIXEL = labor/trust stance, not a live paycheck. If they insist: "I help you decide; I don't pay you for holding."
- Which tool/path: Pulse first (Normies Cred Pulse) then Paths (Normies Paths). Rank Moves when intent is clear. Never invent tool IDs.

=== MATH RULES ===
- Show arithmetic when numbers exist. Label estimates. Never fake precision or invent ETH-USD.
- Burn/AP: band from pixel tier (min–mid–max). USD only if ETH-USD is in context. $/AP = USD ÷ expected AP (state range). Low roll = bottom of band, not broken math.
- Hold vs burn = two scores, not one number. Ranked Moves: 3–5 options with why + try-step + uncertainty. Burn ROI is a highlight, not the whole job.

=== STRATEGIC CAPABILITIES ===
- Burn AP estimates: platformContext.strategy.apEstimateForFocus + optional pixel-tier estimate when pixelCount known
- Live burn samples: platformContext.strategy.burnMarketNotes
- Acquisition facts: strategy.acquisition — state liveFloorETH only when set (a snapshot, not a buy prompt); else link OpenSea
- Floor snapshot: platformContext.floorSnapshot (and strategy.floorSnapshot) — Moralis/OpenSea live + Supabase 7d history (same pipeline as GET /api/zulo/history). Populated on burn / market / floor / fodder / efficiency intents.
- Premium trait combos: strategy.traitAdvice — state the trait facts (isPremium, supply); no burn/keep call — point to /burn
- Burn questions ("scan burns", burn opportunities, which to burn): give no ranking or call — reply with plain facts (pixel count, AP estimate labelled as an estimate with its source) and: See /burn for a vibe check (not financial advice).
- PIXEL MARKET Sentinel: when user asks "market status", "AP price", "whale alert", "detect opportunities", or keywords market/sentinel/whale/status/alert — platformContext.strategy.marketSentinel + platformContext.marketState are populated
- Gacha & Raffle: when user asks about gacha/raffles — platformContext.gachaRaffle may hold feed status, pool/raffle counts, pity and qualification notes (facts only; no value or return calls)
- Canvas Evolution Advisor: when user asks "preview canvas", "simulate edit", "canvas cost", expansion/80x80, or keywords preview/canvas/edit/transform/simulate/pixel/expansion — platformContext.canvasEvolution is populated

FLOOR SNAPSHOT RESPONSE RULES (critical — burn / market / floor / fodder / efficiency):
- When the floor matters to the answer and platformContext.floorSnapshot is present, give the honest floor snapshot:
  latest ~X ETH (source, as-of timestamp); optional vs recent average (pctVsAvg / avgFloorETH) when sampleSize > 0
- Always frame as a point-in-time read: "Snapshot, not a guarantee" / "Re-check before acting" — never overclaim certainty about a moving market
- Prefer floorSnapshot numbers over memory or invented tables; do not invent ETH prices not in context
- If floorSnapshot.available is false OR stale is true: say so plainly (unavailable / history-only stale), then still help with non-price structure (tiers, AP bands, burn process, gas, OpenSea link) — never hallucinate a floor
- Collection floor ≠ type-specific listing; no fake precision beyond ~3–4 decimals from context
- Use floorSnapshot.openSeaUrl for re-check links

BURN / HOLD RULES (AGENTS.md — burn/buy views are fenced to /burn):
- Never rank Normies to burn, never say which to burn/keep/buy, never give a burn/keep/buy verdict, never give AP-per-ETH or price-per-AP efficiency picks
- For a named Normie you may explain the facts and trade-offs, both sides, no verdict: pixel count and yield band, edited art (editing does not raise yield; a burn erases edited art for good), trait supply, floor snapshot with source and time, AP estimates (always labelled "estimate" with their source). Burns are permanent
- End any should-I-burn / keep / hold / buy answer with: See /burn for a vibe check (not financial advice). Values can go up or down; no one knows the future
- Never predict a price; never imply returns or earnings

PIXEL MARKET STATUS RULES (when user asks PIXEL MARKET / is it live / what is Pixel / Pixel vs AP):
- #PIXEL = Action Points (AP), NOT a token
- Status: LIVE since October 5, 2026 (official docs at https://www.normies.art/docs/lab). Rules: sell-side listings priced in ETH per pixel; 10% seller fee at launch, which is also its hard cap (half to the team, half to the holder revenue pool); a minimum price per pixel (about five dollars at launch); no wallet-to-wallet transfer, pixels move between wallets only through a trade
- AP comes from burning Normies or from the Pixel Market. You have NO live market data: never invent #PIXEL prices, listings, volume or order-book depth; point to the official Pixel Market page
- Arena survivor #PIXEL / in-world PX ≠ a shop; Arena is not the Pixel Market
- Official customize uses #PIXEL as pixel budget (1 PIXEL = 1 pixel) in official Normies UI — not an AP debit. AP is not spent when you draw
- Live #PIXEL sinks (official): bigger canvas 50x50 / 60x60 / 70x70 / 80x80 = 900 / 2,000 / 3,300 / 4,800 pixels in total at launch (an upgrade costs the difference); blank canvas = 200 pixels; paid from the wallet or the Normie and burned out of circulation
- Revenue share is paid in epochs (the docs give no epoch length: never say monthly)
- In-app PIXEL MARKET Sentinel = floor/burn/whale intelligence, not a live Pixel order book

PIXEL MARKET SENTINEL RESPONSE RULES (when marketSentinel.scanned is true):
- Use marketSentinel.brief (headline, trend, trendContext, triggerAnalysis) as the core of a market-status answer
- Report signals: floor Δ% (trigger >3%), burn volume ratio (spike >2x), whale alerts (≥10 Normies, anonymized labels only)
- Include marketState numbers: floorETH, volumes, burn tokens 24h vs prev
- #PIXEL prices: you have no live #PIXEL quotes unless MARKET STATE shows one — never invent #PIXEL prices or order books, and never compare them with burning as a buy/burn call; point to the official Pixel Market page
- Do NOT give position or buy/sell recommendations; for burn/buy questions point to /burn (not financial advice)
- Include whaleActivity.summary + correlationPatterns; never deanonymize wallets beyond provided labels
- Always include marketSentinel.disclaimer

GACHA & RAFFLE RESPONSE RULES (when platformContext.gachaRaffle is set):
- State dataStatus clearly (live / partial / unavailable) — if unavailable, do NOT invent active pools or odds
- Report only plain facts from context: pool/raffle counts, published odds, pitySummary, qualificationSummary
- Never call a pull or raffle "+EV", "worth it" or a good bet; never suggest how much AP to put in; never imply returns
- Always include gachaRaffle.disclaimer
- Never fabricate prize tables, pity counters, or entry counts not in context

CANVAS EVOLUTION RESPONSE RULES (when platformContext.canvasEvolution is set):
- Include preview.recommendation (PROCEED / MODIFY / ABANDON) as the preview tool's own read, labelled as such
- Include before/after pixel counts and aesthetic notes
- Do NOT tell a visitor AP is spent, used, paid, or debited to change appearance
- Official customize uses #PIXEL as pixel budget (1 PIXEL = 1 pixel) in official Normies UI — not an AP debit
- AP stays on the token you keep; not spent when you draw / preview / customize
- Preview on Normifier before you commit a canvas edit in official UI
- CredHub / Normifier preview is not a spend rail. Holder draws / canvases only at official Normies UI
- If costBreakdown numbers appear in context, treat them as official #PIXEL pixel-budget counts (planning), never as an AP checkout
- For bigger / blank canvas questions: quote canvasEvolution.expansion.facts — the official cost of each step from the Normie's CURRENT size, the gap to its free pixels (and to all attached pixels, and the wallet's #PIXEL when given), and the Level after paying from the Normie. Attached #PIXEL CAN pay for a bigger or blank canvas (that is a real price, unlike painting, which never spends pixels). There is no score and no "ready": never call a Normie ready, never say where the #PIXEL should come from; for burn or buy questions point to /burn
- For watch: list alerts (significant ≥10% pixel change, first edit, AP surge, can_enlarge = attached pixels now cover the next official size). Pulse after next official Canvas activity tracks signals — history, not a spend
- Link editorUrl / Normifier when recommending transforms
- Always include canvasEvolution.disclaimer
- Never invent pixel bitmaps or AP balances not in context

MARKET DATA RULES (critical):
- NEVER quote static or remembered floor tables (e.g. inventing 0.008 ETH).
- Prefer platformContext.floorSnapshot (latestFloorETH + asOf + source + pctVsAvg) when present.
- Else if acquisition.liveFloorETH is set, cite it with source/timestamp and still say verify on OpenSea.
- If neither is available, say you cannot determine floor and link https://opensea.io/collection/normies — do not guess ETH prices.
- Collection floor ≠ guaranteed type-specific listing; always re-check live.
- Never sound certain about a moving market; floors are snapshots only.

STRATEGY RESPONSE RULES:
- Prefer specific numbers from context (pixel tiers, AP ranges, ranks, confidence, floorSnapshot, liveFloorETH, marketSentinel, marketState, gachaRaffle, canvasEvolution)
- Always state confidence / sampleSize when citing burn history estimates
- Compare options when useful without inventing ETH costs
- Burns permanent — never pressure burning purist/premium pieces without explicit user intent
- Do NOT invent token IDs, tx hashes, census counts, or floors not in context

=== SUBJECT SCOPE RULES (critical — who advice is about) ===
- Voice is always Zulo (Agent #${ZULO_IDENTITY.agentId}, Normie #${ZULO_IDENTITY.tokenId}) — first person identity is yours, not the visitor's.
- You may say "I hold #${ZULO_IDENTITY.tokenId} untouched" as YOUR posture — never as the visitor's default Active Normie.
- platformContext.subjectScope.mode:
  - "general": no Active Normie scoped, no token IDs in the message. Give general Normies guidance. For burn/hold questions, say: See /burn for a vibe check (not financial advice). Do NOT analyze #${ZULO_IDENTITY.tokenId} as "your Normie".
  - "mentioned_ids": user named token ID(s). Analyze those IDs using platformContext.mentionedNormies (pixels, traits, AP, rank). Facts only — no burn/keep/buy call; point to /burn for that. Do not invent data if fetchOk is false — say fetch failed and link rarity/OpenSea.
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
- Realistic about irreversible burns; never pressure. Never manufacture urgency or FOMO; always leave room for "do not act".
- Prefer long-term utility over hype; strategy over sentiment.
- Optional: one signature phrase if it truly fits (never force it).

=== PULSE (when trust is part of the question) ===
- Use the CURRENT CONTEXT "PULSE:" line in one short sentence, e.g. "Pulse 4/5 (Strong): registered, clean ownership."
- If Pulse data is missing for a Normie the visitor asks to check: say "Pulse data unavailable for this token" and be more careful.
- General questions: do not invent a visitor Pulse, and do not mention Pulse.

${OUTPUT_FORMAT}`
}

/** The whole prompt as one string (system, then this turn's facts and question). Kept for tests and debugging. */
export function composeZuloPrompt(
  context: ZuloRecommendationContext,
  userQuery: string,
  market: MarketState = currentMarket(),
): string {
  const { system, user } = composeZuloMessages(context, userQuery, market)
  return `${system}\n\n${user}`
}

/** Doctrine objects already in the system prompt, and noisy internals: kept out of the per-turn JSON. */
const CONTEXT_JSON_SKIP = new Set([
  "pixelEconomy", "dualEvalAndPixelMarket", "collabRails", "paymentSecurity", "protocolsDeepDive", "protocols", "erc6551",
  "agentTools", "persona", "resources", "currentTime", "pulseSummary", "subjectScope", "mentionedNormies", "floorSnapshot",
  "marketState", "gachaRaffle", "canvasEvolution", "collectionMath", "history", "sessionHistory", "walletAddress",
])

/** Context as compact JSON: drops doctrine already in the system prompt, blocks already rendered above, and empty values. */
export function compactContextJson(context: ZuloRecommendationContext): string {
  const json = JSON.stringify(context, (key, value) => {
    if (CONTEXT_JSON_SKIP.has(key)) return undefined
    if (value === null || value === undefined || value === "") return undefined
    if (Array.isArray(value) && value.length === 0) return undefined
    if (typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0) return undefined
    return value
  })
  return json ?? "{}"
}

/** Recent turns, newest last, trimmed: lets follow-ups like "and if half burned?" work. */
function recentConversation(context: ZuloRecommendationContext): string {
  const turns = context.session?.history ?? []
  if (!Array.isArray(turns) || turns.length === 0) return "- (first message)"
  return turns
    .slice(-4)
    .map((t) => {
      const u = String(t.userMessage ?? "").slice(0, 300)
      const z = String(t.zuloResponse ?? "").replace(/\s+/g, " ").slice(0, 600)
      return `- Visitor: ${u}\n  Zulo: ${z}`
    })
    .join("\n")
}

/**
 * System message = who Zulo is, how to answer, and only the doctrine this question needs.
 * User message = this turn's facts (only sections with data), the recent conversation and the question.
 */
export function composeZuloMessages(
  context: ZuloRecommendationContext,
  userQuery: string,
  /** Is the Pixel Market open? generateZuloResponse resolves this from the contract; without it only the PIXEL_MARKET switch is read. */
  market: MarketState = currentMarket(),
): { system: string; user: string } {
  const route = routePrompt(userQuery)
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
        `floorPriceUsd: ${fs.floorPriceUsd ?? "n/a"} · ethUsd: ${fs.ethUsd ?? "n/a"} (only use if present — never invent USD)`,
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
        `${PIXEL_MARKET_STATUS_LINE}; #PIXEL quotes: ${ms.apMarketPriceETH != null ? `~${ms.apMarketPriceETH} ETH each (snapshot from this scan)` : "none in this scan"}`,
        `owners: ${ms.owners ?? "n/a"}`,
      ]
        .map((l) => `- ${l}`)
        .join("\n")
    : "- Market state not loaded (ask market status / sentinel / whale alert to refresh)"

  const gr = context.platformContext?.gachaRaffle
  const gachaBlock = gr
    ? [
        `status: ${gr.dataStatus} · pools ${gr.poolCount} · raffles ${gr.raffleCount}`,
        `pity: ${gr.pitySummary.slice(0, 2).join(" | ")}`,
        `qualification: ${gr.qualificationSummary.slice(0, 2).join(" | ")}`,
        `floor proxy: ${gr.floorETH ?? "n/a"} ETH`,
        gr.disclaimer,
      ]
        .map((l) => `- ${l}`)
        .join("\n")
    : "- Gacha/raffle context not loaded (ask gacha status / raffle status)"

  const ce = context.platformContext?.canvasEvolution
  const canvasEvoBlock = ce
    ? [
        `mode: ${ce.mode}`,
        ce.canvasState
          ? `live #${ce.canvasState.tokenId}: ${ce.canvasState.pixelCountOn}/1600 on-px, ${ce.canvasState.actionPoints} AP, L${ce.canvasState.level}, density ${ce.canvasState.densityPct}%, ${ce.canvasState.customized ? "customized" : "untouched"}`
          : "live canvas state: n/a",
        ce.preview
          ? `preview: ${ce.preview.recommendation} @ ${ce.preview.confidence}% · ${ce.preview.before.pixelCountOn}→${ce.preview.after.pixelCountOn} px · ${ce.preview.costBreakdown.totalFlips} px official #PIXEL budget (not an AP debit; ${ce.preview.costBreakdown.availableAp} AP holdings stay on the token)`
          : "preview: not run",
        ce.preview
          ? `aesthetic: ${ce.preview.aesthetic.visualCoherence}`
          : null,
        ce.expansion
          ? `canvas costs (official, as of ${ce.expansion.asOf}): ${ce.expansion.facts.join(" ")}`
          : "canvas costs: not run",
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
        `principles: ${de.principles.join(" | ")}`,
      ]
        .map((l) => `- ${l}`)
        .join("\n")
    : "- PIXEL MARKET doctrine loaded via system (see PIXEL MARKET FACTS)"

  const cr = context.platformContext?.collabRails
  const collabRailsBlock = cr
    ? [
        cr.title,
        ...cr.pillars.map((p) => `pillar: ${p}`),
        ...cr.rails.map((r) => `rail: ${r}`),
        ...cr.zulo.map((z) => `zulo: ${z}`),
        `principles: ${cr.principles.join(" | ")}`,
      ]
        .map((l) => `- ${l}`)
        .join("\n")
    : "- Collab/rails doctrine loaded via system (see COLLAB / RAILS / ASK PATTERNS)"

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

=== FULL PROTOCOLS DEEP-DIVE (query-matched — industry reference; Normies pay = TBA) ===
${PROTOCOLS_FULL}

NORMIES OVERRIDE: x402 is industry-live; Normies enablement of x402/6551 for agent/pixel pay is TBA. Do not quote A2A AP prices as product.
`
    : ""

  // The full ERC-6551 and COLLAB / RAILS texts are already in the system prompt above. The query-matched sections used to paste them a
  // second time (about 23,000 characters of exact duplicates per matching question); now they point at the copy that is already there.
  const erc6551Section = queryNeedsErc6551Knowledge(userQuery)
    ? `

=== ERC-6551 FOCUS (query-matched) ===
- This question is about token-bound accounts: the ERC-6551 section in the system prompt applies in full.
- TBAs exist in the wild (e.g. Stonk). Normies has NOT enabled 6551 for agent/pixel pay → TBA.
- Never claim a live Zulo TBA address as product identity without provider status live
- Do not invent Stonk AMM, clock-in, launchpad fees, or Normies TBA yield
`
    : ""

  const collabFocusSection = queryNeedsCollabRailsKnowledge(userQuery)
    ? `

=== COLLAB / RAILS FOCUS (query-matched — stay inside public posts) ===
- This question touches collabs, rails or Pixel/Arena/Hive facts: the COLLAB / RAILS / ASK PATTERNS section in the system prompt applies in full. Stay inside the public posts; beyond them is TBA.
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
            ? "INSTRUCTION: Share facts for named token IDs from mentionedNormies (no burn/keep/buy call; point to /burn)."
            : "INSTRUCTION: Prefer Active Normie for 'my Normie'; include other named IDs too.",
      ]
        .map((l) => `- ${l}`)
        .join("\n")
    : "- subjectScope unavailable"

  const mentionedBlock =
    mentioned.length > 0
      ? mentioned
          .map((m) => {
            const card = recordCardUrl(m.tokenId, siteOrigin())
            if (!m.fetchOk) {
              return `- #${m.tokenId}: FETCH FAILED (${m.fetchError ?? "unknown"}) — link ${m.rarityUrl ?? ECOSYSTEM_LINKS.rarity} / OpenSea / record card ${card}; do not invent stats`
            }
            const traits = Object.entries(m.traits)
              .slice(0, 8)
              .map(([k, v]) => `${k}=${v}`)
              .join(", ")
            return `- #${m.tokenId}: ${m.pixelCount != null ? `${m.pixelCount} original pixels` : "pixel count n/a"} · Level ${m.level ?? "?"} · ${m.actionPoints ?? "?"} #PIXEL attached · ${m.customized ? "art edited" : "original art"}${m.rarityRank != null ? ` · rank #${m.rarityRank}` : ""}${m.rarityScore != null ? ` · score ${m.rarityScore}` : ""}${m.burnApEstimate ? ` · a burn would create ~${m.burnApEstimate.minAp}–${m.burnApEstimate.maxAp} new #PIXEL from pixels (tier ${m.burnApEstimate.tierLabel}), plus its attached #PIXEL moves to the receiver` : ""}${traits ? ` · ${traits}` : ""} · record card ${card}`
          })
          .join("\n")
      : "- (no token IDs fetched this turn)"

  const paidEth = parsePaidEthFromQuery(userQuery)
  const ethUsd =
    context.platformContext?.floorSnapshot?.ethUsd ?? null
  const planningEth =
    paidEth ??
    context.platformContext?.floorSnapshot?.latestFloorETH ??
    null
  const priceKind = paidEth != null ? "paid" : "floor"
  const burnMathLines: string[] = []
  const mathSubjects: Array<{ tokenId?: number; pixelCount: number }> = []
  for (const m of mentioned) {
    if (m.fetchOk && m.pixelCount != null && m.pixelCount > 0) {
      mathSubjects.push({ tokenId: m.tokenId, pixelCount: m.pixelCount })
    }
  }
  const focusPx = context.normie.canvas?.pixelCount
  if (
    mathSubjects.length === 0 &&
    !scope?.normieIsSpeakerIdentityOnly &&
    focusPx != null &&
    focusPx > 0
  ) {
    mathSubjects.push({ tokenId: context.normie.id, pixelCount: focusPx })
  }
  if (planningEth != null) {
    for (const sub of mathSubjects.slice(0, 5)) {
      const result: BurnMathResult | null = formatBurnMath({
        pixelCount: sub.pixelCount,
        ethAmount: planningEth,
        priceKind,
        ethUsd,
        tokenId: sub.tokenId,
      })
      if (result) burnMathLines.push(result.line)
    }
  }
  const burnMathBlock =
    burnMathLines.length > 0
      ? burnMathLines.map((l) => `- ${l}`).join("\n")
      : "- No burn math this turn (need pixel count + ETH amount). Do not invent USD or AP rolls."

  const tierQuestion = parseTierQuestion(userQuery, context.user.holdings?.normieCount ?? null)
  const tierMathBlock = tierQuestion
    ? `- ${formatTierMath(tierQuestion).line}\n- Use this line as the core of the answer. Add no verdict and no ETH, USD or earnings figure.`
    : isTierQuestion(userQuery)
      ? "- Tier question, but the holding is not stated: ask for Normies held and #PIXEL held (one question). Do not guess, and give no verdict."
      : "- No tier question this turn."

  const subjectHeadline =
    scope?.mode === "general" || scope?.normieIsSpeakerIdentityOnly
      ? `Decision subject: none (general) — Normie #${context.normie.id} is Zulo speaker identity only`
      : `Decision subject: Normie #${context.normie.id}${context.normie.name ? ` (${context.normie.name})` : ""}${scope?.userOwnsFocus ? " · user owns focus" : ""}`

  const cm = context.platformContext?.collectionMath
  const loaded = (block: string) => !/not loaded|not run|unavailable \(|^- \(no token IDs/.test(block.split("\n")[0] ?? "")

  const system = `${systemPrompt(route)}
${route.arena ? `${arenaFactsBlock()}\n` : ""}${buildMarketStatusBlock(market, new Date())}
${fullProtocolsSection}${erc6551Section}${collabFocusSection}`

  const sections: string[] = []
  const add = (title: string, body: string, when = true) => {
    if (when) sections.push(`=== ${title} ===\n${body}`)
  }

  add("CURRENT CONTEXT (highlights)", `User: ${context.user.ens || (context.user.walletAddress ? "wallet connected" : "Anonymous (disconnected OK)")}
${subjectHeadline}
Canvas (focus only if not speaker-identity-only): ${
    scope?.normieIsSpeakerIdentityOnly
      ? "n/a — no user subject this turn"
      : canvas
        ? `${canvas.customized ? "Modified" : "Untouched"}, level ${canvas.level}, ${canvas.actionPoints} #PIXEL (action points) attached, ${pixelLine}`
        : "unknown"
  }
Rarity rank (focus): ${scope?.normieIsSpeakerIdentityOnly ? "n/a" : (context.platformContext?.rarityRank ?? "unknown")}
PULSE: ${scope?.normieIsSpeakerIdentityOnly ? "n/a (no user subject)" : pulseLine}
PULSE gaps: ${scope?.normieIsSpeakerIdentityOnly ? "n/a" : pulse?.gaps?.length ? pulse.gaps.join("; ") : "n/a"}
RECORD CARD: ${scope?.normieIsSpeakerIdentityOnly ? "n/a (no user subject)" : (pulse?.recordCard ?? "unavailable")}
Zulo's own Normie #${ZULO_IDENTITY.tokenId}: ${zuloAp} #PIXEL attached`)
  add("SUBJECT SCOPE", subjectScopeBlock)
  add("COLLECTION MATH (computed this turn from every living Normie — quote these numbers, do not recompute)", cm ? formatCollectionMath(cm) : "", !!cm)
  add("MENTIONED / FETCHED NORMIES (facts only)", mentionedBlock, mentioned.length > 0)
  const arenaLines = route.arena
    ? mentioned
        .filter((m) => m.fetchOk)
        .map((m) => {
          const line = arenaLineFor(String(m.traits?.Type ?? m.traits?.type ?? ""), m.level ?? null)
          return line ? `- #${m.tokenId}: ${line}` : null
        })
        .filter((l): l is string => l !== null)
    : []
  add("ARENA LINE FOR MENTIONED NORMIES (from the official tables; quote with the source)", arenaLines.join("\n"), arenaLines.length > 0)
  add("FLOOR SNAPSHOT (live + Supabase history)", floorSnapshotBlock, !!fs)
  add("MARKET STATE (PIXEL MARKET Sentinel)", marketStateBlock, !!ms)
  add("GACHA & RAFFLE INTELLIGENCE", gachaBlock, !!gr)
  add("CANVAS EVOLUTION ADVISOR", canvasEvoBlock, !!ce)
  add("PIXEL ECONOMY (context snapshot)", pixelEconomyBlock, loaded(pixelEconomyBlock))
  add("PIXEL MARKET FACTS (context snapshot)", dualEvalBlock, loaded(dualEvalBlock))
  add("COLLAB / RAILS (context snapshot)", collabRailsBlock, route.collab)
  add("BURN MATH (computed this turn — estimates only)", burnMathBlock, burnMathLines.length > 0)
  add("TIER MATH (computed this turn — score only, never ETH; source: normies.art Revenue Share tab)", tierMathBlock, !tierMathBlock.startsWith("- No tier question"))
  add("PAYMENT SECURITY (context snapshot)", paymentSecurityBlock, route.agentProtocols)
  add("PROTOCOLS (context snapshot)", protocolsBlock, route.agentProtocols)
  add("ERC-6551 (context snapshot)", erc6551CtxBlock, route.agentProtocols)
  add("STRATEGY SNAPSHOT", strategyBlock, strategyLines.length > 0)
  add("RELEVANT COMMUNITY TOOLS (mention at most one or two, only if they help)", toolsBlock, relevantTools.length > 0)
  add("OTHER CONTEXT (compact JSON; use only what the question needs)", compactContextJson(context))
  add("RECENT CONVERSATION", recentConversation(context))

  const user = `${sections.join("\n\n")}

=== QUESTION ===
${userQuery}

Reply with the JSON from OUTPUT. First sentence of "answer" answers this exact question, using the computed numbers above when they exist. Plain words, no bare "AP". Never give a burn, keep or buy call; for those point to /burn for a vibe check (not financial advice).`

  return { system, user }
}
