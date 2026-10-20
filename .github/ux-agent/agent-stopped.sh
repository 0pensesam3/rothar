#!/usr/bin/env bash
# Runs after an agent step that failed. Decides whether the failure should stop the run.
#
# Usage: agent-stopped.sh <agent name> <execution file>
#
# Running out of turns is not a reason to stop: the agent may well have finished its work
# (on 20 Oct the tester wrote its whole report in 42 turns against a limit of 40, and the
# run died anyway). So a turn overrun is a warning, and the step after this one checks
# whether the agent actually wrote what it was meant to. Any other failure (no execution
# file, an API or auth error, a crash) still stops the run, so the alert job tells Anya.
set -uo pipefail
name="$1"; out="${2:-}"

if [ -z "$out" ] || [ ! -f "$out" ]; then
  echo "::error::The $name stopped before it started (no transcript). See the agent step above."
  exit 1
fi

# Prints only Claude's last words and the error, not the full transcript.
jq -r '.[] | select(.type=="assistant") | .message.content[]? | select(.type=="text") | .text' "$out" | tail -c 1500
jq -r '.[] | select(.type=="result") | (.result // .errors // empty) | tostring' "$out" | tail -c 1500

subtype=$(jq -r '[.[] | select(.type=="result")] | last | .subtype // ""' "$out")
turns=$(jq -r '[.[] | select(.type=="result")] | last | .num_turns // "?"' "$out")

case "$subtype" in
  success|error_max_turns)
    echo "::warning::The $name went over its turn limit ($turns turns). Carrying on: the next step checks whether it finished its work."
    exit 0 ;;
esac

echo "::error::The $name stopped with an error (above), not just a turn overrun."
exit 1
