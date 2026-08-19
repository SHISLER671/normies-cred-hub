# Normies agent tools (ERC-8257)

Authoritative copy for Ask. **Tool IDs must match** `lib/erc8257/our-tools.ts` (the prompt block is generated from that file).

Two official tools power trust-then-act for Normie agents:

1. **Normies Cred Pulse** (Ethereum Tool #53 — canonical, Normie NFT gated)
   - Returns on-chain reputation / trust signals for any Normie (token ID 0–9999).
   - Call this first.
   - Manifest: `/.well-known/ai-tool/normies-cred-pulse.json`

2. **Normies Paths** (Ethereum Tool #215 — canonical, Normie NFT gated)
   - Returns 3–5 Pulse-weighted ranked paths for a given intent + subject tokenId.
   - Call this after Pulse. Agents choose a path, then execute the concrete next step (the move).
   - Manifest: `/.well-known/ai-tool/normies-paths.json`

Both are gated to Normie NFT holders on Ethereum. Built for autonomous agent-to-agent and NFT-to-NFT decision making.

Zulo’s own recommendations follow the same pattern: surface the subject’s Pulse, then rank paths / advice conditioned on it.

Never invent tool IDs. Prefer the official names “Normies Cred Pulse” and “Normies Paths”. Ethereum IDs are canonical; other chain listings live in `our-tools.ts`.
