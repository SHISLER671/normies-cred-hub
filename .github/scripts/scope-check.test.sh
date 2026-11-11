#!/usr/bin/env bash
# Self-test for scope-check.sh: builds throwaway git repos and checks pass/fail.
# Run: bash .github/scripts/scope-check.test.sh
set -euo pipefail

SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/scope-check.sh"
pass=0; fail=0; out="$(mktemp)"

# setup <contract-or-NONE>: new repo with an "origin/main" base, then a PR branch.
setup() {
  local dir; dir="$(mktemp -d)"
  cd "$dir"
  git init -q -b main
  git config user.name test; git config user.email test@example.invalid
  mkdir -p app lib .github/workflows .claude
  echo x >app/page.tsx; echo x >lib/a.ts; echo x >.github/workflows/ci.yml
  echo x >pnpm-lock.yaml; echo x >README.md
  if [[ "$1" != NONE ]]; then printf '%b' "$1" >.claude/contract.txt; fi
  git add -A; git commit -qm base
  git update-ref refs/remotes/origin/main HEAD
  git checkout -qb pr
}

# run_case <name> <expect 0|1> <labels-json> -- <shell commands making the PR change>
run_case() {
  local name="$1" expect="$2" labels="$3" contract="$4"; shift 4
  ( setup "$contract"; eval "$*"; git add -A; git commit -qm change
    BASE_REF=main LABELS_JSON="$labels" GITHUB_STEP_SUMMARY=/dev/null bash "$SCRIPT" >"$out" 2>&1 ) && got=0 || got=$?
  if [[ "$got" == "$expect" ]]; then
    pass=$((pass+1)); echo "ok   - $name"
  else
    fail=$((fail+1)); echo "FAIL - $name (expected $expect, got $got)"; sed 's/^/       /' "$out"
  fi
}

C='# task contract\napp/**\n\nlib/*.ts\n'
run_case "allowed file passes"                0 '[]' "$C" 'echo y >app/page.tsx'
run_case "new nested file under app/** passes" 0 '[]' "$C" 'mkdir -p app/x/y; echo y >app/x/y/z.tsx'
run_case "lib/*.ts does not cross folders"    1 '[]' "$C" 'mkdir -p lib/sub; echo y >lib/sub/b.ts'
run_case "file outside list fails"            1 '[]' "$C" 'echo y >README.md'
run_case "deleting a file outside list fails" 1 '[]' "$C" 'git rm -q README.md'
run_case "rename out of scope fails (old path)" 1 '[]' "$C" 'git mv README.md app/README.md'
run_case "workflow edit fails"                1 '[]' "$C" 'echo y >.github/workflows/ci.yml'
run_case "scope-check script edit fails"      1 '[]' "$C" 'mkdir -p .github/scripts; echo y >.github/scripts/scope-check.sh'
run_case "lockfile fails"                     1 '[]' "$C" 'echo y >pnpm-lock.yaml'
run_case "nested lockfile fails"              1 '[]' "NONE" 'echo y >app/package-lock.json'
run_case ".env fails"                         1 '[]' "NONE" 'echo y >.env'
run_case ".env.local fails"                   1 '[]' "NONE" 'echo y >app/.env.local'
run_case ".env.example passes"                0 '[]' "NONE" 'echo y >.env.example'
run_case "public/.well-known edit fails"      1 '[]' "NONE" 'mkdir -p public/.well-known; echo y >public/.well-known/x.json'
run_case "contract edit fails"                1 '[]' "$C" 'echo "**" >>.claude/contract.txt'
run_case "contract added in PR fails"         1 '[]' "NONE" 'echo "**" >.claude/contract.txt'
run_case "head contract is ignored (base wins)" 1 '[]' "$C" 'echo "README.md" >>.claude/contract.txt; echo y >README.md'
run_case "override label passes everything"   0 '["bug","contract-override"]' "$C" 'echo y >README.md; echo y >.github/workflows/ci.yml; echo y >pnpm-lock.yaml; echo y >.env; echo "**" >>.claude/contract.txt'
run_case "other labels do not override"       1 '["contract-overrides"]' "$C" 'echo y >README.md'
run_case "missing contract: normal file passes" 0 '[]' "NONE" 'echo y >README.md'
run_case "missing contract: workflow still fails" 1 '[]' "NONE" 'echo y >.github/workflows/ci.yml'
run_case "non-ASCII path inside contract passes" 0 '[]' "$C" 'mkdir -p "app/café"; echo y >"app/café/page.tsx"'
run_case ".envrc fails"                       1 '[]' "NONE" 'echo y >.envrc'
run_case "key file fails"                     1 '[]' "NONE" 'echo y >app/signer.pem'
run_case "empty contract fails any change"    1 '[]' '# nothing allowed\n' 'echo y >app/page.tsx'

echo
echo "$pass passed, $fail failed"
[[ $fail -eq 0 ]]
