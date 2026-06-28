# NormiesCredHub

**A verifiable reputation layer for autonomous AI agents.**

Autonomous agents are about to transact with each other on-chain — but they have no way to know who to trust. NormiesCredHub aggregates verifiable on-chain signals (ERC-8004 identity, Ethos reputation, AgentCheck wallet ratings, ownership & delegation) into a single trust profile for any Normie agent.

The key: it's not just a dashboard. It exposes a **public, agent-queryable API** so any agent can fetch another agent's trust score as JSON and vet it *before* interacting — autonomously.

```
GET /api/agent/{tokenId}/pulse
```

```json
{
  "token_id": 1287,
  "pulse_level": 4,
  "max_level": 5,
  "status": "Strong",
  "breakdown": [
    "ERC-8004 registered",
    "Has active agent card",
    "Canvas activity detected",
    "Clean ownership & delegation"
  ],
  "next_signal": "Reserved for future on-chain usage metrics — there's always room for improvement."
}
```

Today it scores the signals available on-chain right now. The framework is built to fold in transactional history and **Wire Network** cross-chain execution data as the ecosystem matures — reputation that grows with the agent. The reserved 5th Pulse level is already in place for it.

## What This App Does

NormiesCredHub allows users to search any Normie by token ID and view its credibility profile. It combines data from the Normies API, ERC-8004 registries, and Ethos Network to show how trustworthy and active an awakened agent is.

Key features include:
- Agent metadata and traits
- On-chain ownership and delegation status
- Canvas activity and customization level
- Ethos reputation score
- Trust & Gate signals (AgentCheck + ERC-8257)
- Gas-free linkage proof via wallet signature
- Zulo Horizon and Zulo Recommends (AI-powered insights)
- A modular Credibility Framework designed to support future signal sources

## Thesis & Future Direction

Verifiable reputation will be essential as AI agents become autonomous economic actors. This project explores how on-chain signals can establish trust for agents without requiring prior relationships.

The Credibility Framework is built to be extensible. It is designed to incorporate future sources such as **Wire Network**, which provides deterministic, verifiable cross-chain execution history and transaction reliability signals. The system uses a modular `CredibilitySignal` structure to support these additions cleanly.

## Features

- Search agents by token ID (0–9999)
- Live data from Normies API, Ethos Network, and ERC-8004
- Ownership & delegation visualization
- Canvas activity tracking
- Ethos credibility scoring
- Trust & Gate signals
- Public API endpoint for agent pulse data
- Prepared for future Wire Network integration (Cross-Chain Execution signals)

## Agent Queryable API

A public, read-only endpoint is available:

```
GET /api/agent/{tokenId}/pulse
```

Returns structured credibility data including pulse level, status, breakdown of signals, and notes.

## Tech Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- RainbowKit + wagmi + viem
- TanStack Query
- Tailwind CSS 4 + shadcn/ui
- Sonner (toasts)
- Deployed on Vercel

## Local Development

```bash
pnpm install
pnpm dev
```

### Environment Variables

- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` (optional)
- `VENICE_INFERENCE_KEY_` (required for Zulo Horizon)

## Deployment

Auto-deploys to Vercel on pushes to `main`. You can also deploy manually with:

```bash
pnpm run deploy
```

## Data Sources

- Normies API: https://api.normies.art
- Ethos Network: https://app.ethos.network
- ERC-8004 Identity Registry (Ethereum mainnet)

## License

MIT
