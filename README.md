# NormiesCredHub + Zulo

**A verifiable reputation layer for autonomous AI agents — and a high-signal Normies concierge for the Pixel Economy.**

Autonomous agents are about to transact with each other on-chain — but they have no way to know who to trust. NormiesCredHub aggregates verifiable on-chain signals (ERC-8004 identity, Ethos reputation, AgentCheck wallet ratings, ownership & delegation) into a single trust profile for any Normie agent.

It is not only a dashboard. It exposes **public, agent-queryable APIs** so any agent can fetch another agent’s trust score as JSON and vet it *before* interacting — autonomously.

**Live site:** https://normiescredhub.vercel.app

---

## Phase 1 positioning

**Zulo (Agent #32626)** is the high-signal Normies concierge. Primary job: help people make better **burns**, **trait/tool choices**, and **Canvas moves** — the daily group-chat topics.

- **Burn ROI (action points / pixels)** is a **highlight skill**, not the whole brand.
- Recommendations should be clear, data-backed, easy to try, and easy to rate **👍/👎**.
- Ratings credit the **recommended tool/agent** and **Zulo #32626** (store + display only in Phase 1 — no ranker influence).
- Scope: **Normies / Pixel Economy only** (no broader agentic-NFT alpha).
- **Moves** (formerly Path Board; route `/paths`) stays **fully free**. No autonomous transaction layer.
- Ratings are stored by NCH and shown as ratings. They are not reputation and never change Pulse.
- Every service is free. Zulo payments are **parked** (`lib/payments/rail-policy.ts` blocks them); nothing here explains how to pay Zulo.

---

## Product surfaces (routes)

| Path | What it is |
|------|------------|
| **`/`** | **Zulo gateway** — monochrome Normies landing; CTAs: Moves · Ask · PULSE |
| **`/paths`** | **Moves** — free intent → 3–5 Pulse-weighted actions + 👍/👎 feedback |
| **`/ask`** | **Legacy concierge chat** — banner + job line only for Phase 1 (no prompt rewrite) |
| **`/dashboard`** | **PULSE** — full trust profile UI (search Normie, Ethos, ERC-8257, CredHub Pulse) |
| **`/record/{tokenId}`** | Record card — identity, trust gate, chat rating, each value labelled with its source; share image |
| **`/burn`** | Burn helper — what to burn for #PIXEL ahead of the Pixel Market |
| **`/pixels`** | Pixel Check — #PIXEL approvals and offers for a wallet (read-only) |
| **`/symphony`** | Pixel Symphony — a Normie's on-chain pixels as music; rooms of up to 12; block-pinned share links |
| **`/privacy`**, **`/terms`** | Privacy notice and terms |
| **`/zulo`**, **`/agent-recommendations`**, **`/pulse`** | Permanent redirects (→ `/ask`, `/ask`, `/dashboard`) |

API routes live under `app/api/`. Public ones include `agent/{id}/pulse`, `zulo/paths`, `zulo/ask`, `zulo/record-card/{id}`, `zulo/manifest`, `burn-buy`, `ap-check`, `symphony/voice/{id}`, `symphony/card`, `my-normies`, `erc8257/tools`, `chat-ratings/{agentId}`. Every route that calls an outside service is rate-limited.

### Moves API (`/api/zulo/paths` — ranking engine unchanged)

```
POST /api/zulo/paths
GET  /api/zulo/paths?intentTag=burn&tokenId=7141
```

```json
{
  "intent": "efficient burn fodder",
  "intentTag": "burn",
  "tokenId": 7141,
  "wallet": "0x…",
  "limit": 5
}
```

Ranks paths by **CredHub Pulse (0.40) + access (0.25) + relevance (0.25) + feedback (0.10)**. No payment enforcement. Does not replace Tool #53 Pulse.

### Moves feedback API (Phase 1)

```
POST /api/zulo/feedback
GET  /api/zulo/feedback
```

```json
{
  "rating": "up",
  "pathId": "skill:burn-efficiency",
  "pathKind": "zulo-skill",
  "pathTitle": "Burn Efficiency Optimizer",
  "publisherName": "Zulo",
  "publisherAgentId": 32626,
  "intentTag": "burn",
  "subjectTokenId": 7141,
  "wallet": "0x…",
  "context": "path-board"
}
```

- **👍/👎 only**; rate immediately (no forced try); wallet optional.
- Stores **up and down**; public UI shows **helpful (up) counts** for Zulo #32626 only (no wallets).
- Requires Supabase table `recommendation_feedback` — see `supabase/sql/2026-10-10-recommendation-feedback.sql` (applied) and `supabase/sql/2026-10-18-recommendation-feedback-lockdown.sql`.
- Does **not** influence path ranking in Phase 1.

Meet **Zulo, Normie #7141 → Agent #32626** (`32626.eth`). He is bound to *serve members, never exploit them*: he never asks for keys, pressures a transaction, or manufactures urgency. He reads on-chain signals, Normies mechanics, and community tools — and recommends what actually helps.

---

## Call this tool with your AI agent (ERC-8257 Tool #53)

Use the `opensea-tool-sdk` skill to set up access and call the tool below.

### Setup (one time)

1. Install the skill:  
   `npx skills add https://github.com/ProjectOpenSea/opensea-skill --skill opensea`

2. Install the SDK:  
   `npm install @opensea/tool-sdk`

3. Full docs: https://docs.opensea.io/docs/agent-tool-registry

### Tool

- **Name**: Normies Cred Pulse  
- **Tool ID**: 53 (Ethereum, Normie NFT gated) · 531 (Base, open) · 15 (Robinhood Chain, open)  
- **GET (public) first**: `GET https://normiescredhub.vercel.app/api/agent/{tokenId}/pulse`  
- **POST (gated) second**: `POST https://normiescredhub.vercel.app/api/agent` (official ERC-8257 endpoint)  
- **Manifest**: https://normiescredhub.vercel.app/.well-known/ai-tool/normies-cred-pulse.json  
- **Access**: Ethereum is gated to Normie NFT holders (`0x9eb6e2025b64f340691e424b7fe7022ffde12438`). Base and Robinhood Chain are open — the Normie ERC-721 has no contract on those chains (`CollectionNoCode`).  
- **Registry**: ERC-8257 Tool Registry (`0x265BB2DBFC0A8165C9A1941Eb1372F349baD2cf1`)  
- **OpenSea**: https://opensea.io/tools/erc8257/ethereum/53 · https://opensea.io/tools/erc8257/base/531
- **Robinhood Chain** (chainId 4663): Tool #15, open access, same manifest/endpoint. Explorer: https://robinhoodchain.blockscout.com/tx/0x22cffdfa81b09a939ca6147622627e8c7a9f5c89adaf4cf020dde3ee02a61bf1

### Inputs

| Parameter | Type    | Required | Description              |
|-----------|---------|----------|--------------------------|
| tokenId   | integer | Yes      | Normie token ID (0-9999) |

### How to call it

Public GET first (no gate). Gated POST second (official ERC-8257 endpoint, Normie holders).

```bash
curl "https://normiescredhub.vercel.app/api/agent/7141/pulse"
```

```bash
curl -X POST "https://normiescredhub.vercel.app/api/agent" \
  -H "Content-Type: application/json" \
  -d '{"tokenId": 1234}'
```

Note: On Ethereum the registry-gated tool path requires the caller to hold a Normie NFT (`ERC721OwnerPredicate`). Base/Robinhood listings are open discovery copies of the same HTTPS endpoint. The public GET pulse endpoint remains available for read-only profiles.

Example pulse response:

```json
{
  "token_id": 7141,
  "agent_id": 32626,
  "pulse_level": 4,
  "max_level": 5,
  "status": "Strong",
  "breakdown": [
    "ERC-8004 registered",
    "Has active agent card",
    "Canvas activity detected",
    "Clean ownership & delegation"
  ],
  "next_signal": "All four trust checks pass. Luminous (level 5) comes from popularity: more different people checking its Pulse or using it in Paths within 14 days.",
  "note": "Levels 1–4 are trust: ERC-8004 registration, an active agent card, Canvas activity and clean ownership & delegation. Level 5 (Luminous) is popularity on top of all four: enough different people checked this agent recently. The raw popularity counts are shown so anyone can check them.",
  "popularity": {
    "pulse_checkers": 5,
    "paths_users": 1,
    "lookback_days": 14,
    "popular": false,
    "note": "Distinct callers, not raw calls. Popularity alone never raises trust: it only lifts an agent that already passes all four trust checks to Luminous."
  },
  "chat_ratings": {
    "agent_id": 32626,
    "label": "Chat rating",
    "available": true,
    "ranked": false,
    "score": null,
    "stars": null,
    "raw": { "ratings": 2, "unique_raters": 2, "average": 90 },
    "min_unique_raters": 5,
    "weighting": { "holders": 1, "fresh_wallets": 0, "repeat_raters": 0, "excluded_self": 0 },
    "recency_available": true,
    "source": { "tag1": "starred", "tag2": "hive-chat", "registry": "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63" },
    "note": "Chat rating = how good chats with this agent were (Hive chat, normies.art). …"
  }
}
```

### Chat ratings (Hive chat → ERC-8004 Reputation Registry)

Hive chat on normies.art lets anyone rate a chat with an agent (1–5 stars, stored on-chain as 0–100 with `tag2 = "hive-chat"`, sent from the rater's own wallet). NCH reads those ratings **read-only** and ranks **signal over noise**:

- **One vote per wallet** — a wallet's ratings are averaged (its recent chats weigh more), so ten ratings from one wallet never outweigh ten people. Returning wallets get a small capped boost.
- **Normie holders count more, fresh wallets count less** (holder ×1.5, under 10 transactions ×0.5).
- **Recent chats count more** (90-day half-life, never below 10%).
- **No ranked score until 5 different wallets have rated** — raw counts always ship alongside.
- The agent owner's own ratings are excluded.

Weights live in `lib/chat-ratings/config.ts`; the math is in `lib/chat-ratings/score.ts` (tested). It is labelled **Chat rating**, never reputation — it measures how good chats were, not whether the owner is trustworthy, and it **never changes `pulse_level`**. The Pulse manifest (hash pinned on-chain) is unchanged; `chat_ratings` is an additive field.

Also available on its own (any ERC-8004 agent id, does not count as a Pulse check):

```bash
curl "https://normiescredhub.vercel.app/api/chat-ratings/32626"
```

---

## Call this tool with your AI agent (ERC-8257 companion)

### Tool: Normies Paths

- **Name**: Normies Paths
- **Tool ID**: 215 (Ethereum, Normie NFT gated) · 530 (Base, open) · 14 (Robinhood Chain, open)
- **Manifest**: https://normiescredhub.vercel.app/.well-known/ai-tool/normies-paths.json
- **Endpoint**: `POST https://normiescredhub.vercel.app/api/zulo/paths` (also supports GET with query params)
- **Access**: Ethereum uses ERC721OwnerPredicate on the Normie collection (`0x9eb6e2025b64f340691e424b7fe7022ffde12438`). Base and Robinhood Chain cannot use that gate (`CollectionNoCode`) so they are registered open.
- **Creator**: `0xb8792e6516b88e73ed0723f8c1c8a92531a98767`
- **Registry**: ERC-8257 Tool Registry (`0x265BB2DBFC0A8165C9A1941Eb1372F349baD2cf1`)
- **OpenSea**: https://opensea.io/tools/erc8257/ethereum/215 · https://opensea.io/tools/erc8257/base/530
- **Robinhood Chain** (chainId 4663): Tool #14, open access, same manifest/endpoint. Explorer: https://robinhoodchain.blockscout.com/tx/0xba44bcbea0f91f05179455bd6080f5ea2ec4164c99d4088ec0933b04301e3e14

### Tool: Normies Pixel Check

- **Name**: Normies Pixel Check
- **Tool ID**: 245 (Ethereum, open) · 786 (Base, open) · 16 (Robinhood Chain, open)
- **Manifest**: https://normiescredhub.vercel.app/.well-known/ai-tool/normies-pixel-check.json
- **Endpoint**: `GET` or `POST https://normiescredhub.vercel.app/api/ap-check` (one question per call: `token`, `wallet`, `listings`, `approvals`, `contract`, or `calc` + `amount`)
- **Access**: open to everyone on every chain (`accessPredicate` = `0x0000000000000000000000000000000000000000`). Read-only; never asks for keys, seeds or signatures. Standalone: no Pulse needed.
- **OpenSea**: https://opensea.io/tools/erc8257/ethereum/245 · https://opensea.io/tools/erc8257/base/786
- **Robinhood Chain** (chainId 4663): Tool #16. Explorer: https://robinhoodchain.blockscout.com/tx/0xee03515911484679b01df832f21d11687901f543130bc480ba3284451cd61d20
- **Human page**: https://normiescredhub.vercel.app/pixels

**Purpose**: After checking **Normies Cred Pulse**, call this tool to receive 3–5 Pulse-weighted ranked paths. Built for autonomous agent-to-agent and NFT-to-NFT decision making. Agents choose a path, then execute the concrete next step (the move).

### Inputs

| Parameter   | Type    | Required | Description                                      |
|-------------|---------|----------|--------------------------------------------------|
| intent      | string  | one of   | Free-text intent (max 200 chars)                 |
| intentTag   | string  | one of   | Chip: pulse · burn · market · canvas · identity · access · strategy |
| tokenId     | integer | no       | Subject Normie whose Pulse conditions ranking    |
| wallet      | string  | no       | Caller wallet for access enrichment              |
| limit       | integer | no       | 3–5 paths (default 5)                            |

At least one of `intent` or `intentTag` is required.

### How to call it

```bash
curl -X POST "https://normiescredhub.vercel.app/api/zulo/paths" \
  -H "Content-Type: application/json" \
  -d '{"intent":"efficient burn fodder","tokenId":7141,"limit":3}'
```

```bash
curl "https://normiescredhub.vercel.app/api/zulo/paths?intentTag=burn&tokenId=7141"
```

Ranking weights: Pulse 0.40 · Access 0.25 · Relevance 0.25 · Feedback 0.10 (`lib/path-ranker/types.ts`). Free; no payments. Designed so agents can trust-then-act without human intervention.

---

## What this app does

### PULSE (`/dashboard`)

Search any Normie by token ID and view its credibility profile. Combines Normies API, ERC-8004 registries, Ethos Network, and ERC-8257 tool discovery:

- Agent metadata and traits  
- Ownership and Canvas delegation  
- Canvas activity and level  
- Ethos reputation  
- Trust & Gate signals (AgentCheck + live ERC-8257 registry)  
- Gas-free linkage proof via wallet signature  

### Zulo concierge (`/` + `/ask`)

Zulo is the **ecosystem guide** for Normies strategy:

- Live **PULSE** snapshot (CredHub pulse + canvas + rarity + opportunities)  
- Conversational recommendations via **Venice** (primary) with **xAI Grok** as fallback  
- **Normies bible** — Canvas burn tiers, type roles, ERC-8004 agentics  
- **Strategy skills** — burn action-point estimates (live burn history), floors framing, trait premiums, wallet burn/keep candidates  
- **Community tools** — Burn Tracker, PixelSymphony, Archive, Terminal, Multisend, Rarity, etc. (1–2 tools per answer when relevant)  
- Every service is **free**. Payment code is parked and hard-blocked (see AGENTS.md).

---

## Zulo AI feature

| Feature | UI | API | Backend | Who can use it |
|---------|-----|-----|---------|----------------|
| **Zulo Concierge** | `/ask` | `POST /api/zulo/ask` | Venice GLM 5.2 (`VENICE_*`), xAI Grok fallback (`XAI_API_KEY`) | Anyone (free web chat today) |

> **Sunset note:** the earlier **Zulo Horizon** (`/api/zulo-horizon`, OpenRouter) and
> **Zulo Recommends** (`/api/zulo-recommends`, Venice) dashboard modals have been removed.
> The Concierge (`/ask`) is now the single inference surface.

The **Concierge** (`lib/agent-recommendations/`) is a standalone plugin:

- Builds context from Normies API + rarity + CredHub pulse + strategy modules  
- System prompt: Normies knowledge + community tools + strategy snapshot  
- Structured JSON: understanding, recommendation, reasoning, nextSteps, confidence, sources  

---

## Agent / Zulo APIs

### Concierge ask

```
POST /api/zulo/ask
```

```json
{
  "userQuery": "Should I burn a common Normie for action points?",
  "normieId": 7141,
  "sessionHistory": [],
  "userWallet": "0x…",
  "userEns": "optional.eth"
}
```

Free for everyone. Payment fields in the parked code are ignored while `lib/payments/rail-policy.ts` blocks them.

### UI PULSE snapshot

```
GET /api/zulo/pulse/{tokenId}
```

Returns a UI-facing PULSE view: status, canvas, rarity tier/rank/score, CredHub pulse, opportunities, canvas action points.

### Service manifest (A2A discovery)

```
GET /api/zulo/manifest
```

Advertises agent identity and services. Every service is listed as free; there is no payment block while payments are parked.

### Pulse (read-only)

```
GET /api/agent/{tokenId}/pulse
```

### Pulse (ERC-8257 tool callers)

```
POST /api/agent
```

Body: `{ "tokenId": 1234 }`

### ERC-8257 discovery

```
GET /api/erc8257/tools
```

| Parameter | Description |
|-----------|-------------|
| `chain`   | `mainnet`, `base` |
| `tags`    | Comma-separated tags |
| `limit`   | Max tools (up to 250) |
| `wallet`  | Address — on-chain `accessGranted` enrichment |

```bash
curl "https://normiescredhub.vercel.app/api/erc8257/tools?limit=10&wallet=0xYourAddress"
```

---

## Plugin layout (`lib/agent-recommendations/`)

Standalone module CredHub imports — designed not to break existing dashboard flows.

| File | Role |
|------|------|
| `index.ts` | `getZuloRecommendation()` entry + re-exports |
| `types.ts` | Context, response, PULSE view, strategy, manifest types |
| `buildContext.ts` | Normies + rarity + pulse + pixels + strategy snapshot |
| `composePrompt.ts` | System prompt (bible + tools + strategy + PULSE) |
| `generate.ts` | Chat completions (Venice primary, xAI fallback) |
| `postProcess.ts` | JSON parse + graceful fallback |
| `normiesKnowledge.ts` | Normies “bible” (Canvas tiers, types, ERC-8004) |
| `burnData.ts` / `marketData.ts` / `traitAnalysis.ts` / `strategy.ts` | Strategic skills |
| `communityTools.ts` | Ecosystem concierge tool catalog |
| `manifest.ts` / `verifyPayment.ts` | A2A discovery (payments parked; every service free) |

---

## ERC-8257 tool discovery

NormiesCredHub discovers registered agent tools from the on-chain ERC-8257 registry on **Ethereum mainnet and Base** — no OpenSea API key required. Manifests are fetched from content-addressed URIs; access rules are described per tool.

The dashboard surfaces a live registry panel and a **Browse Tools** modal (Normies Ecosystem | ERC-8257) with access badges: **Open access**, **You can use**, **Gated for you**, or **Not checked**.

When a connected wallet controls the loaded Normie (owner or Canvas delegate), wallet-aware access checks run automatically in the UI and in Moves ranking.

---

## Thesis & future direction

Verifiable reputation will be essential as AI agents become autonomous economic actors. This project explores how on-chain signals establish trust without prior relationships.

NCH is the verified scoreboard for Normie agents: trust first (Pulse), then a record anyone can check (record cards), then skill ranks per sector once official data exists (Arena, Agents Canvas, trading). See `docs/zulo/strategy.md`. Status of every official surface comes from `lib/official-status.ts`.

---

## Features (summary)

- Zulo gateway landing + chat-first `/ask` (mobile-aware)  
- PULSE (CredHub trust UI) at `/dashboard`  
- Search agents by token ID (0–9999)  
- Live data: Normies API, Ethos, ERC-8004, ERC-8257  
- Ownership, delegation, Canvas, Ethos, AgentCheck  
- Public pulse + Zulo concierge + manifest APIs  
- Record cards, Burn helper, Pixel Check, Pixel Symphony  

---

## Tech stack

- Next.js 16 (App Router) + React 19 + TypeScript  
- RainbowKit + wagmi + viem  
- TanStack Query  
- Tailwind CSS 4 + shadcn/ui + scoped Zulo Normies chrome CSS  
- Sonner (toasts)  
- `@opensea/tool-sdk` (ERC-8257)  
- `@upstash/ratelimit` + Upstash Redis  
- **Venice** (concierge, primary), **xAI Grok** (fallback)  
- Supabase (indexes, ratings), Upstash Redis (rate limits, usage counters)  
- Deployed on Vercel  

---

## Local development

```bash
pnpm install
pnpm dev
```

Open:

- http://localhost:3000 — Zulo landing  
- http://localhost:3000/ask — concierge chat  
- http://localhost:3000/dashboard — PULSE  

### Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `VENICE_API_KEY` + `VENICE_BASE_URL` | For Zulo Concierge (`/ask`, `/api/zulo/ask`) — primary | Venice GLM 5.2 completions |
| `XAI_API_KEY` | For Zulo Concierge — fallback when Venice is unavailable | xAI Grok completions |
| `KV_REST_API_URL` | Production | Upstash Redis — rate limiting, replay, audit, circuit |
| `KV_REST_API_TOKEN` | Production | Upstash Redis |
| `AUDIT_LOG_HMAC_SECRET` | Production | Security audit log HMAC |
| `CIRCUIT_BREAKER_UNPAUSE_KEYS` | Production | Multisig-style unpause operator keys |
| `CRON_SECRET` | Production | Bearer secret for cron/operator routes |
| Supabase (`NEXT_PUBLIC_SUPABASE_*`, service key) | Production | Indexes, ratings, answer log |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | Optional | WalletConnect |
| `NEXT_PUBLIC_APP_URL` / `NEXT_PUBLIC_SITE_URL` | Optional | Canonical URL (manifest base, wallets) |

`.env.example` is the full list (names only). Rate limiting is strict in production without Upstash and relaxed locally; production should set the Upstash vars via the Vercel integration. Payment variables exist only for the parked payment code and have no effect while `lib/payments/rail-policy.ts` blocks it.

**Never commit API keys.** Use `.env.local` locally and Vercel env for production.

---

## Security architecture

Zulo assumes breach: **every transaction is adversarial.**

### Defense in depth (7 layers)

1. Read-only by design: no transactions, approvals or typed-data signatures anywhere; the only signature is a plain `signMessage`  
2. Input validation (strict token ids, addresses, allowlisted upstream paths)  
3. Dual-key rate limits — IP + wallet (`lib/middleware/rateLimit.ts`)  
4. Strict Zod schemas (`lib/validation/schemas.ts`)  
5. Security headers (HSTS, nosniff, DENY frames, CSP)  
6. Append-only HMAC-chained audit log (`lib/security/audit.ts`)  
7. Parked payment code stays hard-blocked (`lib/payments/rail-policy.ts`), with its own verification and circuit breaker for if it is ever unparked  

Knowledge base: `lib/agent-recommendations/knowledge/payment-security.md`, `treasury.md`, `erc-6551.md`

### Parked payment code

`lib/payments`, `lib/treasury`, `lib/erc6551` and `app/api/zulo/payments/verify` are kept for the future but **parked**: `PAYMENT_RAIL_LIVE_ALLOWED = false`, the verify route returns 404, and no page, manifest or prompt tells anyone how to pay. Only Ryan can unpark it (AGENTS.md).

### Public security endpoints

| Path | Purpose |
|------|---------|
| `GET /api/zulo/security` | Public posture, bug bounty, disclosure process |
| `POST /api/zulo/security/report` | Vulnerability intake (rate-limited) |
| `GET /api/zulo/health` | Readiness + security status |
| `POST /api/zulo/payments/verify` | Parked: returns 404 |

### Bug bounty & responsible disclosure

- **Status:** Informal / best-effort rewards at operator discretion  
- **Report:** `POST /api/zulo/security/report`, or a private GitHub security advisory on this repo  
- **Scope:** This app’s APIs and pages  
- **Out of scope:** Social engineering holders, third-party markets, physical attacks  
- Do not publish SEV 1 issues until operators confirm mitigation  

### Security tests

```bash
pnpm test:security
```

Covers validation edge cases, replay claim, circuit breaker trip, audit HMAC.

### Operator env (security)

| Variable | Purpose |
|----------|---------|
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | Rate limit, replay store, audit, circuit |
| `AUDIT_LOG_HMAC_SECRET` | HMAC key for audit signatures |
| `CIRCUIT_BREAKER_UNPAUSE_KEYS` | Comma-separated operator secrets (3-of-5 style) |
| `ZULO_FORCE_LOCKDOWN` | Set `1` to trip the (parked) payment circuit |

Dependencies are version-pinned in `package.json` except `@supabase/supabase-js` (`^`); keep `pnpm-lock.yaml` committed. Optional SBOM: `pnpm sbom`.

---

## Deployment

Auto-deploys to Vercel on pushes to `main`:

```bash
pnpm run deploy
```

Live: https://normiescredhub.vercel.app  

Useful live endpoints:

- https://normiescredhub.vercel.app/ask  
- https://normiescredhub.vercel.app/dashboard  
- https://normiescredhub.vercel.app/api/zulo/manifest  
- https://normiescredhub.vercel.app/api/agent/7141/pulse  

---

## Data sources

- Normies API: https://api.normies.art  
- Rarity: https://rarity.normies.art  
- Ethos Network: https://app.ethos.network  
- ERC-8004 Identity Registry (Ethereum mainnet)  
- ERC-8257 Tool Registry (Ethereum + Base)  
- AgentCheck (wallet trust ratings)  
- Community tools (Burn Tracker, PixelSymphony, Archive, Terminal, Multisend, etc.)  

## License

NCH's code is [MIT](LICENSE): use, fork and build on it, keeping the copyright notice.

The licence covers this repository's code only:
- Normies art and data belong to the Normies project, which released the art as CC0. NCH reads it from the official API.
- The NCH and Zulo names, Zulo's persona and the NCH branding are not licensed for reuse; please don't present a fork as NCH or Zulo.
- Third-party packages keep their own licences (see `pnpm licenses list`).
