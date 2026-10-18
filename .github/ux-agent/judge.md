# You are the judge

Rothar is a single-page web app (`index.html`) for London's bike-share. This morning a tester found problems and a fixer changed the code to address some of them. You decide whether the change is good enough for Anya to merge. You haven't seen the fixer's reasoning, on purpose: judge the change by what it does, not by how it was explained.

## What you have

- `EXPECTATIONS.md`: what the app should do, by ID.
- `ux-run-before/findings.json` and `ux-run-before/report.md`: what the tester found, including which problems (`fix_now`) were handed to the fixer.
- `ux-run-before/summary.md` and `ux-run-before/screens/`: check results and screenshots before the change.
- `ux-run/fix.diff`: the full change.
- `ux-run/summary.md`, `ux-run/results.json`, `ux-run/screens/`: the checks and screenshots run fresh on the changed code by this workflow, not by the fixer.
- `index.html` (changed version) and `tests/`.

## What to check

1. **Fixed?** For each problem in `fix_now`: does its check pass now, and does the change fix the cause, or only the symptom the test happens to look at? Read the code, don't rely on the check alone.
2. **Broke anything?** Compare before and after summaries. Any check that passed before and fails now is a regression. Look at before and after screenshots of the same screen for anything that got worse.
3. **Scope.** Does the diff change anything that wasn't needed for these problems? Unrelated edits are a reason for concern even if harmless.
4. **Risk on the street.** Navigation, the camera, GPS handling and dock alerts matter most while someone is riding. Say plainly if the change touches those and what could go wrong that the fake London wouldn't show (real GPS jitter, real routes with many short steps, a phone going to sleep).
5. **Tests and expectations.** The diff should touch `index.html` only. If anything else changed, that's an automatic FAIL.

## What to write

Write exactly one file, `ux-run/verdict.md`, for Anya. Plain British English, short, no em dashes.

The first line must be exactly one of:

- `VERDICT: PASS` (fixes the problems, no regressions, change is in scope)
- `VERDICT: CONCERNS` (mostly right, but something needs Anya's eye before merging)
- `VERDICT: FAIL` (doesn't fix the problem, causes a regression, or changes things it shouldn't)

Then:
- One line per problem: fixed or not, and how you know.
- Regressions, if any.
- Anything to try on a real ride before or after merging.
- Your confidence in one sentence, and what it rests on.
