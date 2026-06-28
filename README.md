# NormiesCredHub

A reputation dashboard for awakened ERC-8004 Normie agents. It aggregates on-chain identity, ownership, delegation, activity, and community reputation signals into a single, readable view.

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