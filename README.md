# NormiesCredHub

**A verifiable reputation layer for autonomous AI agents.**

Autonomous agents are about to transact with each other on-chain — but they have no way to know who to trust. NormiesCredHub aggregates verifiable on-chain signals (ERC-8004 identity, Ethos reputation, AgentCheck wallet ratings, ownership & delegation) into a single trust profile for any Normie agent.

The key: it's not just a dashboard. It exposes a **public, agent-queryable API** so any agent can fetch another agent's trust score as JSON and vet it *before* interacting — autonomously.

```
GET /api/agent/{tokenId}/pulse
```

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

Today it scores the signals available on-chain right now. The framework is built to fold in transactional history and **Wire Network** cross-chain execution data as the ecosystem matures — reputation that grows with the agent. The reserved 5th Pulse level is already in place for it.

## Call this tool with your AI agent

Use the `opensea-tool-sdk` skill to set up access and call the tool below.

### Setup (one time)

1. Install the skill:  
   `npx skills add https://github.com/ProjectOpenSea/opensea-skill --skill opensea`

2. Install the SDK:  
   `npm install @opensea/tool-sdk`

3. Full docs: https://docs.opensea.io/docs/agent-tool-registry

### Tool

- **Name**: Normies Cred Pulse
- **Tool ID**: 53
- **Endpoint**: `POST https://normiescredhub.vercel.app/api/agent`
- **Manifest**: https://normiescredhub.vercel.app/.well-known/ai-tool/normies-cred-pulse.json
- **Access**: Gated to Normie NFT holders only (`0x9eb6e2025b64f340691e424b7fe7022ffde12438`)
- **Registry**: ERC-8257 Tool Registry on Ethereum + Base (`0x265BB2DBFC0A8165C9A1941Eb1372F349baD2cf1`)

### Inputs

| Parameter | Type    | Required | Description              |
|-----------|---------|----------|--------------------------|
| tokenId   | integer | Yes      | Normie token ID (0-9999) |

### How to Call It

```bash
curl -X POST "https://normiescredhub.vercel.app/api/agent" \
  -H "Content-Type: application/json" \
  -d '{"tokenId": 1234}'
```

Note: This tool requires the caller to hold a Normie NFT. On-chain access is enforced via the registry's `ERC721OwnerPredicate`.

## What This App Does

NormiesCredHub allows users to search any Normie by token ID and view its credibility profile. It combines data from the Normies API, ERC-8004 registries, Ethos Network, and the ERC-8257 agent tool registry to show how trustworthy and active an awakened agent is.

Key features include:
- Agent metadata and traits
- On-chain ownership and delegation status
- Canvas activity and customization level
- Ethos reputation score
- Trust & Gate signals (AgentCheck + live ERC-8257 tool registry)
- Gas-free linkage proof via wallet signature
- **Zulo Horizon** and **Zulo Recommends** (AI-powered insights — see below)
- A modular Credibility Framework designed to support future signal sources

Meet **Zulo, Normie #7141** — an awakened ERC-8004 agent bound by a constitution to *serve members, never exploit them*. He never asks for keys, pressures a transaction, or manufactures urgency; he reads an agent's on-chain signals and recommends genuinely useful ecosystem tools. (An app about agent trust, demonstrated by a trustworthy agent.)

## ERC-8257 Tool Discovery

NormiesCredHub discovers registered agent tools from the on-chain ERC-8257 registry on **Ethereum mainnet and Base** — no OpenSea API key required. Manifests are fetched from content-addressed URIs; access rules are described per tool.

### Discovery API

```
GET /api/erc8257/tools
```

Optional query parameters:

| Parameter | Description |
|-----------|-------------|
| `chain`   | Comma-separated filter: `mainnet`, `base` |
| `tags`    | Comma-separated tag filter |
| `limit`   | Max tools returned (up to 250) |
| `wallet`  | Ethereum address — enriches gated tools with on-chain `accessGranted` checks |

Example:

```bash
curl "https://normiescredhub.vercel.app/api/erc8257/tools?limit=10&wallet=0xYourAddress"
```

The dashboard surfaces a live registry panel and a **Browse Tools** modal (Normies Ecosystem | ERC-8257 tabs) with access badges: **Open access**, **You can use**, **Gated for you**, or **Not checked**.

When a connected wallet controls the loaded Normie (owner or Canvas delegate), wallet-aware access checks run automatically in the UI and in Zulo's tool ranking.

## Zulo (AI Features)

Two separate flows, two separate backends:

| Feature | Route | Backend | Who can use it |
|---------|-------|---------|----------------|
| **Zulo Horizon** | `POST /api/zulo-horizon` | OpenRouter (`OPENROUTER_API_KEY`) | Anyone — conversational chat with session limits |
| **Zulo Recommends** | `POST /api/zulo-recommends` | Venice (`VENICE_INFERENCE_KEY` / `VENICE_API_KEY`) | **Awakened agents only** (ERC-8004 binding required) |

Both features:
- Read the loaded agent's pulse, canvas, and Ethos signals
- Rank ERC-8257 registry tools by pulse gaps and wallet access (tools the holder can actually use are boosted)
- Never pressure wallet actions, purchases, or signing

**Zulo Recommends** returns a structured tool recommendation for a specific `tokenId`. **Zulo Horizon** is an open-ended chat grounded in the same signal data and tool knowledge.

## Thesis & Future Direction

Verifiable reputation will be essential as AI agents become autonomous economic actors. This project explores how on-chain signals can establish trust for agents without requiring prior relationships.

The Credibility Framework is built to be extensible. It is designed to incorporate future sources such as **Wire Network**, which provides deterministic, verifiable cross-chain execution history and transaction reliability signals. The system uses a modular `CredibilitySignal` structure to support these additions cleanly.

## Features

- Search agents by token ID (0–9999)
- Live data from Normies API, Ethos Network, and ERC-8004
- Ownership & delegation visualization
- Canvas activity tracking
- Ethos credibility scoring
- AgentCheck wallet trust signals
- Live ERC-8257 tool registry (Ethereum + Base) with wallet-aware access badges
- Zulo Horizon chat and Zulo Recommends for awakened agents
- Public API endpoints for agent pulse and ERC-8257 tool discovery
- Prepared for future Wire Network integration (Cross-Chain Execution signals)

## Agent Queryable API

### Pulse (read-only)

```
GET /api/agent/{tokenId}/pulse
```

Returns structured credibility data: pulse level, status, signal breakdown, `next_signal`, and `note`.

### Pulse (ERC-8257 tool callers)

```
POST /api/agent
```

Body: `{ "tokenId": 1234 }` — same response shape as the GET endpoint. Used by ERC-8257 Tool #53 discovery probes.

## Tech Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- RainbowKit + wagmi + viem
- TanStack Query
- Tailwind CSS 4 + shadcn/ui
- Sonner (toasts)
- `@opensea/tool-sdk` (ERC-8257 registry discovery and access checks)
- `@upstash/ratelimit` + Upstash Redis (rate limiting on AI endpoints)
- Deployed on Vercel

## Local Development

```bash
pnpm install
pnpm dev
```

### Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `OPENROUTER_API_KEY` | For Zulo Horizon | OpenRouter chat completions |
| `VENICE_INFERENCE_KEY` or `VENICE_API_KEY` | For Zulo Recommends | Venice AI (405B model) |
| `KV_REST_API_URL` | Production | Upstash Redis — rate limiting |
| `KV_REST_API_TOKEN` | Production | Upstash Redis — rate limiting |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | Optional | WalletConnect project ID |
| `NEXT_PUBLIC_APP_URL` | Optional | Canonical app URL for wallet metadata |

Rate limiting fails open locally when Upstash vars are missing; production should have them set via the Vercel integration.

## Deployment

Auto-deploys to Vercel on pushes to `main`. You can also deploy manually with:

```bash
pnpm run deploy
```

Live site: https://normiescredhub.vercel.app

## Data Sources

- Normies API: https://api.normies.art
- Ethos Network: https://app.ethos.network
- ERC-8004 Identity Registry (Ethereum mainnet)
- ERC-8257 Tool Registry (Ethereum mainnet + Base) — https://docs.opensea.io/docs/agent-tool-registry
- AgentCheck (wallet trust ratings)

## License

MIT