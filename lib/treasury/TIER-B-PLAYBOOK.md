# Tier B Playbook — Tip Rails & TBA Receiver (Execute Later)

> **Status:** Deferred. Do **not** run until the gates below are green.  
> **Tier A (done):** `lib/treasury/` payment receivers, tip asset priority types, verify/manifest wiring, hot wallet default.  
> **Tier C (never):** See [Rejected](#tier-c--never-do-these) at bottom — do not reintroduce.

**When to open this file:** Normies publishes A2A docs, or you are ready to implement x402/ETH tips, or you flip production tip sink to #7141 TBA.

---

## Prerequisites (gates)

| Gate | Required for | How you know it’s open |
|------|----------------|-------------------------|
| **G1 — Normies A2A docs** | Live Canvas AP verification | Official docs: how AP transfers, proof/receipt shape, sink identity (Canvas / wallet / TBA?), confirmations |
| **G2 — Product flip TBA** | Production `ZULO_PAYMENT_RECEIVER=tba` | #7141 TBA resolved + trusted; ops decision recorded; dual-accept period optional |
| **G3 — x402 params** | USDC via x402 | Chain, USDC address, facilitator URL, CAIP-2/19, receiver mode confirmed |
| **G4 — RPC / keys** | Live EVM verify | `ETH_RPC_URL` (and Base RPC if needed); Upstash replay/rate limit in prod |
| **G5 — Rail status** | Any live credits | `ZULO_PAYMENT_RAIL_STATUS=live` only after oracle is real (never for AP until G1) |

**Rule:** If G1 is closed, keep AP path scaffolded — **never** invent transfers or mark AP tips `verified: true` in production.

---

## Execution order (strict)

Implement in this order unless product explicitly re-prioritizes.

### B1 — Canvas AP oracle (priority 1) — needs **G1**

**Goal:** Real A2A tip verification for Canvas AP.

**Do:**

1. Read Normies official A2A / marketplace payment docs end-to-end.
2. Add `lib/treasury/` or `lib/payments/` module, e.g. `apOracle.ts`:
   - Input: `txHash` | marketplace receipt id, `expectedAmountAp`, `service`, `caller`
   - Output: `{ ok, from, to, amountAp, proof, reason }`
   - Map Normies proof → existing 7-step pipeline (or a dedicated AP step set)
3. Wire `verifyPayment7Step` / `verifyAPPayment` so amount + recipient use the **oracle**, not:
   - `eth_getBalance`
   - TBA `state()`
   - client-claimed amount alone
4. Document sink rules: if Normies allows TBA as AP sink, only then couple AP path to `getReceiverAddress()` / TBA; otherwise keep AP path Normies-native.
5. Tests: fixture receipts (success, underpay, wrong sink, replay).
6. Set `ZULO_PAYMENT_RAIL_STATUS=live` only after tests + staging proof.
7. Update `knowledge/treasury.md` + README: “AP oracle live”.

**Done when:** Non-holder paid `/api/zulo/ask` rejects bad proofs and accepts good ones without false positives.

---

### B2 — x402 USDC (priority 2) — needs **G3** (+ receiver from Tier A)

**Goal:** Second tip asset after AP.

**Do:**

1. Confirm chain (likely Base), USDC token, facilitator (`CDP` / other), CAIP-2/19.
2. Add verification strategy `x402-facilitator` in treasury/payments:
   - Parse/validate `PAYMENT-SIGNATURE` / settlement response (or CDP verify API)
   - Expected recipient = `getReceiverAddress()` for configured mode
3. Extend service pricing or manifest if USDC prices differ from AP.
4. Keep tip priority list: AP still primary for A2A; x402 for open HTTP/agent clients.
5. Tests with mocked facilitator responses.
6. Docs: env vars, example client flow.

**Done when:** A test client can 402 → pay USDC → access paid endpoint with verify path green.

---

### B3 — ETH Ethereum mainnet (priority 3)

**Do:**

1. Native transfer verify: `tx.to` / value / confirmations against `getReceiverAddress({ chainId: 1 })`.
2. Reuse 7-step confirmations / replay / reorg from `lib/payments/verify.ts`.
3. Do not mix with AP amounts (separate `TipAssetId: eth-mainnet`).

**Done when:** Live or staging ETH tip to hot wallet (or TBA if flipped) verifies correctly.

---

### B4 — ETH Base (priority 4)

**Do:**

1. Same as B3 with Base public client / `chainId: 8453`.
2. Env for Base RPC if not already present.
3. Manifest/notes: multi-chain EVM tips.

**Done when:** Base ETH tip path works like mainnet ETH.

---

### B5 — Production TBA as tip sink — needs **G2**

**Do:**

1. Resolve #7141 TBA via `lib/erc6551` / `createTbaReceiver` (already scaffolded).
2. Optional **dual-accept** window: verify accepts both hot wallet **and** TBA.
3. Flip `ZULO_PAYMENT_RECEIVER=tba` in Vercel (production).
4. Update manifest copy; announce migration if external agents tip EVM assets.
5. Confirm TBA is deployed if you need `execute` later; address is receivable pre-deploy for inbound only.

**Independent:** Do **not** auto-flip when `ZULO_TBA_PROVIDER_STATUS=live`. Account plane ≠ payment receiver.

**Done when:** Production manifest `receiverMode: erc6551-tba` and verify expects TBA address.

---

### B6 — Wire Network / cross-chain (priority 5+)

**Do only after B1–B4 are solid.**

1. New `TipAssetId` / CAIP namespace when Wire Network params are known.
2. Separate verify module — do not force into mainnet ETH helper.
3. Update `tipAssets.ts` priority list and knowledge.

---

### B7 — Optional later: `executeTransfer` / TBA outbound

**Only if product needs Zulo/TBA to send assets.**

1. Signer policy, circuit breaker, audit events.
2. IERC6551Executable / Tokenbound execute — never in Tier A/B1–B4 required path.
3. Ownership-cycle guards already in `lib/erc6551` — keep enforced.

---

## Suggested agent / human prompt (copy-paste when gates open)

```text
Execute Tier B from lib/treasury/TIER-B-PLAYBOOK.md.

Gate status:
- G1 Normies A2A docs: [link or paste]
- G2 TBA flip: [yes/no]
- G3 x402 params: [chain, USDC, facilitator]
- G4/G5 env: [as applicable]

Start at step B[1|2|…] only. Respect Tier C rejections.
Do not set ZULO_PAYMENT_RAIL_STATUS=live for AP without a real oracle.
Reuse lib/treasury + lib/erc6551 + lib/payments/verify; do not rebuild 6551.
```

---

## Checklist before each B step

- [ ] Correct gate is open (table above)
- [ ] Tip asset order not violated without product sign-off
- [ ] No Canvas AP via `balanceOf` / TBA `state()`
- [ ] Payment receiver still independent of account-plane env
- [ ] Tests + `tsc` green
- [ ] README / `knowledge/treasury.md` updated
- [ ] Deploy only after staging confidence

---

## Related code (Tier A — already there)

| Path | Role |
|------|------|
| `lib/treasury/` | Receivers, tip asset priority, factory |
| `lib/erc6551/` | TBA resolve / create encode / cycle guards |
| `lib/payments/verify.ts` | 7-step verify; uses `getReceiverAddress()` |
| `lib/agent-recommendations/verifyPayment.ts` | AP facade + 402 body |
| `lib/agent-recommendations/manifest.ts` | Discovery: receiver + tipAssetPriority |
| `knowledge/treasury.md` | Doctrine for humans/agents |

**Env (Tier A):**

| Variable | Meaning |
|----------|---------|
| `ZULO_PAYMENT_RECEIVER` | `hot-wallet` (default) \| `tba` |
| `ZULO_PAYMENT_RAIL_STATUS` | `planned` \| `scaffold` \| `live` |
| `ZULO_TBA_PROVIDER_STATUS` | Account plane only — not tip sink |

---

## Tier C — Never do these

Do not implement even when “executing Tier B”:

1. `getBalance(TBA)` (or hot wallet) as **Canvas AP**
2. TBA `state()` as **AP payment receipt**
3. Parallel ERC-6551 stack ignoring `lib/erc6551`
4. `USE_6551` or auto-enabling TBA receiver when TBA provider goes live
5. Production live AP credits without G1 oracle
6. Claiming multi-asset or TBA treasury “live” without the matching B step

---

## Changelog

| Date | Note |
|------|------|
| 2026-07-29 | Playbook created after Tier A ship; product priority AP → x402 USDC → ETH L1 → ETH Base → Wire; TBA tip sink eventual, default hot wallet. |
