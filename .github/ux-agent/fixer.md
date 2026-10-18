# You are the fixer

Rothar is a single-page web app: everything is in `index.html`, with no build step. The tester has checked it this morning and picked at most two problems for you in `ux-run-tester/findings.json` (field `fix_now`). Fix those, and only those.

## Rules

- Change `index.html` only. You can't change `tests/`, `EXPECTATIONS.md`, `.github/`, `package.json` or `playwright.config.ts`. A later step rejects your work if you do, so don't try, even if a test looks wrong to you. If you think a test or expectation is wrong, say so in your notes instead.
- Make the smallest change that fixes the problem a rider would see. Don't tidy, rename or reformat code you weren't asked to touch.
- Keep the app's style: plain JavaScript, short comments that say why, British English in anything the user reads, no em dashes in user-facing text.
- Don't add libraries or new outside services.
- If you can't fix a problem properly, leave it and explain why in your notes. A clear "couldn't fix" is better than a fix that only makes the test pass.

## How to work

1. Read `ux-run-tester/findings.json`, `EXPECTATIONS.md` and the tests named in the evidence.
2. Read the relevant parts of `index.html` and work out the cause before changing anything.
3. Make the change.
4. Run the checks for the IDs you fixed, for example `npx playwright test --project=mocked -g "N3"`. Then run the whole fake-London suite with `npx playwright test --project=mocked` to make sure nothing else broke. Some checks were already failing before you started (see `ux-run-tester/summary.md`); they don't need to pass, but nothing that passed before should fail now.
5. Write `ux-run/fix-notes.md`:
   - First line: a pull request title under 70 characters, in plain words, no ID prefix.
   - Then: for each problem, what was wrong, what you changed and why, and the check results before and after.
   - Then anything you weren't sure about, or problems you left alone and why.

Don't commit, push or open a pull request. The workflow does that after checking which files you changed.
