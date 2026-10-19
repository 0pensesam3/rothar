#!/usr/bin/env bash
# What happens after a fix attempt that won't go to Anya.
#
#   next-round.sh retry      same bug, same PR, next attempt (the fixer revises its own work)
#   next-round.sh next-bug   this bug is parked; start on the tester's next pick, or report the day
#
# Expects in the environment: GH_TOKEN REPO BASE OWNER RUN_URL RUN_ID
#   ATTEMPT BUG PR FINDINGS_RUN BUG_COUNT MAX_ATTEMPTS
set -euo pipefail

dispatch() { gh workflow run daily-ux.yml --repo "$REPO" --ref "$BASE" -f fix=true -f findings_run="$FINDINGS_RUN" "$@"; }

# The REASON line from the latest judge comment on a PR
last_reason() {
  gh api "repos/$REPO/issues/$1/comments" --jq '[.[] | select(.body|startswith("## Judge"))][-1].body // ""' |
    sed -n 's/^REASON: *//p' | head -n1 | cut -c1-160
}

report_issue() { gh issue list --repo "$REPO" --label ux-report --state open --json number -q '.[0].number'; }

case "$1" in
  retry)
    echo "Attempt $((ATTEMPT + 1)) of $MAX_ATTEMPTS on the same bug, revising PR #$PR"
    dispatch -f bug="$BUG" -f attempt=$((ATTEMPT + 1)) -f pr="$PR" -f retry_of="$RUN_ID"
    ;;

  next-bug)
    next=$((BUG + 1))
    if [ "$next" -lt "$BUG_COUNT" ]; then
      echo "Moving on to the tester's pick $((next + 1)) of $BUG_COUNT"
      dispatch -f bug="$next" -f attempt=1
      exit 0
    fi
    # Nothing left to try today: tell Anya once, with what was tried and why each was parked
    today=$(date -u +%F)
    parked=$(gh pr list --repo "$REPO" --label ux-parked --state closed --search "closed:>=$today" \
               --json number,title -q '.[] | "\(.number)\t\(.title)"' |
             while IFS=$'\t' read -r n t; do r=$(last_reason "$n"); echo "- #$n $t: ${r:-see the PR}"; done)
    issue=$(report_issue)
    [ -n "$issue" ] || exit 0
    {
      echo "@$OWNER ❌ Nothing to merge from today's check ([run]($RUN_URL)). Every fix the tester picked was parked:"
      echo
      if [ -n "$parked" ]; then echo "$parked"; else echo "- The fixer couldn't make a change for any of them. Details are in the runs."; fi
      echo
      echo "Parked bugs stay in tomorrow's report, so the tester can pick them again."
    } > nothing.md
    gh issue comment "$issue" --repo "$REPO" --body-file nothing.md
    ;;

  *) echo "usage: next-round.sh retry|next-bug" >&2; exit 2 ;;
esac
