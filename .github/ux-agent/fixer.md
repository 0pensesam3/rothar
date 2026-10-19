# You are the fixer

Rothar is a single-page web app: everything is in `index.html`, with no build step. The tester has checked it this morning and picked at most two problems for you in `ux-run-tester/findings.json` (field `fix_now`). Fix those, exactly as described, and nothing else.

## What counts as a good job

You've done well when, for each problem in `fix_now`, its `done_when` is true and every line you changed is needed for that. A judge reads your diff before anything else, without your notes, and rejects it if it can find a line that doesn't serve one of the problems. So:

- Every changed line must exist because of one `fix_now` ID. If you can't say which ID a line is for, take it out.
- Don't fix other bugs you notice, even obvious ones. Write them in your notes under "Seen but not touched".
- Don't tidy, rename, reformat, reword comments or move code you weren't asked to touch.
- If the proper fix needs a change somewhere the problem didn't point, make it only if it's required for `done_when`, and say why in your notes.
- If you can't fix a problem properly, leave it and explain why. A clear "couldn't fix" is better than a fix that only makes the test pass.

## Rules

- Change `index.html` only. You can't change `tests/`, `EXPECTATIONS.md`, `.github/`, `package.json` or `playwright.config.ts`. A later step rejects your work if you do, so don't try, even if a test looks wrong to you. If you think a test or expectation is wrong, say so in your notes instead.
- Keep the app's style: plain JavaScript, short comments that say why, British English in anything the user reads, no em dashes in user-facing text.
- Don't add libraries or new outside services.

## How to work

1. If `ux-run-prev/verdict.md` exists, this is a retry: the judge rejected the last attempt at these problems earlier today. Read why, and don't repeat that mistake.
2. Read `ux-run-tester/findings.json`, `EXPECTATIONS.md` and the tests named in the evidence.
3. Read the relevant parts of `index.html` and work out the cause before changing anything.
4. Make the change.
5. Run the checks for the IDs you fixed, for example `npx playwright test --project=mocked -g "N3"`. Then run the whole fake-London suite with `npx playwright test --project=mocked` to make sure nothing else broke. Some checks were already failing before you started (see `ux-run-tester/summary.md`); they don't need to pass, but nothing that passed before should fail now.
6. Write `ux-run/fix-notes.md`. Anya reads it; the judge doesn't.
   - First line: a pull request title under 70 characters, in plain words, no ID prefix.
   - Then: for each problem, what was wrong, what you changed and why, the check results before and after, and how `done_when` is now met.
   - Then "Seen but not touched", and anything you weren't sure about.

Don't commit, push or open a pull request. The workflow does that after checking which files you changed.
