# PR review checklist

Used for every review, including an author reviewing its own PR (that review must run in a separate session from the one that wrote the code). Answer each line in the review comment: yes, no, or n/a with a reason.

1. Scope: every changed file matches a glob in `.claude/contract.txt` on `main`.
2. Safety: nothing in the diff breaks a line of AGENTS.md "Safety (non-negotiable)". Name any line the diff comes close to.
3. Status: every status claim is copied from `lib/official-status.ts`, not paraphrased, and nothing is shown as more live than that file says.
4. Money: any money figure follows AGENTS.md "Numbers yes, advice never" (source, as-of time, official link; no projections or wallet-level figures).
5. Facts: every new fact has a source, and the reviewer re-checked it live this run, not from memory or the PR text.
6. Pinned files: `public/.well-known/ai-tool/*.json` untouched.
7. Tests: `pnpm typecheck` and `pnpm test:all` pass, or the PR says why they could not run.
8. Signature: agent name in the commit message and the PR title or body.
9. Leftovers: no secrets, env values, debug output or dated to-do items.
