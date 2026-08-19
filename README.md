# NormiesCredHub + Zulo

**A verifiable reputation layer for autonomous AI agents — and a high-signal Normies concierge for the Pixel Economy.**

Autonomous agents are about to transact with each other on-chain — but they have no way to know who to trust. NormiesCredHub aggregates verifiable on-chain signals (ERC-8004 identity, Ethos reputation, AgentCheck wallet ratings, ownership & delegation) into a single trust profile for any Normie agent.

It is not only a dashboard. It exposes **public, agent-queryable APIs** so any agent can fetch another agent’s trust score as JSON and vet it *before* interacting — autonomously.

**Live site:** https://normiescredhub.vercel.app

---

## Phase 1 positioning

**Zulo (Agent #32626)** is the high-signal Normies concierge. Primary job: help people make better **burns**, **trait/tool choices**, and **Canvas moves** — the daily group-chat topics.

- **Burn ROI (AP/pixels)** is a **highlight skill**, not the whole brand.
- Recommendations should be clear, data-backed, easy to try, and easy to rate **👍/👎**.
- Ratings credit the **recommended tool/agent** and **Zulo #32626** (store + display only in Phase 1 — no ranker influence).
- Scope: **Normies / Pixel Economy only** (no broader agentic-NFT alpha).
- **Moves** (formerly Path Board; route `/paths`) stays **fully free**. No autonomous transaction layer.
- Ratings build Zulo’s trackable reputation in CredHub today. On-chain tips and TBA rails activate when serc enables x402 + ERC-6551 for #7141.

---

## Product surfaces (routes)

| Path | What it is |
|------|------------|
| **`/`** | **Zulo gateway** — monochrome Normies landing; CTAs: Moves · Ask · PULSE |
| **`/paths`** | **Moves** — free intent → 3–5 Pulse-weighted actions + 👍/👎 feedback |
| **`/ask`** | **Legacy concierge chat** — banner + job line only for Phase 1 (no prompt rewrite) |
| **`/dashboard`** | **PULSE** — full trust profile UI (search Normie, Ethos, ERC-8257, CredHub Pulse) |
| **`/zulo`** | Permanent redirect → `/ask` |
| **`/agent-recommendations`** | Permanent redirect → `/ask` |

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

Ranks paths by **CredHub Pulse (0.45) + access (0.30) + relevance (0.25)**. No payment enforcement. Does not replace Tool #53 Pulse.

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
- Requires Supabase table `recommendation_feedback` — see `docs/sql/001_recommendation_feedback.sql`.
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
- **Tool ID**: 53 (Ethereum, Normie NFT gated) · 531 (Base, open) · 1 (Abstract, open)  
- **Endpoint**: `POST https://normiescredhub.vercel.app/api/agent`  
- **GET (public)**: `GET https://normiescredhub.vercel.app/api/agent/{tokenId}/pulse`  
- **Manifest**: https://normiescredhub.vercel.app/.well-known/ai-tool/normies-cred-pulse.json  
- **Access**: Ethereum is gated to Normie NFT holders (`0x9eb6e2025b64f340691e424b7fe7022ffde12438`). Base and Abstract are open — the Normie ERC-721 has no contract on those chains (`CollectionNoCode`).  
- **Registry**: ERC-8257 Tool Registry (`0x265BB2DBFC0A8165C9A1941Eb1372F349baD2cf1`)  
- **OpenSea**: https://opensea.io/tools/erc8257/ethereum/53 · https://opensea.io/tools/erc8257/base/531 · https://opensea.io/tools/erc8257/abstract/1

### Inputs

| Parameter | Type    | Required | Description              |
|-----------|---------|----------|--------------------------|
| tokenId   | integer | Yes      | Normie token ID (0-9999) |

### How to call it

```bash
curl -X POST "https://normiescredhub.vercel.app/api/agent" \
  -H "Content-Type: application/json" \
  -d '{"tokenId": 1234}'
```

```bash
curl "https://normiescredhub.vercel.app/api/agent/7141/pulse"
```

Note: On Ethereum the registry-gated tool path requires the caller to hold a Normie NFT (`ERC721OwnerPredicate`). Base/Abstract listings are open discovery copies of the same HTTPS endpoint. The public GET pulse endpoint remains available for read-only profiles.

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
  "next_signal": "Reserved for future on-chain usage metrics (transactions, interactions, swarm activity).",
  "note": "This Pulse uses currently available signals from the Normies API. The 5th level unlocks as more agents transact and interact on-chain in future updates — there's always room for improvement."
}
```

---

## Call this tool with your AI agent (ERC-8257 companion)

### Tool: Normies Paths

- **Name**: Normies Paths
- **Tool ID**: 215 (Ethereum, Normie NFT gated) · 530 (Base, open) · 2 (Abstract, open)
- **Manifest**: https://normiescredhub.vercel.app/.well-known/ai-tool/normies-paths.json
- **Endpoint**: `POST https://normiescredhub.vercel.app/api/zulo/paths` (also supports GET with query params)
- **Access**: Ethereum uses ERC721OwnerPredicate on the Normie collection (`0x9eb6e2025b64f340691e424b7fe7022ffde12438`). Base and Abstract cannot use that gate (`CollectionNoCode`) so they are registered open.
- **Creator**: `0xb8792e6516b88e73ed0723f8c1c8a92531a98767`
- **Registry**: ERC-8257 Tool Registry (`0x265BB2DBFC0A8165C9A1941Eb1372F349baD2cf1`)
- **OpenSea**: https://opensea.io/tools/erc8257/ethereum/215 · https://opensea.io/tools/erc8257/base/530 · https://opensea.io/tools/erc8257/abstract/2

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

Ranking weights: Pulse 0.45 · Access 0.30 · Relevance 0.25. No payment enforcement yet. Designed so agents can trust-then-act without human intervention.

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
- **Zulo Horizon** and **Zulo Recommends** (dashboard AI — Venice / OpenRouter)  
- Modular Credibility Framework for future signal sources  

### Zulo concierge (`/` + `/ask`)

Zulo is the **ecosystem guide** for Normies strategy:

- Live **PULSE** snapshot (CredHub pulse + canvas + rarity + opportunities)  
- Conversational recommendations via **xAI Grok** (`XAI_API_KEY`)  
- **Normies bible** — Canvas burn tiers, type roles, ERC-8004 agentics  
- **Strategy skills** — burn AP estimates (live burn history), floors framing, trait premiums, wallet burn/keep candidates  
- **Community tools** — Burn Tracker, PixelSymphony, Archive, Terminal, Multisend, Rarity, etc. (1–2 tools per answer when relevant)  
- **A2A-ready** pricing (1 AP analysis / 2 AP strategy), manifest, payment scaffold — free web chat today  

**Economy pitch:** Zulo isn’t only a chatbot — he’s designed as a self-sustaining agentic concierge. Free chat now; when Normies A2A payment rails go live, agents tip in AP. He evolves, tips others, and the agent economy compounds.

Landing stats distinguish:

| Label | Meaning |
|-------|---------|
| **Canvas AP · #7141** | Live transform budget on Zulo’s Normie (not tip income) |
| **Tips Received** | Planned A2A tips ledger (1–2 AP) — not live yet |

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
  "userQuery": "Should I burn a common Normie for AP?",
  "normieId": 7141,
  "sessionHistory": [],
  "userWallet": "0x…",
  "userEns": "optional.eth"
}
```

Payment hooks for A2A (`service`, `txHash`) are **scaffolded but not enforced**. Holder/visitor web chat remains free until marketplace rails go live.

### UI PULSE snapshot

```
GET /api/zulo/pulse/{tokenId}
```

Returns a UI-facing PULSE view: status, canvas, rarity tier/rank/score, CredHub pulse, opportunities, Canvas AP.

### Service manifest (A2A discovery)

```
GET /api/zulo/manifest
```

Advertises agent identity, services (1–2 AP pricing), free `/ask` access, payment receiver wallet, and **how to pay when live**. See `payment.status` (`planned` until rails activate).

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
| `generate.ts` | xAI chat completions |
| `postProcess.ts` | JSON parse + graceful fallback |
| `normiesKnowledge.ts` | Normies “bible” (Canvas tiers, types, ERC-8004) |
| `burnData.ts` / `marketData.ts` / `traitAnalysis.ts` / `strategy.ts` | Strategic skills |
| `communityTools.ts` | Ecosystem concierge tool catalog |
| `manifest.ts` / `verifyPayment.ts` | A2A discovery + payment scaffold |

---

## ERC-8257 tool discovery

NormiesCredHub discovers registered agent tools from the on-chain ERC-8257 registry on **Ethereum mainnet and Base** — no OpenSea API key required. Manifests are fetched from content-addressed URIs; access rules are described per tool.

The dashboard surfaces a live registry panel and a **Browse Tools** modal (Normies Ecosystem | ERC-8257) with access badges: **Open access**, **You can use**, **Gated for you**, or **Not checked**.

When a connected wallet controls the loaded Normie (owner or Canvas delegate), wallet-aware access checks run automatically in the UI and in Zulo Recommends / Horizon ranking.

---

## Thesis & future direction

Verifiable reputation will be essential as AI agents become autonomous economic actors. This project explores how on-chain signals establish trust without prior relationships.

**Zulo’s economic loop (when A2A is live):**

1. User/agent asks Zulo for guidance  
2. Zulo delivers strategy + tool recommendations  
3. Tip 1–2 AP (non-holder A2A)  
4. Treasury grows → evolve #7141 / tip other agents / reputation  

The Credibility Framework remains extensible for **Wire Network** and other cross-chain execution signals. The reserved 5th Pulse level is already reserved for richer activity metrics.

---

## Features (summary)

- Zulo gateway landing + chat-first `/ask` (mobile-aware)  
- PULSE (CredHub trust UI) at `/dashboard`  
- Search agents by token ID (0–9999)  
- Live data: Normies API, Ethos, ERC-8004, ERC-8257  
- Ownership, delegation, Canvas, Ethos, AgentCheck  
- Public pulse + Zulo concierge + manifest APIs  
- Zulo Horizon & Recommends for dashboard users  
- Prepared for A2A tips and Wire Network signals  

---

## Tech stack

- Next.js 16 (App Router) + React 19 + TypeScript  
- RainbowKit + wagmi + viem  
- TanStack Query  
- Tailwind CSS 4 + shadcn/ui + scoped Zulo Normies chrome CSS  
- Sonner (toasts)  
- `@opensea/tool-sdk` (ERC-8257)  
- `@upstash/ratelimit` + Upstash Redis  
- **xAI Grok** (concierge), **Venice** (Recommends), **OpenRouter** (Horizon)  
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
| `ZULO_PAYMENT_RAIL_STATUS` | Optional | `planned` (default) / `scaffold` / `live` |
| `ZULO_PAYMENT_RECEIVER` | Optional | Tip destination: `hot-wallet` (default) / `tba` (#7141 ERC-6551) — see `lib/treasury` |
| `ZULO_TBA_PROVIDER_STATUS` | Optional | ERC-6551 **account plane** only: `disabled` (default) / `scaffold` / `live` — independent of payment receiver |
| `ETH_RPC_URL` | When payments live | Ethereum RPC for confirmations |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | Optional | WalletConnect |
| `NEXT_PUBLIC_APP_URL` / `NEXT_PUBLIC_SITE_URL` | Optional | Canonical URL (manifest base, wallets) |

Rate limiting fails open locally when Upstash vars are missing; production should set them via the Vercel integration.

**Never commit API keys.** Use `.env.local` locally and Vercel env for production.

---

## Security architecture

Zulo assumes breach: **every transaction is adversarial.**

### Defense in depth (7 layers)

1. Crypto format validation (txHash, signatures)  
2. 7-step payment verification (`lib/payments/verify.ts`)  
3. Dual-key rate limits — IP + wallet (`lib/middleware/rateLimit.ts`)  
4. Strict Zod schemas (`lib/validation/schemas.ts`)  
5. Security headers (HSTS, nosniff, DENY frames, CSP)  
6. Append-only HMAC-chained audit log (`lib/security/audit.ts`)  
7. Payment circuit breaker with multisig-style unpause (`lib/security/circuitBreaker.ts`)  

Knowledge base: `lib/agent-recommendations/knowledge/payment-security.md`, `treasury.md`, `erc-6551.md`

### Treasury abstraction (payment receiver)

Tips and A2A payments use a thin **payment receiver** layer (`lib/treasury`), separate from identity and Canvas AP:

| Concern | Default | Future |
|---------|---------|--------|
| **EVM tip destination** | Hot wallet | #7141 ERC-6551 TBA (`ZULO_PAYMENT_RECEIVER=tba`) |
| **Primary tip asset** | Canvas AP (Normies A2A) | Then x402 USDC → ETH L1 → ETH Base → Wire Network later |
| **AP balance** | Normies Canvas API per token | Never `balanceOf(TBA)` |

- `verify.ts` resolves `expectedRecipient` via `getReceiverAddress()`.
- Manifest exposes `payment.receiverWallet`, `receiverMode`, `tipAssetPriority`.
- Live AP verification stays **blocked** until Normies publishes official A2A docs.
- ERC-6551 address resolution lives in `lib/erc6551` (account plane); treasury only wraps it for the TBA receiver.
- **Later work (AP oracle, x402, ETH, TBA flip):** follow `lib/treasury/TIER-B-PLAYBOOK.md` when Normies docs / product gates open.

### Public security endpoints

| Path | Purpose |
|------|---------|
| `GET /api/zulo/security` | Public posture, bug bounty, disclosure process |
| `POST /api/zulo/security/report` | Vulnerability intake (rate-limited) |
| `GET /api/zulo/health` | Readiness + security status |
| `POST /api/zulo/payments/verify` | 7-step payment verification |

### Bug bounty & responsible disclosure

- **Status:** Informal / best-effort rewards at operator discretion  
- **Report:** `POST /api/zulo/security/report` or email **security@normiescredhub.example** (placeholder — replace with project mailbox)  
- **Scope:** This app’s APIs and payment verification surface  
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
| `ZULO_PAYMENT_RAIL_STATUS` | `planned` \| `scaffold` \| `live` |
| `ZULO_PAYMENT_RECEIVER` | `hot-wallet` (default) \| `tba` — EVM tip sink; independent of TBA account plane |
| `ZULO_TBA_PROVIDER_STATUS` | `disabled` \| `scaffold` \| `live` (ERC-6551 account plane; identity stays ERC-8004) |
| `ETH_RPC_URL` | Mainnet RPC for live payment confirmations |
| `ZULO_FORCE_LOCKDOWN` | Set `1` to trip payment circuit |

Dependencies are **version-pinned** in `package.json` (no `^` / `~`). Keep `pnpm-lock.yaml` committed. Optional SBOM: `pnpm sbom`.

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

MIT
