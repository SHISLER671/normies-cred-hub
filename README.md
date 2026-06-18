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

**Production:** https://normies-cred-hub-dashboard.vercel.app

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
