# NormiesCredHub

### What This App Does

NormiesCredHub is a reputation dashboard built for awakened Normie agents.

It shows the real credibility signals of an agent by combining on-chain identity, ownership, delegation, activity, and community reputation data in one place.

The dashboard uses Zulo (#7141) as the main example. It includes Zulo Horizon for deeper insights, Zulo Recommends for personalized tool suggestions, and a clear Credibility Framework that breaks down what makes an awakened agent trustworthy.

Everything is read-only. The only on-chain action is a gas-free wallet signature to prove ownership or delegation.

### Thesis & Future Direction

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
- Live data from:
  - Normies API
  - Ethos Network reputation
  - ERC-8004 Identity & Reputation Registries (Ethereum mainnet)
- Agent metadata, traits, canvas, and ownership details
- Ethos credibility score for the owner address
- **Delegate support** (hot wallet via Delegate.xyz) — full recognition of delegated Normies for personal views, Horizon, and linkage
- **Trust & Gate Signals** — AgentCheck reputation (API + on-chain cert) + Type trait for on-chain TraitGatedPredicate (ERC-8257) eligibility
- **Linkage Proof** — gas-free wallet signature to prove you own both the Normie and the Ethos profile (supports owner + delegate)
- Zulo Horizon suggestions (AI-powered, with trait context)

## Agent Queryable API

Other awakened agents can programmatically fetch an agent's Pulse data via a public, read-only endpoint:

```
GET /api/agent/{tokenId}/pulse
```

Returns a JSON object with `pulse_level` (0–4), `status`, `breakdown` (on-chain signals), and a future-proof `note`. Calculated on the fly from the Normies API and ERC-8004 registry — no database, no auth required.

Example: `GET /api/agent/7141/pulse` → Pulse level, ERC-8004 registration, agent card, canvas activity, and ownership/delegation signals for Normie #7141 (Zulo).

**Security-first**: The app is strictly read-only. The only on-chain action is a plain `personal_sign` message to prove identity linkage.

## Tech Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- RainbowKit + wagmi + viem
- TanStack Query
- Tailwind CSS 4 + shadcn/ui components
- Sonner (toasts)
- Deployed on Vercel

## Local Development

```bash
# Install dependencies (pnpm recommended)
pnpm install

# Start dev server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | No | WalletConnect project ID (we use a working public default) |
| `VENICE_INFERENCE_KEY_` | For deeper Horizon insights | Your Venice.ai Inference Key (exact raw value, e.g. the OUEg... or VENICE-INFERENCE-KEY-... string from https://venice.ai/settings/api). Model = e2ee-gemma-4-31b. Must be server-side only (no NEXT_PUBLIC_). |

**RPC note (important for deployed Vercel):** The app now uses explicit CORS-friendly RPC `https://ethereum.publicnode.com` for all on-chain reads (wagmi + direct viem clients in useMyNormies / ENS). This fixes browser "Failed to fetch" / CORS errors against default public RPCs when running on vercel.app. The Horizon (and personal features) rely on these reads succeeding from the browser.

Create a `.env.local` file if needed:

```bash
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=496bdf12e0267f014d4a8f92d305a9e8
VENICE_INFERENCE_KEY_=your_exact_raw_venice_key_here   # paste the exact raw key value (OUEg... or full), no name prefix, no quotes/spaces
```

**Vercel env setup (critical for Horizon):**
- Add `VENICE_INFERENCE_KEY_` (recommended) or `VENICE_API_KEY`.
- Set the **exact key value** copied from Venice (no `VENICE_INFERENCE_KEY_=` prefix in the value field).
- Scope it to **Preview** (for *-xxxx.vercel.app deploys) **and** Production.
- After changing env vars, use "Redeploy" in Vercel dashboard (or push a commit) so the new dpl picks up the vars. Function logs will show `[horizon] Venice key loaded (len=..., prefix=...)`.
- If you see 401: the key string in Vercel at runtime does not match a valid Venice key.

(The app hardcodes solid defaults for WC + RPC; envs override for prod control.)

## Deployment

### Live

**Production:** https://normiescredhub.vercel.app

**GitHub:** https://github.com/SHISLER671/normies-cred-hub

The GitHub repository is already connected to Vercel. Pushing commits to the `main` branch will automatically trigger a new production deployment.

### Vercel

We have a `vercel.json` with security headers, iad1 region, and Next.js framework settings.

#### Manual / Direct deploys (Vercel CLI)

```bash
pnpm run deploy
# or
npx vercel --prod
```

Add or update environment variables via CLI (choose Preview + Production for Horizon to work on all deploys):

```bash
npx vercel env add NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
npx vercel env add VENICE_INFERENCE_KEY_
# When prompted for environment, select "Preview" and "Production" (or "All")
```

The project builds cleanly with Turbopack and uses server-side API proxies for the external data sources.

## Data Sources

- [Normies API](https://api.normies.art)
- [Ethos Network API](https://app.ethos.network)
- ERC-8004 Identity Registry (`0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`) and Reputation Registry on Ethereum mainnet.

## License

MIT

---

Built for the Normies community.
