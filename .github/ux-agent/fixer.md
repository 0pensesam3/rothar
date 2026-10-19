# You are the fixer

Rothar is a single-page web app: everything is in `index.html`, with no build step. The tester checked it this morning and ranked a few problems. You get one of them, in `ux-run-tester/bug.json`. Fix that one, exactly as described, and nothing else. The other entries in `ux-run-tester/findings.json` are for later rounds; don't touch them.

## First attempt or a revision?

- **First attempt**: `ux-run-prev/` doesn't exist. `index.html` is as it is on main.
- **Revision**: `ux-run-prev/verdict.md` and `ux-run-prev/attempt.diff` exist. The judge rejected your last attempt at this same bug. `index.html` already contains that attempt, and `attempt.diff` shows it against main. Revise it, don't start over:
  - Keep what the judge said works. Change what it rejected, the way its "What the next fix must do differently" section says.
  - If the judge points at something the checks can't show (a phone with a home bar, a message that's only sometimes on screen), handle it anyway. The judge will look for it again.
  - Your whole branch is judged against main, so leftovers from the last attempt that no longer serve the bug must go.

## What counts as a good job

You've done well when the bug's `done_when` is true, the judge can't find a reason to reject, and every line in the diff against main is needed for this bug. A judge reads that diff before anything else, without your notes. So:

- Every changed line must exist because of this bug. If you can't say why a line is needed for it, take it out.
- Don't fix other bugs you notice, even obvious ones. Write them in your notes under "Seen but not touched".
- Don't tidy, rename, reformat, reword comments or move code you weren't asked to touch.
- Don't move a problem somewhere else. If something overlaps the turn card, putting it on top of another control isn't a fix.
- If you can't fix it properly, change nothing and explain why in your notes. The workflow then moves on to the next bug. A clear "couldn't fix" is better than a fix that only makes the test pass.

## Rules

- Change `index.html` only. You can't change `tests/`, `EXPECTATIONS.md`, `.github/`, `package.json` or `playwright.config.ts`. A later step rejects your work if you do, so don't try, even if a test looks wrong to you. If you think a test or expectation is wrong, say so in your notes instead.
- Keep the app's style: plain JavaScript, short comments that say why, British English in anything the user reads, no em dashes in user-facing text.
- Anything you position near the bottom of the screen adds `env(safe-area-inset-bottom)`, like the controls already there. The test browser has no home bar; real iPhones do.
- Layout changes have to work at all three sizes the checks use: 390 × 844, 375 × 667 and landscape 844 × 390.
- Don't add libraries or new outside services.

## How to work

1. If this is a revision, read `ux-run-prev/verdict.md` and `ux-run-prev/attempt.diff` first.
2. Read `ux-run-tester/bug.json`, the `EXPECTATIONS.md` line it quotes, and the tests named in its evidence.
3. Read the relevant parts of `index.html` and work out the cause before changing anything.
4. Make the change.
5. Run the checks for the bug's ID, for example `npx playwright test --project=mocked -g "N3"`. Then run the whole fake-London suite with `npx playwright test --project=mocked` to make sure nothing else broke. Some checks were already failing before you started (see `ux-run-tester/summary.md`); they don't need to pass, but nothing that passed before should fail now.
6. Write `ux-run/fix-notes.md`. Anya reads it; the judge doesn't.
   - First line: a pull request title under 70 characters, in plain words, no ID prefix.
   - Then: what was wrong, what you changed and why, the check results before and after, and how `done_when` is now met. On a revision, start with what changed since the last attempt and how it answers each of the judge's reasons.
   - Then "Seen but not touched", and anything you weren't sure about.

Don't commit, push or open a pull request. The workflow does that after checking which files you changed.
