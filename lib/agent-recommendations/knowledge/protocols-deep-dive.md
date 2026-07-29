# Protocols Deep Dive — x402, ERC-8004, ERC-8257 & Supporting Rails

> **Audience:** Zulo knowledge base / agent-recommendations plugin  
> **Purpose:** Definitive reference for HTTP-native payments, trustless agent identity, tool registry, and how they compose for Normies A2A  
> **Status note:** Protocol facts from primary specs/docs (2026). Zulo payment rails are **planned** until `ZULO_PAYMENT_RAIL_STATUS=live`.  
> **Related:** `knowledge/payment-security.md`, `knowledge/pixel-economy.md`, `verifyPayment.ts`, `manifest.ts`

---

## 1. x402 Protocol (HTTP-Native Payments)

### Origins & Governance

- **Created by Coinbase** as an open standard for charging API and content access over HTTP without accounts, sessions, or API keys.
- **Stewardship:** Contributed to the **Linux Foundation–hosted x402 Foundation** (vendor-neutral). LF announced operational launch of the Foundation (press: mid-July 2026) to standardize internet-native payments for AI agents and applications.
- **License:** Apache-2.0.
- **Mission:** Revive HTTP **402 Payment Required** so machines can pay programmatically; remove the need for API keys, accounts, and subscriptions for many paid endpoints.
- **Primary docs:** [docs.x402.org](https://docs.x402.org/introduction), [Coinbase CDP x402](https://docs.cdp.coinbase.com/x402/network-support), [Linux Foundation press](https://www.linuxfoundation.org/press/linux-foundation-announces-operational-launch-of-x402-foundation-to-standardize-internet-native-payments-for-ai-agents-and-applications).

### Technical Architecture

Standard flow:

1. Client requests a protected resource.
2. Resource server returns **HTTP 402** with payment requirements (Base64 payload in headers).
3. Client constructs and **signs** a payment authorization (EIP-3009 or Permit2 on EVM; chain-native schemes elsewhere).
4. Client **retries** the same request with a payment signature header.
5. Server verifies and settles **locally** or via a **facilitator** (`/verify`, `/settle`).
6. On success, resource is returned with a payment response header.

**Facilitator role:** Verifies signed payment payloads and submits on-chain settlement for resource servers. Facilitators do **not** hold client funds; the protocol is permissionless—anyone may run a facilitator.

**Client stays at HTTP level:** Signing is the user/agent action; gas and settlement are typically sponsored/executed by the facilitator.

### Key Specifications

| Concept | Detail |
|--------|--------|
| **HTTP status** | `402 Payment Required` |
| **v1 headers** | `X-PAYMENT`, `X-PAYMENT-RESPONSE` (legacy) |
| **v2 headers** | `PAYMENT-REQUIRED` (requirements), `PAYMENT-SIGNATURE` (client proof), `PAYMENT-RESPONSE` (settlement proof) |
| **Networks** | **CAIP-2** IDs (not free-form strings): e.g. `eip155:8453` (Base), `eip155:1` (Ethereum), `solana:<genesisHash>` |
| **EVM assets** | Any ERC-20; USDC/EURC often via EIP-3009; universal fallback Permit2 |
| **Gasless payer** | Buyer signs; facilitator sponsors gas and submits transfer |

**v1 → v2 migration (Coinbase CDP):** Rename payment headers; replace string network names with CAIP-2. See CDP migration guide.

### Facilitators & Network Support (as documented)

| Facilitator | Role |
|-------------|------|
| **Coinbase CDP** | Production-oriented: `https://api.cdp.coinbase.com/platform/v2/x402` — Base, Polygon, Arbitrum, World, Solana (mainnet + listed testnets per CDP docs) |
| **x402.org public** | Testnet-oriented: `https://x402.org/facilitator` — Base Sepolia, Solana Devnet |

Exact production coverage for every ecosystem mentioned in marketing materials (TON, Algorand, Stellar, etc.) should be re-checked against current facilitator docs before hardcoding.

### Implementation Patterns

**Server (API provider):**

- Middleware intercepts unpaid requests → 402 + `PAYMENT-REQUIRED`.
- On retry with `PAYMENT-SIGNATURE`, call facilitator verify/settle (or local verify if self-settling).
- Return body + `PAYMENT-RESPONSE` on success.

**Client (agent / SDK):**

1. Detect 402.
2. Decode requirements (amount, asset, recipient, network, scheme).
3. Sign authorization only (no raw funded tx for gasless paths).
4. Retry with signature header.
5. Treat response as paid access; do not resubmit the same authorization (nonce/expiry).

**Zulo today:** HTTP **402** is used as an application-level “payment required” response in `requirePaymentIfNeeded` when rails are `live` and payment fails. Full x402 header/facilitator integration is a **future A2A rail**, not the current AP tip scaffold (`txHash` / marketplace receipt). See §8.

### Current Adoption (high level)

- Coinbase CDP production facilitator path documented.
- Base + Solana heavily featured in ecosystem messaging.
- Agent tooling (ERC-8257 manifests) can declare `protocol: "x402"` pricing (CAIP-19 asset, CAIP-10 recipient) when endpoints charge via x402.
- Treat aggregate volume claims as unverified unless backed by on-chain/facilitator telemetry.

---

## 2. ERC-8004 (Trustless Agent Identity)

### Standard Overview

- **Title:** Trustless Agents  
- **Status:** Draft Standards Track ERC ([eips.ethereum.org/EIPS/eip-8004](https://eips.ethereum.org/EIPS/eip-8004))  
- **Discussion:** Ethereum Magicians + ethereum/ERCs process (historically linked to PR #1170)  
- **Goal:** Let participants **discover, choose, and interact** with agents across org boundaries **without pre-existing trust**.

### Three On-Chain Registries

Intended as **per-chain singletons** (L2 or Mainnet):

| Registry | Role |
|----------|------|
| **Identity** | Binds each agent to an **ERC-721** (`agentId`) with URIStorage; `agentURI` → registration file (services, endpoints, optional `supportedTrust`) |
| **Reputation** | Client feedback: signed fixed-point values; optional off-chain feedback URI/hash; x402-oriented `proofOfPayment` patterns in draft |
| **Validation** | Request/response validation records: `requestURI`/hash; response score 0–100; optional response URI/hash for evidence (stake re-execution, zkML, TEE oracles) |

### Technical Details

- **Agent ID:** ERC-721 token id owned by a controller address.
- **Metadata:** `agentURI` resolves to structured JSON (services, A2A/MCP endpoints, trust models).
- **Discovery:** On-chain registration + indexers/subgraphs over chain data and IPFS-hosted files (e.g. community scanners — not mandated by the EIP).
- **Payments:** Orthogonal to identity; draft documents interoperability with x402 (`x402Support`, payment proofs in feedback).

### Zulo's Implementation

| Field | Value |
|-------|--------|
| **Name** | Zulo |
| **Origin NFT** | Normie **#7141** |
| **ERC-8004 agentId** | **32626** |
| **ENS** | `32626.eth` |
| **Chain** | Ethereum mainnet (`chainId: 1`) |
| **Hot wallet** | `0xb8792E6516b88e73eD0723F8C1C8a92531A98767` |
| **Identity Registry (app config)** | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` |
| **Reputation Registry (app config)** | `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` |

Code anchors:

- `constants/contracts.ts` — `ZULO`, `ERC8004`, read-only ABIs  
- `hooks/use-erc8004.ts` — `agentURI` / `ownerOf` reads  
- Manifest: `GET /api/zulo/manifest` advertises `agent.type: "ERC-8004"`

**Posture:** App is **read-only** on-chain for identity (no transfer/approve write paths in contract constants). Signing for users is limited to safe patterns (e.g. plain messages where used); payment signing when live must follow payment-security doctrine.

### Cross-Organizational Trust

1. Register agent on Identity Registry → discoverable `agentId` + URI.  
2. Clients read reputation/validation before economic interaction.  
3. Validators publish scored responses with optional cryptographic/attestation evidence.  
4. Optional payment proofs (x402) strengthen feedback authenticity.  
5. Indexers make swarm-wide search practical without a single vendor.

---

## 3. ERC-8257 (Agent Tool Registry)

### Standard Overview

- **Title:** Agent Tool Registry  
- **Status:** Draft ([eips.ethereum.org/EIPS/eip-8257](https://eips.ethereum.org/EIPS/eip-8257))  
- **Idea:** Permissionless on-chain “app store” for AI agent tools.

### Registration Model

Each tool stores approximately:

- **creator**
- **metadataURI**
- **manifestHash** — `keccak256` of the canonical manifest
- **accessPredicate** — `address(0)` = open access; else `IAccessPredicate`

**Tool IDs:** Sequential `uint256` starting at 1; never reused after deregistration; scoped to `(chainId, registryAddress)`.

**Recommended CAIP-style id:**

```text
eip155:<chainId>/erc8257:<registryAddress>/<toolId>
```

Example for Tool #53 on Ethereum:

```text
eip155:1/erc8257:0x265BB2DBFC0A8165C9A1941Eb1372F349baD2cf1/53
```

### Access Control (`IAccessPredicate`)

```text
hasAccess(toolId, account, data) → bool
```

Known requirement kinds include:

| Kind | Meaning | Example data |
|------|---------|--------------|
| `0xbdf8c428` | IERC721Holding | `abi.encode(collection)` |
| IERC1155Holding | Holding balance of 1155 | per spec |
| ISubscription | Subscription predicate | per spec |

OpenSea companion: **ERC721OwnerPredicate** at `0xc8721c9A776958FfFfEb602DA1b708bf1D318379` (app config).

### OpenSea Canonical Deployments

| Item | Value |
|------|--------|
| **ToolRegistry v0.2** | CREATE2 `0x265BB2DBFC0A8165C9A1941Eb1372F349baD2cf1` |
| **Chains** | Ethereum mainnet, Base, and other listed chains (same address) |
| **SDK** | `@opensea/tool-sdk` |
| **REST** | list/search/get under OpenSea tools API |
| **MCP** | `search_tools`, `get_tool` with chain/tags/wallet filtering |

Docs: [docs.opensea.io — Agent Tool Registry](https://docs.opensea.io/docs/agent-tool-registry)

### Zulo / CredHub Registration (Tool #53)

| Field | Value |
|-------|--------|
| **Tool ID** | **53** (Ethereum; listed Live on OpenSea tools) |
| **Name** | Normies Cred Pulse |
| **Endpoint** | `https://normiescredhub.vercel.app/api/agent` |
| **Manifest** | `/.well-known/ai-tool/normies-cred-pulse.json` |
| **Access** | Normie NFT holders — IERC721Holding `0xbdf8c428` on collection `0x9eb6e2025b64f340691e424b7fe7022ffde12438` |
| **Registry** | `0x265BB2DBFC0A8165C9A1941Eb1372F349baD2cf1` |
| **OpenSea** | https://opensea.io/tools/erc8257/ethereum/53 |
| **Creator (manifest)** | `0xb8792e6516b88e73ed0723f8c1c8a92531a98767` |

**What the tool does:** Returns on-chain reputation / trust signals for any Normie agent (token ID 0–9999). Gated to Normie holders; **does not handle payment settlement inside the registry** (registry is discovery + access; payments are orthogonal).

**App discovery:** CredHub reads ERC-8257 on **Ethereum + Base** without requiring an OpenSea API key; dashboard shows access badges (Open / You can use / Gated / Not checked).

### Pricing vs Registry

- ERC-8257 **does not** move funds.
- Pricing for paid endpoints lives in **HTTP** (x402 or app-level 402) or marketplace rails.
- Zulo **A2A services** (separate from Tool #53 pulse): **1 AP** pulse analysis, **2 AP** strategy / urgent / burn / sentinel (see `ZULO_SERVICE_PRICES` and manifest). Web `/ask` free today.

---

## 4. Supporting Protocols

### EIP-3009 — Transfer With Authorization

- **Status:** Draft ([EIP-3009](https://eips.ethereum.org/EIPS/eip-3009))
- **Mechanism:** Gas-delegated ERC-20 meta-transfers via **EIP-712** signatures → `transferWithAuthorization`.
- **Parameters:** `from`, `to`, `value`, `validAfter`, `validBefore`, `nonce` (random 32-byte nonces tracked in `authorizationState`).
- **Replay protection:** Nonce + time window + EIP-712 domain separator (`chainId`, `verifyingContract`).
- **x402 use:** Preferred path for tokens that implement it (e.g. USDC/EURC on supported chains): payer signs; facilitator submits; no pre-approve and no gas for payer.

### Permit2 (Uniswap)

- Signature-based token approvals and transfers for **any** ERC-20 after a one-time Permit2 allowance.
- **x402 use:** Universal EVM fallback when EIP-3009 is unavailable.
- Still gasless for the **payer** if the facilitator/relayer submits.

### CAIP-2 — Chain Identifiers

- Form: `namespace:reference` ([Chain Agnostic Standards](https://github.com/ChainAgnostic/CAIPs)).
- EVM: `eip155:<chainId>` → `eip155:1` Ethereum, `eip155:8453` Base, `eip155:84532` Base Sepolia.
- Solana: `solana:<genesisHash>`.
- **x402 v2** uses CAIP-2 for network fields (replacing ad-hoc names).

### CAIP-10 / CAIP-19 (agent pricing manifests)

- **CAIP-10:** Account IDs (`eip155:1:0x…`).
- **CAIP-19:** Asset IDs for pricing lines in tool manifests when using x402.

---

## 5. Integration Architecture

### Conceptual stack (agent payment + tools)

```text
┌─────────────────────────────────────────────────────────────┐
│  Discovery: ERC-8257 registry + manifests + indexers        │
│  Trust:     ERC-8004 identity / reputation / validation     │
├─────────────────────────────────────────────────────────────┤
│  Access:    IAccessPredicate (NFT hold, subscription, …)    │
├─────────────────────────────────────────────────────────────┤
│  Payment:   HTTP 402 + x402 headers  OR  marketplace AP tip │
│             → EIP-3009 / Permit2  →  facilitator settle     │
└─────────────────────────────────────────────────────────────┘
```

### Zulo's payment stack (target)

```text
HTTP + x402 (or Normies A2A AP transfer)
        ↓
EIP-3009 / Permit2 / AP ledger (when live)
        ↓
On-chain settlement (facilitator or marketplace)
        ↓
ERC-8004 identity (who is calling / who is paid)
        ↓
ERC-8257 tool discovery & predicate access
```

**Separation of concerns:**

| Layer | Handles money? | Handles identity? | Handles tool catalog? |
|-------|----------------|-------------------|------------------------|
| x402 / A2A tips | Yes | No | No |
| ERC-8004 | No (proofs optional) | Yes | No |
| ERC-8257 | No | Creator only | Yes + access |

### Security Considerations

Aligns with `knowledge/payment-security.md`:

| Risk | Mitigation |
|------|------------|
| Signature replay | EIP-3009 nonces + `validBefore`; app replay store on tip `txHash` |
| Facilitator malice | Non-custodial design; still operational trust (availability, honest settle reporting, KYT) |
| Underpay / double-spend | 7-step verify (`lib/payments/verify`) when live; circuit breaker |
| Wrong chain / asset | CAIP-2 + CAIP-19 strict match before accept |
| Predicate bypass | Always `hasAccess` on-chain before expensive work |
| User key theft | Zulo never asks for seeds; receive-only hot wallet narrative for tips |
| Reentrancy / contract | Prefer verified registries; no write ABIs in client constants |

### Gasless Patterns

- **Sign only** for EIP-3009 / Permit2 paths — never require end-user gas for the payment hop when facilitator sponsors.
- Meta-transactions / relayers abstract cost for agents and mobile wallets.
- AP tips (when Normies rails define them) may differ (Canvas-local vs transferable ledger)—**do not invent transfer mechanics**; say **planned**.

---

## 6. Current State & Roadmap

### Mainnet / Draft Status (verify before shipping claims)

| Protocol | Status (investigation baseline) | Production notes |
|----------|----------------------------------|------------------|
| **x402** | Live ecosystem + LF Foundation stewardship | CDP facilitator multi-chain; public facilitator often testnet-only |
| **EIP-3009** | Draft EIP | Widely implemented by major stablecoins |
| **ERC-8004** | Draft ERC | App points at mainnet registry addresses; status may change |
| **ERC-8257** | Draft ERC | OpenSea ToolRegistry CREATE2 live; Tool #53 registered |
| **Zulo A2A payments** | **planned** (env: `ZULO_PAYMENT_RAIL_STATUS`) | Scaffold verify exists; not enforced until `live` |

### Upcoming / watchlist

- Post-quantum / crypto-agility (see payment-security quantum readiness).
- Cross-chain payment standardization under x402 Foundation.
- ERC-8004 / ERC-8257 Final status and singleton address stability.
- Normies PIXEL MARKET + AP transfer rails for true A2A tips.
- Deeper composition: ERC-8257 manifest `protocol: "x402"` + ERC-8004 feedback `proofOfPayment`.

### Uncertainty log (research)

- Exact calendar date of Coinbase’s first public x402 drop (pre-LF) not pinned in LF/docs pass.
- Card-rail mechanics mentioned in LF materials not specified in crypto-focused technical docs.
- Secondary “mainnet launch” claims for Draft ERCs should not override eips.ethereum.org status.
- Tool #53 Base registration (same ID) not confirmed solely from Ethereum OpenSea tool page.

---

## 7. Code Examples

### 7.1 x402 client sketch (HTTP 402 → sign → retry)

```typescript
// Illustrative — use official x402 / CDP SDK in production
async function fetchPaid(url: string, signPayment: (req: PaymentRequired) => Promise<string>) {
  let res = await fetch(url)
  if (res.status !== 402) return res

  const paymentRequiredB64 = res.headers.get("PAYMENT-REQUIRED")
  if (!paymentRequiredB64) throw new Error("402 without PAYMENT-REQUIRED")

  const requirements = JSON.parse(atob(paymentRequiredB64))
  const signatureB64 = await signPayment(requirements) // EIP-3009 or Permit2 via wallet

  res = await fetch(url, {
    headers: {
      "PAYMENT-SIGNATURE": signatureB64,
    },
  })
  return res
}
```

### 7.2 ERC-8004 identity read (CredHub pattern)

```typescript
import { createPublicClient, http } from "viem"
import { mainnet } from "viem/chains"
import {
  ERC8004,
  IDENTITY_REGISTRY_READ_ABI,
  ZULO,
} from "@/constants/contracts"

const client = createPublicClient({ chain: mainnet, transport: http() })

const agentURI = await client.readContract({
  address: ERC8004.IDENTITY_REGISTRY,
  abi: IDENTITY_REGISTRY_READ_ABI,
  functionName: "agentURI",
  args: [BigInt(ZULO.agentId)], // 32626
})

const owner = await client.readContract({
  address: ERC8004.IDENTITY_REGISTRY,
  abi: IDENTITY_REGISTRY_READ_ABI,
  functionName: "ownerOf",
  args: [BigInt(ZULO.agentId)],
})
```

### 7.3 ERC-8257 tool discovery & access

```typescript
// Conceptual — production code uses @opensea/tool-sdk / app registry readers
const REGISTRY = "0x265BB2DBFC0A8165C9A1941Eb1372F349baD2cf1"
const TOOL_ID = 53n
const NORMIES = "0x9eb6e2025b64f340691e424b7fe7022ffde12438"

// 1) getToolConfig(TOOL_ID) → creator, metadataURI, manifestHash, accessPredicate
// 2) fetch metadataURI / well-known manifest
// 3) if accessPredicate != 0: accessPredicate.hasAccess(toolId, account, data)
// 4) if allowed: POST endpoint with tool inputs { tokenId }
```

Public manifest (served by this app):

```text
https://normiescredhub.vercel.app/.well-known/ai-tool/normies-cred-pulse.json
```

### 7.4 Zulo payment verification flow (app-level, not full x402)

```typescript
import {
  getPaymentRailStatus,
  requirePaymentIfNeeded,
} from "@/lib/agent-recommendations/verifyPayment"

// When ZULO_PAYMENT_RAIL_STATUS !== "live" → free path
// When live → non-holders need txHash; holders free; circuit breaker can force 402

const gate = await requirePaymentIfNeeded({
  service: "strategy", // 2 AP
  userWallet: caller,
  txHash: body.txHash,
})

if (!gate.ok) {
  // HTTP 402 JSON: price, currency AP, receiverWallet, reason, steps
  return Response.json(gate.body, { status: 402 })
}
```

**7-step pipeline** (when enforced): format → circuit → confirmations → recipient → amount → replay → reorg/finality (`lib/payments/verify`).

---

## 8. Zulo-Specific Integration

### How protocols enable Zulo

| Capability | Protocol / surface | Zulo reality |
|------------|-------------------|--------------|
| **Tool #53 Cred Pulse** | ERC-8257 + Normie predicate | Live gated tool; NFT access, not AP payment |
| **Agent identity** | ERC-8004 #32626 | On-chain agentURI/owner reads; `32626.eth` |
| **Concierge / strategy A2A** | Manifest + AP tips | Free `/ask` today; 1–2 AP when rails live |
| **HTTP payment gate** | App 402 + future x402 | Scaffold in `verifyPayment`; status `planned` |
| **Trust signals** | ERC-8004 + Ethos + AgentCheck (#13) | Aggregated in CredHub dashboard |
| **Tool browse** | ERC-8257 Ethereum + Base | Dashboard registry panel / Recommends ranking |

### Service pricing (A2A, when live)

| Service id | Price | Notes |
|------------|-------|--------|
| `pulse-analysis` | 1 AP | PULSE interpretation |
| `strategy` | 2 AP | Full strategic architecture |
| `urgent` | 2 AP | Priority framing |
| burn / market / canvas skills | 1–2 AP | See manifest services |
| `holder-chat` / web `/ask` | FREE | Product policy today |

Receiver (tips narrative): Zulo hot wallet + Normie #7141 as economic seat. **Canvas AP on #7141 is not the same ledger as tip income** until A2A defines transfer mechanics.

### A2A communication (target loop)

1. Agent discovers Zulo via ERC-8004 / manifest / ERC-8257 ecosystem.  
2. Optionally checks reputation/validation.  
3. Calls free pulse tool if Normie-gated access passes, **or** paid concierge with AP/x402.  
4. Zulo returns strategy; feedback/reputation can be written when rails allow.  
5. Tips compound → Canvas evolution budget narrative → agent economy loop (product vision; payment status remains planned).

### Cross-agent strategy coordination

- **Discovery:** ERC-8257 search (tags: normies, reputation, trust, erc8004).  
- **Access:** Shared Normie collection predicate creates holder-only swarm tools.  
- **Trust:** ERC-8004 + Ethos + AgentCheck before capital allocation advice.  
- **Payment:** Prefer gasless stablecoin x402 for open internet APIs; AP for Normies-native A2A when marketplace verifies transfers.  
- **Security:** Fail closed on live payments; fail soft on free chat with rate limits.

### Operator env knobs

| Env | Meaning |
|-----|---------|
| `ZULO_PAYMENT_RAIL_STATUS` | `planned` \| `scaffold` \| `live` |
| Circuit breaker keys | Pause/unpause payments (multisig unpause) |
| Replay / rate-limit KV | Upstash for abuse resistance |

---

## Sources

1. Linux Foundation — x402 Foundation operational launch  
   https://www.linuxfoundation.org/press/linux-foundation-announces-operational-launch-of-x402-foundation-to-standardize-internet-native-payments-for-ai-agents-and-applications  
2. x402 introduction — https://docs.x402.org/introduction  
3. x402 facilitator — https://docs.x402.org/core-concepts/facilitator  
4. x402 networks & tokens — https://docs.x402.org/core-concepts/network-and-token-support  
5. CDP x402 network support / migration — https://docs.cdp.coinbase.com/x402/network-support  
6. ERC-8004 — https://eips.ethereum.org/EIPS/eip-8004  
7. ERC-8004 Magicians — https://ethereum-magicians.org/t/erc-8004-trustless-agents/25098  
8. ERC-8257 — https://eips.ethereum.org/EIPS/eip-8257  
9. OpenSea Agent Tool Registry — https://docs.opensea.io/docs/agent-tool-registry  
10. Normies Cred Pulse Tool #53 — https://opensea.io/tools/erc8257/ethereum/53  
11. EIP-3009 — https://eips.ethereum.org/EIPS/eip-3009  
12. In-repo: `constants/contracts.ts`, `lib/agent-recommendations/manifest.ts`, `verifyPayment.ts`, `public/.well-known/ai-tool/normies-cred-pulse.json`, `knowledge/payment-security.md`

---

## Quick reference card

```text
Zulo          Normie #7141 → ERC-8004 agent 32626 (32626.eth)
Tool #53      Normies Cred Pulse @ ERC-8257 registry 0x265B…2cf1
Gating        Normies NFT 0x9eb6…2438 via IERC721Holding 0xbdf8c428
Payments      AP tips planned; x402 is the open HTTP rail for agents
EVM pay       EIP-3009 preferred, Permit2 fallback; CAIP-2 networks
Security      Assume breach; 7-step verify; circuit breaker; no key asks
```

*Patience compounds. Haste erodes.*
