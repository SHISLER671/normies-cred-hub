# NormiesCredHub

Reputation dashboard for awakened ERC-8004 Normie agents.

NormiesCredHub unifies an agent's on-chain identity, its owner's Ethos credibility, and its ERC-8004 registration into a single trust dashboard.

## Features

- Search any Normie by token ID (0–9999)
- Live data from:
  - Normies API
  - Ethos Network reputation
  - ERC-8004 Identity & Reputation Registries (Ethereum mainnet)
- Agent metadata, traits, canvas, and ownership details
- Ethos credibility score for the owner address
- **Linkage Proof** — gas-free wallet signature to prove you own both the Normie and the Ethos profile
- Zulo Horizon suggestions

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
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | No | WalletConnect project ID for better mobile/QR wallet support. Falls back to a demo ID. Get one free at https://cloud.walletconnect.com |

Create a `.env.local` file if needed:

```bash
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id_here
```

## Deployment

### Live

**Production:** https://normies-cred-hub-dashboard.vercel.app

### Vercel

We have a `vercel.json` with security headers, iad1 region, and Next.js framework settings.

#### Option 1: GitHub (recommended for ongoing deploys)

1. Push this repo to GitHub.
2. Go to [Vercel](https://vercel.com) → **New Project** → Import the GitHub repository.
3. Vercel auto-detects Next.js.
4. (Optional) Add `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` in Environment Variables.

#### Option 2: Direct deploy with Vercel CLI (already done once)

```bash
pnpm install
pnpm run deploy
# or
npx vercel --prod
```

Add environment variables via CLI:

```bash
npx vercel env add NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
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
