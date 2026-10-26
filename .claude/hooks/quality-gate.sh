#!/usr/bin/env bash
# Stop gate: when the branch has code changes against main (committed or not), `pnpm lint` and the unit tests
# related to those changes must pass before a turn may end. No code changes → exits at once. A state that
# already passed (same HEAD + same working diff) is not re-run. Exit 2 = block the stop and show why.
cd "${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel)}" || exit 0
cat >/dev/null # the hook's stdin payload is not needed
base="${QUALITY_GATE_BASE:-main}"
changed=$({
  git diff --name-only "$base"...HEAD 2>/dev/null
  git diff --name-only HEAD
  git ls-files --others --exclude-standard
} | grep -E '\.(ts|tsx|mjs|js)$|^firestore\.rules$' | grep -v '^\.claude/' | sort -u)
[ -z "$changed" ] && exit 0

key=$({ git rev-parse HEAD; echo "$base"; git diff HEAD; } | git hash-object --stdin)
stamp="$(git rev-parse --git-dir)/quality-gate.ok"
[ -f "$stamp" ] && [ "$(cat "$stamp")" = "$key" ] && exit 0

# One gate at a time across every session and worktree of this repo: two full vitest runs at once ate ~8 GB and
# lagged the PC. mkdir is the atomic lock (no flock in Git Bash); a lock whose owner died or is older than 15 min is
# stale. After waiting, the stamp is checked again: the session we waited for may have just passed this very state.
lock="$(git rev-parse --path-format=absolute --git-common-dir)/quality-gate.lock"
waited=0
locked=
until mkdir "$lock" 2>/dev/null && locked=1; do
  owner=$(cat "$lock/pid" 2>/dev/null)
  if { [ -n "$owner" ] && ! kill -0 "$owner" 2>/dev/null; } || [ -n "$(find "$lock" -maxdepth 0 -mmin +15 2>/dev/null)" ]; then
    rm -f "$lock/pid"; rmdir "$lock" 2>/dev/null
    continue
  fi
  # The hook's timeout is 600 s: past 8 min of waiting, run anyway rather than be killed.
  [ "$waited" -ge 480 ] && break
  sleep 5
  waited=$((waited + 5))
done
if [ -n "$locked" ]; then
  echo $$ >"$lock/pid"
  trap 'rm -f "$lock/pid"; rmdir "$lock" 2>/dev/null' EXIT
fi
if [ "$waited" -gt 0 ]; then
  key=$({ git rev-parse HEAD; echo "$base"; git diff HEAD; } | git hash-object --stdin)
  [ -f "$stamp" ] && [ "$(cat "$stamp")" = "$key" ] && exit 0
fi

if ! out=$(pnpm -s lint 2>&1); then
  echo "Puerta de calidad: pnpm lint falla. Corrígelo antes de dar el trabajo por terminado." >&2
  echo "$out" | tail -40 >&2
  exit 2
fi
if ! out=$(pnpm -s vitest run --changed "$base" 2>&1); then
  echo "Puerta de calidad: fallan tests relacionados con los cambios (vitest run --changed $base)." >&2
  echo "$out" | tail -60 >&2
  exit 2
fi
echo "$key" >"$stamp"
exit 0
