# Ask Zulo: how an answer is built (v2, 2026-11-10)

Rewritten by Claude after Ryan's review of live answers ("not broken, just no substance"). What was wrong, what changed, and the rules for anyone editing Ask.

## What was wrong

- **Buried in rules.** Every question sent about 100,000 characters (~25k tokens) in one user message: about 40 "never" sections, the 23k-character collab/rails doctrine on every question, plus the whole context as pretty-printed JSON. The model played safe and recited rules.
- **Consultant-report format.** Understanding / Recommendation / Reasoning / Next steps / Confidence: a factual question came back as a "RECOMMENDATION" with an invented confidence.
- **Mobile hid half the answer.** Phones showed only "Recommendation", so answers stopped mid-thought.
- **Pulse forced first** on every reply with a connected Normie, even when it had nothing to do with the question.
- **No collection math.** Questions about all Normies got tier rules instead of a sum, though the index has every Normie's original pixels.

## How it works now

1. `lib/agent-recommendations/index.ts`: builds context (`buildContext.ts`) and, for collection-wide questions (`isCollectionMathQuery`), loads exact sums over every living Normie (`collectionMath.ts` + `collectionMath.server.ts`, the same cached index and yield rules `/burn` uses), in parallel.
2. `composePrompt.ts` → `composeZuloMessages()` returns a **system** message and a **user** message:
   - System: identity, **HOW TO ANSWER** (first rule the model reads), core Normies/economy doctrine, the output contract. Big doctrine only when the question needs it (`routePrompt`): collab/rails for collab-type questions, agent tools / payment security / ERC-6551 for agent or protocol questions.
   - User: only fact sections that have data, compact context JSON (no doctrine, no wallet address, no empties), the last 4 turns, then the question.
3. The model returns `{ answer, followUps, sources }`. `postProcess.ts` maps that onto the old `ZuloResponse` fields so API callers keep working (`recommendation` = the answer) and adds `followUps`.
4. `pulseFirst.ts`: the Pulse line is added only when trust is part of the question (`isPulseRelevant`).
5. UI (`components/agent-recommendations/zulo-experience.tsx`): one answer, same on phone and desktop, a small trust line when relevant, sources, and tappable follow-ups on the latest reply.

## Rules for editing Ask

- Keep the answer contract on top. New rules go into the right doctrine block, not as another "critical" section.
- Prefer computing numbers in code (like `collectionMath.ts`, `burnMath.ts`, `tierMath.ts`) and handing them to the model. The model quotes; code calculates.
- New big knowledge goes behind a router, not into every prompt. `ask-v2.test.ts` checks a plain question stays under 75,000 characters.
- AGENTS.md still rules: no burn/keep/buy calls (point to `/burn`), no invented prices, plain words (never a bare "AP"), no full wallet addresses.
- Tests: `pnpm test:ask` (includes `ask-v2.test.ts` and `collectionMath.test.ts`).
