# Payment & Platform Security — Zulo Knowledge Base

> **Posture:** *I assume breach. Every transaction is adversarial.*

## Threat model

| Actor | Capability | Primary targets |
|-------|------------|-----------------|
| **Opportunistic bots** | Credential stuffing, spam, replay of public tx hashes | Rate limits, free APIs, tip endpoints |
| **Economic attackers** | Underpay, double-spend tips, race claim endpoints | Payment verification, replay store |
| **Insiders** | Misuse of operator keys, false unpause | Multisig circuit breaker, audit logs |
| **Nation-state / advanced** | Supply-chain, long-horizon key compromise | Pin deps, least privilege, defense in depth |
| **Quantum AI (forward-looking)** | Future break of classical signatures | Crypto agility, hash-chained logs, readiness notes |

Assumptions: public internet exposure, serverless multi-tenant hosting (Vercel), payment rails **planned** until Normies A2A is live.

## Defense in depth (7 layers)

1. **Crypto** — Validate formats (txHash, signatures); never trust client-side amounts alone.
2. **Verification** — 7-step payment pipeline: format → confirmations → recipient → amount → replay → reorg → finality.
3. **API** — Dual-key rate limits (IP + wallet), strict schemas, security headers, circuit breaker.
4. **Contracts** — Prefer on-chain predicates when A2A is live; hot wallet is receive-only for tips narrative.
5. **OpSec** — No private keys in app; secrets only in Vercel env; Zulo never asks users for seeds.
6. **Monitoring** — Append-only audit events, health + security posture endpoints, SEV playbook.
7. **Quantum readiness** — Hash-chained audit entries; plan migration path for post-quantum signatures when standards land.

## Zulo security posture

- Assume breach: every tip, every ask, every health probe may be hostile.
- Fail closed on payment rails when `live`; fail soft on free chat (availability) with rate limits.
- Prefer explicit denial messages over silent success.
- Signature phrase when relevant: *Patience compounds. Haste erodes.* (also used on rate-limit responses)

## Incident response playbook

| Severity | Definition | Immediate actions |
|----------|------------|-------------------|
| **SEV 1** | Active theft / payment bypass / key exposure | Trip circuit breaker (pause payments); rotate secrets; freeze A2A paid paths; public status note |
| **SEV 2** | Abuse at scale, confirmed vulnerability in verification | Rate-limit tighten; patch + deploy; audit log review; disclose after mitigation |
| **SEV 3** | Spam, low-impact bugs, dependency advisories | Ticket, patch in normal cycle, dependency update |

**Unpause (SEV 1):** requires configured multisig threshold (default **3-of-5** operator approvals) via `CIRCUIT_BREAKER_UNPAUSE_KEYS` — never single-operator resume for payments.

## Security checklist (operators)

- [ ] `XAI_API_KEY` / vendor keys only in Vercel env (never git)
- [ ] Upstash `KV_REST_API_URL` + `KV_REST_API_TOKEN` for rate limit + replay store
- [ ] `ZULO_PAYMENT_RAIL_STATUS` remains `planned` until A2A proofs exist
- [ ] Circuit breaker unpause keys set for production
- [ ] Security headers present (HSTS, nosniff, DENY frame, CSP)
- [ ] Dependency pin + lockfile committed; scan on deploy
- [ ] `GET /api/zulo/security` public; disclosure via `POST /api/zulo/security/report`
- [ ] Audit log signature secret set (`AUDIT_LOG_HMAC_SECRET`) in production

## Responsible disclosure

Report vulnerabilities via `POST /api/zulo/security/report` or email **security@normiescredhub.example** (placeholder — replace with project mailbox).

Do not publicize SEV 1 issues until operators confirm mitigation.
