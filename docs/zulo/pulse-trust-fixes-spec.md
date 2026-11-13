# Pulse trust fixes: level 4, Trending badge, agent card (spec, docs only)

Drafted 2026-11-14 (ChST) by Claude from the NCH planning doc and a read of main at 232b1a5. **Status: Proposed.** Nothing here is built. Three small PRs, one branch each, all targeting main.

Read with: `AGENTS.md` (rules), `docs/zulo/strategy.md` ("The Pulse gate"), `docs/zulo/thesis-lock.md`, `lib/api/agent-pulse.ts`, `lib/instrumentation/pulse-paths.ts`, `lib/delegations.ts`.

**Decisions this spec assumes (Ryan, 2026-11-14):** NCH stays Normies-only, and the no-crypto-as-income rule stays. Revisit both after the mid-December holder test. Nothing here adds a write, a payment or any outreach.

## Why

Pulse level 4, "Clean ownership & delegation", is also half of the sector-rank gate (strategy.md). Today it passes when the canvas read succeeds, the owner is a well-formed non-zero address, and the canvas delegate is empty or well-formed. Nearly every Normie passes, so the gate checks that data is readable, not that anything is clean. Every free Agent Check handed to holders rests on it, so it gets fixed first.

**Order:** PR-1 (level 4) → PR-2 (Trending) → PR-3 (agent card). PR-1 and PR-2 both touch `assemblePulseSignals`. Open PR-2 from main only after PR-1 merges (no stacked bases).

## PR-1: make "Clean ownership & delegation" real

Keep the breakdown string "Clean ownership & delegation" exactly as it is (`GATE_CLEAN_OWNERSHIP` in `lib/record-card/build.ts`). Its meaning gets stricter; nothing downstream needs renaming.

### 1.1 New rule (all four must pass)

| # | Check | Source | Pass when | If it can't be read |
|---|---|---|---|---|
| a | Owner agrees | `ownerOf(tokenId)` on Normies 0x9eb6…2438 (onchain) + `/normie/{id}/owner` (official_api) | Both readable, same address, not zero | Not granted; reason `owner_unreadable` |
| b | Owner held ≥ N days | `normie_index.owner_since` (new, see 1.2) | `now - owner_since >= N days` | Not granted; reason `tenure_unknown` |
| c | Canvas delegate set by the current owner | `/normie/{id}/canvas/info` → `delegate`, `delegateSetBy` | Delegate is zero, OR `delegateSetBy` equals the current owner | Not granted; reason `canvas_unreadable` |
| d | delegate.xyz check completes | `findDelegateXyz(owner, registryReaders(publicClient))` from `lib/delegations.ts` | `delegationCheckIncomplete(result) === false` | Not granted; reason `delegations_unreadable` |

- Check (c) catches the stale case: a delegate set by a previous owner that survived a transfer. ("Delegations outlive transfers" is already noted in `lib/delegations.ts`.)
- Check (d) doesn't fail anyone for having delegations. It only makes sure the delegation read worked, and records what it found for the evidence block (1.4).
- Default N = 30 days. Put it in one exported constant (`OWNER_TENURE_DAYS`) so it can be tuned in one place.

### 1.2 Owner tenure (data)

- New SQL file `supabase/sql/2026-11-xx-normie-owner-since.sql`, first line `DRAFT`. It adds `owner_since timestamptz null` to `normie_index`. Ryan applies it by hand.
- Owner refresh: when the owner changes, set `owner_since = now()` with the update. **Change both `lib/owners-refresh.ts` and `supabase/functions/owners-refresh/plan.ts`** (plan.ts is a byte-for-byte copy and a test fails if they drift). Add tests for change, no change, and unknown.
- Backfill (one-off): scan the Normies contract's Transfer logs for the last 30 days, in 1,000-block chunks (`SCAN_CHUNK` pattern from `lib/pixel-approvals.ts`, about 216 calls in total, not per token). For each token, set `owner_since` = timestamp of its latest transfer in the window. Tokens with no transfer in the window get `owner_since` = window start (that's enough to pass a 30-day rule). Run it as an operator route behind `isAuthorizedCron`.
- Pulse reads `owner_since` from Supabase. If the read fails, it reports `tenure_unknown`. It never treats "unknown" as "long-held".

### 1.3 Fail-closed, never fail-silent

A check that couldn't be read leaves level 4 not granted and says why, matching the existing "couldn't read ≠ not found" rule. Don't cache a "couldn't read".

### 1.4 Response (additive only)

Add `ownership_check` to the Pulse response. Don't remove or rename anything; manifest hashes are pinned.

```json
"ownership_check": {
  "passed": false,
  "reasons": ["tenure_short"],
  "owner_since": "2026-11-02T03:11:00Z",
  "tenure_days_required": 30,
  "canvas_delegate_set_by_owner": true,
  "delegate_xyz": { "checked": true, "delegations_found": 1 },
  "as_of": "2026-11-14T00:00:00Z"
}
```

Reason codes: `owner_mismatch`, `owner_unreadable`, `tenure_short`, `tenure_unknown`, `canvas_delegate_stale`, `canvas_unreadable`, `delegations_unreadable`. UI copy uses plain words and shortened addresses (0x1234…abcd), per AGENTS.md.

### 1.5 Tests (add to test:all and test:unit)

Pass case; each reason code on its own; owner API and on-chain owner disagree; canvas delegate set by a previous owner; a failed delegate.xyz read; Supabase down. Also update `lib/record-card/arena-canvas-rank.test.ts` fixtures if they assume the old pass rule.

### 1.6 Expected effect

Recently traded Normies, and Normies with a canvas delegate left over from a previous owner, drop from level 4 and out of sector ranks (the Arena Canvas rank uses the same gate). That's the intended effect. Release-note it.

## PR-2: move popularity out of the level ("Trending on NCH")

- `MAX_LEVEL` 5 → 4. Levels 1–4 = the four trust checks, nothing else.
- Keep the `popularity` object exactly as it is (same distinct-caller counting, thresholds 8 Pulse callers / 3 Paths users / 14 days). Add top-level `trending: boolean` (= `popularity.popular`). It never changes `pulse_level`.
- Drop the Luminous name and status from the level. Show a separate "Trending on NCH" badge with the raw counts beside it.
- Add `pulse_scale: "trust-0-4"`, so outside consumers can tell the new scale from the old 0–5 one.
- Hard-coded `?? 5` fallbacks to change to 4 (or read `max_level`): `components/pulse-hero.tsx`, `components/dashboard.tsx`, `app/record/[tokenId]/opengraph-image.tsx`, `lib/record-card/build.ts`, `lib/path-ranker/rank.ts`, and the example JSON in `app/dashboard/page.tsx`.
- Copy and docs to update in the same PR: the level copy and `POPULARITY_NOTE` in `lib/api/agent-pulse.ts`, the Pulse line in AGENTS.md ("Pulse = trust, never skill"), the "0–5 trust level" row in `docs/zulo/strategy.md`, and every current file that mentions Luminous (grep on 232b1a5): `README.md`, `components/agent-pulse-bar.tsx`, `app/dashboard/page.tsx`, `app/api/chat-ratings/[agentId]/route.ts`, `lib/pulse/beats.ts`, `lib/record-card/types.ts`, `lib/instrumentation/pulse-paths.ts` (+ its test), `lib/api/agent-pulse.test.ts`, `docs/zulo/record-card-spec.md`. Leave `docs/audit/` and `docs/zulo/archive/` alone; they're history. Re-run the grep at build time, since more files may mention it.
- `public/.well-known/ai-tool/normies-cred-pulse.json` describes `max_level` generically, so don't edit it (pinned hash).

Tests: a 4/4 agent with high usage stays 4 with `trending: true`; a 3/4 agent with high usage stays 3; unreadable counters give `trending: false`.

## PR-3: "Has active agent card" actually reads the card

Today it passes when the Normies API record has an agent ID, a name, and one of tagline / system prompt / greeting. It never calls the card.

New rule:

- Read `agentURI(agentId)` on the Identity Registry (already read in `isErc8004Registered`; reuse it, don't read twice).
- Fetch the registration file and take the services entry named A2A.
- Fetch that endpoint only if it passes `assertPublicHttpsUrl` (`lib/security/ssrf.ts`) and its host is on an allowlist (start with `api.normies.art` only). Use `fetchWithTimeout` and the route's existing rate limit.
- Pass when it returns 200 with JSON whose `name` matches the Normie's agent name. Store a hash of the card and add it to the response as `agent_card: { checked, passed, card_hash, as_of }`.
- Can't fetch → reason `card_unreadable`, not granted, and don't cache it.

Keep the breakdown string "Has active agent card".

Be honest in the copy. Normies' own docs say the A2A transport isn't live yet. This check proves the card is published and consistent, not that the agent answers messages. Say "Agent card published", never "agent online". Because Normie cards are generated by the Normies API, nearly every awakened Normie will still pass. The new rule makes the check true, not more discriminating; the real filter is PR-1.

## Scope contract (`.claude/contract.txt`, land it on main first)

- **PR-1:** `lib/api/agent-pulse.ts`, `lib/api/*.test.ts`, `lib/ownership-check*.ts`, `lib/owners-refresh*.ts`, `supabase/functions/owners-refresh/**`, `supabase/sql/2026-11-*-normie-owner-since.sql`, `app/api/cron/owner-since-backfill/**`, `lib/record-card/**`, `package.json` (test scripts only)
- **PR-2:** `lib/api/agent-pulse*.ts`, `lib/instrumentation/pulse-paths*.ts`, `lib/pulse/**`, `components/pulse-hero.tsx`, `components/dashboard.tsx`, `components/agent-pulse-bar.tsx`, `app/record/**`, `app/dashboard/page.tsx`, `app/api/chat-ratings/**`, `lib/path-ranker/**`, `lib/record-card/**`, `README.md`, `AGENTS.md`, `docs/zulo/strategy.md`, `docs/zulo/record-card-spec.md`
- **PR-3:** `lib/api/agent-pulse.ts`, `lib/agent-card*.ts`, `lib/security/ssrf.ts` (allowlist only)

`package.json` is listed only for the test scripts; lockfiles stay protected.

## Loose ends (measure twice)

Checked 2026-11-14 by BossBot:

- **Agent card URL: confirmed.** `https://api.normies.art/agents/agent-card/7141` returns 200 with `"name":"Zulo"` and an A2A interface at `https://api.normies.art/agents/a2a/7141`. PR-3's name match works for #7141.
- **`delegateSetBy` meaning: consistent, not proven.** For #7141, `delegateSetBy` (0xfafd…1031) equals the current owner from `/normie/7141/owner`, and the delegate is 0xb879…8767. That fits "address that set the delegate", but a token where a previous owner set it is still needed to prove check (c) catches the stale case. Check one recently transferred Normie with a delegate against the canvas contract's event on Etherscan before building PR-1.
- **owners-refresh frequency: not in the repo.** The job is pg_cron → pg_net, but its `cron.schedule` isn't in `supabase/sql/` (only `approvals-refresh` is), so it was set up directly in Supabase. Ryan to check `select jobname, schedule from cron.job;`. If it runs less than daily, show "owner data as of …" next to the check. (`delegates-refresh` is noted as hourly in its header.)
- **Spec fix:** `supabase/functions/owners-refresh/plan.ts` mirrors `lib/owners-refresh.ts` byte for byte; both are now in PR-1's scope.

Still open:

- **N = 30 days.** Ryan's call. Shorter catches less wash-trading; longer flags more honest new buyers.
- **Who owns the ERC-8004 agent ID for a Normie** (the holder or the Normies adapter contract)? Not needed for this spec, but needed before any "agent wallet matches owner" check later.
