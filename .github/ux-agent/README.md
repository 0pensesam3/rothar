# Daily UX check

Every morning at about 06:00 (London, summer time) three separate Claude sessions check Rothar, fix what they can and wait for you.

| Step | Who | Can change code? | Sees |
|---|---|---|---|
| 1 | **Tester** runs every check, looks at the screenshots, writes the report, picks up to 2 bugs | No | Results, screenshots, `EXPECTATIONS.md`, the code |
| 2 | **Fixer** changes `index.html` for those bugs; the workflow opens a PR | `index.html` only | The tester's findings |
| 3 | **Judge** re-runs every check on the fix branch and posts a verdict on the PR | No | Before and after results, screenshots, the diff. Not the fixer's notes. |

You approve by merging. Merging an agent PR starts the next check straight away. Nothing merges by itself.

Where to look:
- **Daily UX report** issue: one comment per run, written by the tester.
- **PRs labelled `ux-agent`**: fixes. Each gets a judge comment and a `judge-pass`, `judge-concerns` or `judge-fail` label.
- **Actions → Daily UX check → a run → Artifacts**: screenshots and full results (`ux-tester`, `ux-judge`).

## One-time setup

1. **Add a Claude credential** in Settings → Secrets and variables → Actions → New repository secret. One of:
   - `CLAUDE_CODE_OAUTH_TOKEN`: uses your Claude subscription. Run `claude setup-token` on your laptop and paste the result.
   - `ANTHROPIC_API_KEY`: a key from platform.claude.com, billed per use.
2. **Let Actions open PRs**: Settings → Actions → General → Workflow permissions → tick "Allow GitHub Actions to create and approve pull requests".
3. **Protect main**: Settings → Branches → add a rule for `main` → "Require a pull request before merging". The agents can't merge anyway; this makes sure nothing else can.
4. **Try it**: Actions → Daily UX check → Run workflow.

## The rules that keep it honest

- `EXPECTATIONS.md` is the definition of "working". Only you edit it.
- The fixer can only change `index.html`. A workflow step checks this outside the agent and stops the PR if anything else changed, including tests.
- Only one fix PR at a time. While one is open, the tester still reports daily but no new fix is opened.
- The judge runs the checks itself, on a fresh machine, rather than trusting the fixer's results.

## The checks

`tests/` runs the real app in Chromium at iPhone size, with:
- **Fake London** (`tests/support/world.ts`): nine docks around Bethnal Green and Liverpool Street, a simple router and a small place list. Tests change dock counts mid-ride to act out bikes running out. Results are the same every day.
- **Fake GPS and compass**: the tests move "you" along the planned route a point every 15 m, and turn the compass.
- **One live check** (`tests/live.spec.ts`) against the real TfL, routing and search services, to spot outside changes.
- **A screenshot tour** (`tests/tour.spec.ts`) for the look-and-feel lines the tests can't decide.

Run them on your laptop: `npm install`, `npx playwright install chromium`, then `npm test` (fake London) or `npm run test:all`.

## What it can't tell you

Fake GPS is clean; real GPS jitters and drops out. The fake router makes simple L-shaped routes; real ones have many short steps. Nobody here has ridden the route. A `judge-pass` means "worth a real ride", not "safe without one", especially for anything touching navigation or the camera.

## Cost

Three Claude sessions on days with a fix, one on days without. Rough guide: well under £1 on a quiet day, a few pounds on a day with a fix if you use an API key. With a subscription token it counts against your plan's usage instead. To pause it, disable the workflow in Actions.
