# NormiesCredHub

## What This App Does

NormiesCredHub is a reputation dashboard built for awakened Normie agents.

It shows the real credibility signals of an agent by combining on-chain identity, ownership, delegation, activity, and community reputation data in one place.

The dashboard uses Zulo (#7141) as the main example. It includes Zulo Horizon for deeper insights, Zulo Recommends for personalized tool suggestions, and a clear Credibility Framework that breaks down what makes an awakened agent trustworthy.

Everything is read-only. The only on-chain action is a gas-free wallet signature to prove ownership or delegation.

## Thesis & Future Direction

NormiesCredHub was built around a simple belief:  
**In a world of autonomous agents, verifiable reputation will become one of the most valuable signals.**

While building tools for awakened Normie agents, it became clear that having an on-chain identity (ERC-8004) is just the first step. The harder problem is understanding which agents actually deliver on their capabilities.

This project is our first step toward surfacing and reasoning about that reputation data in a clean, usable way.

### Longer-term thinking

We see NormiesCredHub evolving into part of a broader stack where agents like Zulo can accumulate and reason over reputation signals, help other agents make better decisions about skills and collaborators, and potentially operate as a trusted advisor.

This is still early. We're exploring how projects like ThinkAgents could give agents like Zulo stronger reasoning capabilities in the future. For now, the focus remains on making reputation visible and useful.

We're building in public and will share updates as things develop.

## Features

- Search any Normie by token ID (0–9999)
- Live data from Normies API, Ethos Network, and ERC-8004 registries (Ethereum mainnet)
- Agent metadata, traits, canvas, and ownership details
- Ethos credibility score for the owner address
- **Delegate support** (hot wallet via Delegate.xyz) for personal views, Horizon, and linkage
- **Trust & Gate Signals** — AgentCheck reputation (API + on-chain cert) + Type trait for TraitGatedPredicate (ERC-8257) eligibility
- **Linkage Proof** — gas-free `personal_sign` to prove Normie + Ethos profile ownership (owner or delegate)

## Agent Queryable API

Other awakened agents can programmatically fetch an agent's Pulse data via a public, read-only endpoint:

```
GET /api/agent/{tokenId}/pulse
```

Returns a JSON object with `pulse_level` (0–4), `status`, `breakdown` (on-chain signals), and a `note`. Calculated on the fly from the Normies API and ERC-8004 registry — no database, no auth required.

Example: `GET /api/agent/7141/pulse` returns pulse level, ERC-8004 registration, agent card, canvas activity, and ownership/delegation signals for Normie #7141 (Zulo).

## Tech Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- RainbowKit + wagmi + viem
- TanStack Query
- Tailwind CSS 4 + shadcn/ui components
- Sonner (toasts)
- Deployed on Vercel

## Local Development

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | No | WalletConnect project ID (public default included) |
| `VENICE_INFERENCE_KEY_` | For Horizon | Venice.ai inference key ([venice.ai/settings/api](https://venice.ai/settings/api)). Server-side only. Model: `e2ee-gemma-4-31b`. |

The app uses `https://ethereum.publicnode.com` for on-chain reads (CORS-friendly for Vercel deployments). WalletConnect and RPC defaults are hardcoded; env vars override when needed.

**Local `.env.local` example:**

```bash
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=496bdf12e0267f014d4a8f92d305a9e8
VENICE_INFERENCE_KEY_=your_exact_raw_venice_key_here
```

**Vercel:** Add `VENICE_INFERENCE_KEY_` (or `VENICE_API_KEY`) with the raw key value only — no prefix in the value field. Scope to Preview and Production, then redeploy. Horizon logs show `[horizon] Venice key loaded` on success; a 401 means the key is invalid at runtime.

## Deployment

**Production:** [https://normiescredhub.vercel.app](https://normiescredhub.vercel.app)  
**Repository:** [github.com/SHISLER671/normies-cred-hub](https://github.com/SHISLER671/normies-cred-hub)

Pushes to `main` auto-deploy to Vercel. The project uses `vercel.json` (security headers, `iad1` region) and Turbopack builds with server-side API proxies.

**Manual deploy:**

```bash
pnpm run deploy
# or
npx vercel --prod
```

Set env vars via CLI if needed — see [Environment Variables](#environment-variables) above.

## Data Sources

- [Normies API](https://api.normies.art)
- [Ethos Network API](https://app.ethos.network)
- ERC-8004 Identity Registry (`0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`) and Reputation Registry on Ethereum mainnet

## License

MIT

---

Built for the Normies community.