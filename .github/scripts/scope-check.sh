#!/usr/bin/env bash
# Scope check: fails a PR that changes protected files or files outside the
# task contract (.claude/contract.txt as it exists on the BASE branch).
#
# Inputs (env):
#   BASE_REF       base branch name (e.g. main). Required.
#   LABELS_JSON    JSON array of PR label names. Optional, default [].
#   HEAD_REF       PR branch name. Optional. A branch named c/<name>/... is checked against
#                  .claude/contracts/<name>.txt on the base branch instead of .claude/contract.txt.
#   TODAY          YYYY-MM-DD, for tests only. Default: today in UTC.
#   GITHUB_STEP_SUMMARY  optional; a Markdown report is appended there.
# Exit 0 = pass (or override), 1 = violation, 2 = setup error.
set -euo pipefail

BASE_REF="${BASE_REF:?BASE_REF is required}"
LABELS_JSON="${LABELS_JSON:-[]}"
SUMMARY="${GITHUB_STEP_SUMMARY:-/dev/null}"
CONTRACT=".claude/contract.txt"
CONTRACTS_DIR=".claude/contracts"
HEAD_REF="${HEAD_REF:-}"
TODAY="${TODAY:-$(date -u +%F)}"
OVERRIDE_LABEL="contract-override"

override=false
if jq -e --arg l "$OVERRIDE_LABEL" 'index($l) != null' <<<"$LABELS_JSON" >/dev/null 2>&1; then
  override=true
fi

# --no-renames lists a rename as delete(old) + add(new), so both paths are checked.
# core.quotePath=false keeps non-ASCII names (e.g. app/café/) as real paths, not "\303\251" escapes.
mapfile -t changed < <(git -c core.quotePath=false diff --name-only --no-renames --diff-filter=ACMRDT "origin/${BASE_REF}...HEAD")

# Always-forbidden rules. Hardcoded here on purpose: nothing in the repo can relax them.
# Prints a reason if the path is protected, nothing otherwise.
forbidden_reason() {
  local f="$1" base="${1##*/}"
  case "$f" in
    .github/workflows/*) echo "protected: .github/workflows/"; return ;;
    .github/scripts/*)   echo "protected: .github/scripts/ (scope check itself)"; return ;;
    public/.well-known/*) echo "protected: public/.well-known/ (pinned manifests)"; return ;;
    "$CONTRACT")         echo "protected: contract file (a PR cannot widen its own scope)"; return ;;
    "$CONTRACTS_DIR"/*)  echo "protected: contract file (a PR cannot widen its own scope)"; return ;;
  esac
  case "$base" in
    pnpm-lock.yaml|package-lock.json|yarn.lock|bun.lockb|bun.lock|npm-shrinkwrap.json)
      echo "protected: lockfile"; return ;;
  esac
  # Env files: .env, .env.*, *.env, .envrc — except names ending in .example (names only, checked by CI).
  if [[ "$base" == *.example ]]; then return; fi
  if [[ "$base" == ".env" || "$base" == .env.* || "$base" == *.env || "$base" == ".envrc" ]]; then
    echo "protected: env file"; return
  fi
  # Key material.
  case "$base" in
    *.pem|*.key|*.p12|*.pfx|id_rsa|id_ed25519) echo "protected: key file"; return ;;
  esac
}

# Which contract applies. A branch c/<name>/... names a contract in .claude/contracts/ on the base
# branch; it must exist there and carry an unexpired "# expires: YYYY-MM-DD" line. Any other branch
# uses .claude/contract.txt as before. The name only picks among contracts Ryan already merged.
contract_error=""
if [[ "$HEAD_REF" =~ ^c/([a-z0-9][a-z0-9-]{0,62})/ ]]; then
  CONTRACT="${CONTRACTS_DIR}/${BASH_REMATCH[1]}.txt"
  if ! git cat-file -e "origin/${BASE_REF}:${CONTRACT}" 2>/dev/null; then
    contract_error="named contract ${CONTRACT} is not on ${BASE_REF} (merge the contract first)"
  else
    expires="$(git show "origin/${BASE_REF}:${CONTRACT}" | sed -n 's/^#[[:space:]]*expires:[[:space:]]*\([0-9-]*\).*/\1/p' | head -n1)"
    if [[ ! "$expires" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
      contract_error="named contract ${CONTRACT} has no valid '# expires: YYYY-MM-DD' line"
    elif [[ "$TODAY" > "$expires" ]]; then
      contract_error="named contract ${CONTRACT} expired on ${expires}"
    fi
  fi
elif [[ "$HEAD_REF" == c/* ]]; then
  contract_error="branch ${HEAD_REF} starts with c/ but has no valid contract name (c/<lowercase-name>/...)"
fi

# Contract allow list from the BASE branch only (never from the PR head).
have_contract=false
patterns=()
if [[ -n "$contract_error" ]]; then
  : # every changed file fails below; no fallback to another contract
elif contract_text="$(git show "origin/${BASE_REF}:${CONTRACT}" 2>/dev/null)"; then
  have_contract=true
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%%#*}"
    line="${line#"${line%%[![:space:]]*}"}"; line="${line%"${line##*[![:space:]]}"}"
    if [[ -n "$line" ]]; then patterns+=("$line"); fi
  done <<<"$contract_text"
fi

# Glob matcher (no deps): '**' = any depth (incl. zero dirs), '*' and '?' never cross '/',
# a trailing '/' means everything under that folder. Matched against the full repo path.
# Prints the paths that match NONE of the patterns.
outside_contract() {
  # shellcheck disable=SC2016  # JS source, not shell
  node -e '
    const pats = JSON.parse(process.argv[1]);
    const files = JSON.parse(process.argv[2]);
    const toRe = (g) => {
      if (g.startsWith("./")) g = g.slice(2);
      if (g.endsWith("/")) g += "**";
      let re = "";
      for (let i = 0; i < g.length; i++) {
        const c = g[i];
        if (c === "*" && g[i + 1] === "*") {
          i++;
          if (g[i + 1] === "/") { i++; re += "(?:.*/)?"; } else { re += ".*"; }
        } else if (c === "*") re += "[^/]*";
        else if (c === "?") re += "[^/]";
        else re += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
      }
      return new RegExp("^" + re + "$");
    };
    const res = pats.map(toRe);
    for (const f of files) if (!res.some((r) => r.test(f))) console.log(f);
  ' "$(printf '%s\n' "${patterns[@]}" | jq -R . | jq -sc .)" "$(printf '%s\n' "${changed[@]}" | jq -R . | jq -sc .)"
}

declare -A reason=()
for f in "${changed[@]}"; do
  r="$(forbidden_reason "$f")"
  if [[ -n "$r" ]]; then reason["$f"]="$r"; fi
done
if [[ -n "$contract_error" ]]; then
  for f in "${changed[@]}"; do
    if [[ -z "${reason[$f]:-}" ]]; then reason["$f"]="$contract_error"; fi
  done
elif $have_contract && ((${#changed[@]})); then
  if ((${#patterns[@]} == 0)); then
    for f in "${changed[@]}"; do
      if [[ -z "${reason[$f]:-}" ]]; then reason["$f"]="outside contract (contract is empty)"; fi
    done
  else
    while IFS= read -r f; do
      if [[ -n "$f" && -z "${reason[$f]:-}" ]]; then reason["$f"]="outside contract (${CONTRACT} on ${BASE_REF})"; fi
    done < <(outside_contract)
  fi
fi

# Report
{
  echo "## Scope check"
  echo
  echo "- Base: \`${BASE_REF}\`"
  if [[ -n "$contract_error" ]]; then
    echo "- Contract: **${contract_error}**"
  elif $have_contract; then
    echo "- Contract: \`${CONTRACT}\` from \`${BASE_REF}\` (${#patterns[@]} pattern(s))"
  else
    echo "- Contract: none on \`${BASE_REF}\` — only the protected-file rules apply"
  fi
  echo "- Override label \`${OVERRIDE_LABEL}\`: $([[ $override == true ]] && echo '**ON**' || echo 'off')"
  echo
  echo "| File | Result |"
  echo "|---|---|"
  for f in "${changed[@]}"; do
    echo "| \`$f\` | ${reason[$f]:-ok} |"
  done
} >>"$SUMMARY"

if [[ -z "$contract_error" ]] && ! $have_contract; then
  echo "::notice::No ${CONTRACT} on ${BASE_REF}; checking protected files only."
fi
echo "Changed files: ${#changed[@]}  Violations: ${#reason[@]}  Override: ${override}"
for f in "${!reason[@]}"; do
  if $override; then
    echo "::warning file=$f::${reason[$f]} (allowed by ${OVERRIDE_LABEL})"
  else
    echo "::error file=$f::${reason[$f]}"
  fi
done

if ((${#reason[@]})) && ! $override; then
  echo >>"$SUMMARY"; echo "**Failed.** Keep the PR inside the contract, or Ryan adds \`${OVERRIDE_LABEL}\`." >>"$SUMMARY"
  exit 1
fi
echo >>"$SUMMARY"; echo "**Passed.**" >>"$SUMMARY"
