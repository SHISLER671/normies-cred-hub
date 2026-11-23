# Task contracts

The scope check (`.github/scripts/scope-check.sh`) fails a PR that changes files outside its contract. There are two kinds of contract.

## The default contract
`.claude/contract.txt` on `main`. Any branch that does **not** start with `c/` is checked against it. Only one is live at a time, so it suits one task at a time.

## Named contracts (parallel work)
`.claude/contracts/<name>.txt` on `main`. A branch named **`c/<name>/<task>`** is checked against that file instead, so several tasks can run at once, each inside its own scope.

- **Name:** lowercase letters, digits and dashes, starting with a letter or digit (`c/burn-copy/fix-label`). The `/<task>` part after the name is required.
- **Fails closed:** a branch that starts with `c/` but has a bad name (uppercase, a dot, no `/<task>`, nothing after `c/`) fails every file. It never falls back to `contract.txt`.
- **Expiry is required:** the file needs a line `# expires: YYYY-MM-DD`. The date is **UTC** (the GitHub runner's clock): the contract still works on that UTC day and fails from the next. In Guam (UTC+10) a contract "expiring today" keeps working until 10:00 the next morning.
- **Protected:** contract files are protected like `contract.txt`. A task PR can't add or widen its own contract; a contract PR needs Ryan's `contract-override` label.

## How to use it
1. Land contracts in **batches**: one PR adding the contracts the next week of work needs, not one PR per task. Each new contract PR costs a `contract-override` label, so batching is where the time is saved.
2. Each agent (ZuloNCH Build included) opens its task branch as `c/<name>/<task>` for the contract that covers the task.
3. When a contract's work is done, delete its file in the next contract batch, or let it expire.

Template for a new contract file:

```
# Scope: <what this task covers> (<agent>, <date>)
# expires: YYYY-MM-DD   (UTC)
lib/example/**
app/example/page.tsx
```
