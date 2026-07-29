# Treasury & Tip Rails — Zulo Knowledge Base

> **Payment receiver** and **tip assets** are product layers separate from ERC-8004 identity and Canvas AP reads.

## Architecture (three layers)

| Layer | Module | Role |
|-------|--------|------|
| Identity | ERC-8004 + Normie #7141 | Who Zulo is (`agentId` 32626) |
| Account plane | `lib/erc6551` | Optional TBA (`ZULO_TBA_PROVIDER_STATUS`) |
| Payment receiver | `lib/treasury` | Where EVM tips land (`ZULO_PAYMENT_RECEIVER`) |
| Canvas AP | Normies API | Per-Normie actionPoints — **not** `balanceOf(receiver)` |

## Payment receiver migration

```text
TODAY (default):  hot wallet 0xb8792E6516b88e73eD0723F8C1C8a92531A98767
EVENTUALLY:       #7141 ERC-6551 TBA (Tokenbound V3 resolve)
FLIP:             ZULO_PAYMENT_RECEIVER=tba
```

- Independent of `ZULO_TBA_PROVIDER_STATUS` (account plane).
- During transition, verify may accept hot wallet **or** configured receiver.
- Do not claim TBA is the live tip sink until env flip + product ops.

## Tip asset priority

1. **Canvas AP** — Normies A2A (primary). Live verify **blocked** until Normies official docs.
2. **USDC via x402** — HTTP-native payments to payment receiver.
3. **ETH** — Ethereum mainnet.
4. **ETH** — Base (`eip155:8453`).
5. **Later** — Wire Network / cross-chain.

## Hard rules

- Never `getBalance(TBA) === Canvas AP`.
- Never use TBA `state()` as AP payment receipt.
- AP oracle = Normies A2A / marketplace when published.
- EVM assets settle to `PaymentReceiverAdapter.getReceiverAddress()`.

## Code

- `lib/treasury/` — adapters, tip assets, factory
- `lib/payments/verify.ts` — uses `getReceiverAddress()` for expected recipient
- `GET /api/zulo/manifest` — `payment.receiverWallet` + `receiverMode` + `tipAssetPriority`

## Next: Tier B (when gates open)

Executable backlog (AP oracle → x402 → ETH → Base → TBA flip → Wire):

**`lib/treasury/TIER-B-PLAYBOOK.md`**

Do not run AP live verify or multi-asset rails until that playbook’s gates are green.
