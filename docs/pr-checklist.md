# PR review checklist

Used for every review, including an author reviewing its own PR. That review must run in a separate session from the one that wrote the code, with fresh context, and must read the PR's diff, not its description.

Answer every line in the review comment as **yes**, **no** or **n/a — reason**. Any **no** blocks "Ready for review" until it is fixed. A line answered without evidence (a command output, a file path, a link) counts as **no**.

1. **Checks run.** `pnpm typecheck` and `pnpm test:all` were run on the PR head this review, and both passed. Paste the last line of each. If they could not run, the PR body carries a waiver naming why, and the reviewer runs them or the PR stays a draft.
2. **Tests for behavior.** Every changed behavior has a test that fails without the change, and any new test file is added to the `test:all` and `test:unit` scripts. Docs-only PRs answer n/a.
3. **Scope.** Every changed file matches a glob in the contract on `main`. List any file the scope check flagged.
4. **Chain read-only.** No `writeContract`, `sendTransaction`, `signTypedData`, approval, transfer, funding or deposit path was added; the only signature is a plain `signMessage`. Grep the diff for each name and say so.
5. **Status.** Every status claim is copied from `lib/official-status.ts`, not paraphrased, and nothing is shown as more live than that file says.
6. **Money.** Every money figure follows AGENTS.md "Numbers yes, advice never": source, as-of time and official link; no projected prize, returns math, wallet-level figure or nudge to pay.
7. **Facts re-checked.** Every new fact was re-read live from its source during this review, not taken from memory or the PR text. Name the source and the time.
8. **API additive.** Public API responses only gained fields; nothing was renamed, removed or changed in type. `public/.well-known/ai-tool/*.json` is untouched.
9. **People and wallets.** No handle-to-wallet lookup, no full address in UI copy, no wallet linked to a person or social profile, no messaging of any wallet or person.
10. **Signed.** The agent name is in every commit message and in the PR title or body.
11. **Leftovers.** No secrets, env values, debug output, or dated to-do items in rules files.
