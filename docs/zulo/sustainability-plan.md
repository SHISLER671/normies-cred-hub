# NCH sustainability plan (proposal)

Written by Claude on 2026-11-26 for Ryan to review. **This is a proposal, not a shipped feature.** Nothing here changes what NCH offers: every service stays free, payments stay parked, and nothing on NCH asks anyone for money.

This file is about running costs only. It says nothing about product status; for that, read `lib/official-status.ts`.

## Why this exists

Free community tools tend to close the same way: one person pays the bill alone, the bill grows or simply never stops, and one day the tool is gone. NCH is a reputation layer, so going dark would cost more than a hosting bill. The plan is to make NCH so cheap to run that it never has to choose between staying up and staying free.

## What NCH costs to run today

Read on 2026-11-26. Figures are rounded. Each line says where it came from and how sure it is.

| What | What we found | Source and confidence |
|---|---|---|
| Hosting (Vercel) | NCH shares one paid plan with Ryan's other projects. On top of the flat plan fee, metered usage for **all** projects together averaged about 7 cents a day on four sampled days in November, about $2 a month. Most of it is builds and stored deployments, not visitors. | Vercel billing for 2026-11-12, 11-18, 11-23 and 11-24. Four days, not the full month. NCH's exact share is not visible in the summary. |
| Database (Supabase) | Free plan. The largest table has 10,000 rows. | Supabase project settings. Measured. |
| Rate-limit store (Upstash Redis) | Pay-as-you-go plan, $0.00 billed for 2026-11-01 to 11-26. | Vercel integration billing. Measured. |
| AI answers (Ask) | The **only** place NCH calls a paid model. 10 answers were logged between 2026-10-18 and 2026-11-25, so spend today is cents a month. | Answer log (count only). Measured. |
| Cost of one Ask answer | Roughly 2 to 20 cents. | **Estimate.** Prompt size is a guess (10,000 to 40,000 tokens in, up to 4,096 out). Prices are third-party listings read 2026-11-26: about $1.75 in / $5.75 out per million tokens for the main model, $3 / $15 for the fallback. A slow answer can be billed by both. Check the providers' own pricing pages before relying on this. |
| Scheduled jobs | Two: a canvas check every 12 hours and a daily clean-up. | `vercel.json`. Measured. |
| Building NCH | The largest real cost is the AI tooling used to build NCH, not hosting. | Ryan's own figure. Not itemized in this public file. |

Checked in the code on the same day:
- Ask (`POST /api/zulo/ask`) is the only route that calls a model. It goes straight to the providers (no gateway), and there is no answer cache.
- Most public routes already have a rate limit and some caching. The record card page is cached for five minutes. `/arena`, `/arena/rank`, `/burn` and `/pixels` are built fresh on every visit.
- Four small public routes have no rate limit (`/api/tools`, `/api/zulo/currencies`, `/api/zulo/manifest`, `/api/zulo/security`). All four are cached at the edge for one to sixty minutes and return fixed or near-fixed data. The manifest route is worth a second look, because in one setting it can read an address from the chain.

## The real risk is an open tap, not today's bill

Today's bill is small. The danger is one bad day.

Before this plan, Ask had one guard: 12 calls a minute per address. That is 17,280 calls a day from a single address, with no daily limit per caller and no overall ceiling. At a few cents a call, a script left running could cost hundreds of dollars in a day (estimate), stopped only by whatever balance is on the provider accounts.

So the first job is not to shave cents. It is to make the worst day a known, small number.

## Part A: keep the running cost near zero

Target: **$0 to $10 a month** of metered cost for NCH.

| # | Change | Effort | Payoff | Status |
|---|---|---|---|---|
| 1 | **Daily cap on Ask**: per caller and for everyone combined. | Small | Turns an open-ended worst case into a fixed one. | Built in the same PR as this plan. See "First change". |
| 2 | **Provider balance checks (Ryan, in the dashboards)**: keep the two AI provider accounts prepaid with automatic top-up off; set a spend alert on Vercel; set a budget on Upstash. | Minutes, no code | The balance is the last line of defence if code fails. | Proposed |
| 3 | **Keep fewer old deployments**: stored deployments are the largest steady hosting line. Shorten how long old preview deployments are kept. | Minutes, no code | Cents a day, every day. | Proposed. Confirm the setting and its effect in Vercel first. |
| 4 | **Cheaper fallback model**: the fallback model is listed at a higher price than the main one. Newer models from the same provider are listed lower. | Small | Lower cost on the few answers that fall back. | Proposed. Needs a quality check and Ryan's choice. |
| 5 | **Measure, then trim the Ask prompt**: log token counts (numbers only, no question text), then cut what the numbers show is wasted. | Medium | Could halve the cost per answer. | Proposed. Measure before cutting. |
| 6 | **Cache answers to general questions**: only for questions with no wallet and no named Normie, for a short time. Never cache a "couldn't read". | Medium | Saves repeat calls if traffic grows. | Later. Not worth it at ten answers. |
| 7 | **Skip preview builds for docs-only changes.** | Small | Fewer build minutes. | Later |
| 8 | **Lighter rate-limit bookkeeping**: the limiter records analytics on every check. Turning that off means fewer Redis commands. | Small | Small. Confirm the saving first. | Later |

## Part B: covering what is left, without a cash grab

Only the ideas below are on the table. Each is rated for effort, likely payoff and reputation risk.

| # | Idea | Effort | Payoff | Reputation risk |
|---|---|---|---|---|
| 1 | **Cost cuts first** (Part A). | Small | Most of the hosting side. | None |
| 2 | **Spend less on AI while building**: smaller tasks, fewer long sessions, contracts landed in batches, tests left to CI. | Habit, no code | The largest saving available, because build tooling is the largest cost. | None |
| 3 | **NCH as public proof of work** for Ryan's separate consulting business. The link lives on the consulting side. **No sales pitch, banner or link to it on any NCH page.** | Small | Uncertain, could be the largest. | Low, as long as NCH pages carry nothing. |
| 4 | **An optional "keep the lights on" note through GitHub Sponsors**: in the repository only, never in the product. No gate, no perks, no crypto, no holder tier. | Tiny | Small | Low to medium. **Not approved.** Only if Ryan says yes later, and only after checking it against the "no payments" rule in `AGENTS.md`. |
| 5 | **One polite ask for in-kind credits** (hosting or AI credits for an open-source project). Ryan sends it himself, once. NCH and its bots contact no one. | Small | Could cover the whole hosting side. | Low |
| 6 | **Contributor help**: the code is MIT, so others can help. The NCH and Zulo names and branding are not licensed, so a fork must not present itself as NCH or Zulo (see README "License"). | Small to start | Shares the work, not the bill. | Low |

**Never, under this plan:** unparking payments, a paid tier for holders, a paid gate on Pulse, Moves, Ask, record cards or any existing API, a token, ads, or anything that treats crypto as income. Only Ryan can change the payments rule, in a separate and explicit decision.

## First change: a daily cap on Ask

Built in the same PR as this plan. It is the smallest change that removes the open tap.

- **Per caller:** 40 Ask calls in any 24 hours per address, and 40 per wallet when a wallet is sent.
- **Everyone combined:** 300 Ask calls in any 24 hours.
- The 12-a-minute limit stays as it is.
- When a cap is reached, Ask answers with a short, friendly message saying Ask is free and opens again within 24 hours. Nothing is charged and nothing is offered for sale. Everything else on NCH keeps working.
- Worst case with the cap: 300 calls a day. At the estimated 2 to 20 cents each, that is about $6 to $60 on the worst possible day, instead of no limit. Normal days stay at cents.
- The numbers live in one place (`ASK_DAILY_CAP` in `lib/middleware/dailyCap.ts`). Ryan can raise or lower them in one line.

Honest limits: the wallet in a request is not verified, so the per-wallet cap only slows honest clients; the per-address cap and the combined cap do the real work. If the rate-limit store is unreachable, the caps fall back to stricter per-server limits, as the per-minute limit already does.

## How we will know it is working

- NCH's metered hosting stays under $10 a month.
- The most Ask can cost in a day is a number written in this file, not a guess.
- If the combined cap is ever reached on a normal day, that is real demand: raise the cap on purpose, with the cost per answer measured first (Part A, item 5).

Don't take our word for it: every figure above names its source, and the caps are in the code.
