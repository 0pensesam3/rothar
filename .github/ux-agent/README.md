# Daily UX check

Every morning at about 06:00 (London, summer time) three separate Claude sessions check Rothar, fix what they can and wait for you.

| Step | Who | Can change code? | Sees | Does well when |
|---|---|---|---|---|
| 1 | **Tester** runs every check, reads the code for at least one riding expectation, looks at the screenshots, writes the report, picks up to 2 bugs | No | Results, screenshots, `EXPECTATIONS.md`, the code, how its last 10 findings turned out | It finds a real bug tied to an expectation ID, with evidence and a checkable `done_when`. Noise counts against it. |
| 2 | **Fixer** changes `index.html` for those bugs; the workflow opens a PR | `index.html` only | The tester's findings; on a retry, the judge's reasons | Each `done_when` is true and every changed line serves one of the bugs. Nothing else touched. |
| 3a | **Judge, cold read** describes what the diff does | No | The diff, `index.html`, `EXPECTATIONS.md`. Nothing else is on the machine yet. | It says what the code does, not what anyone claimed. |
| 3b | **Judge, verdict** re-runs every check and looks for a reason to reject | No | Its own cold read, the IDs it was meant to fix (IDs only), before and after results and screenshots. Never the tester's or the fixer's writing. | It finds a real, evidenced reason to reject, or finds none after looking hard. |

A judge `FAIL` closes the PR and starts the round again: the tester re-checks and the fixer tries again, both with the judge's reasons. At most 3 attempts a day; after that it stops until tomorrow. `CONCERNS` and `PASS` wait for you.

You approve by merging. Merging an agent PR starts the next check straight away. Nothing merges by itself.

Where to look:
- **Daily UX report** issue: one comment per run, written by the tester.
- **PRs labelled `ux-agent`**: fixes. Each gets a judge comment and a `judge-pass`, `judge-concerns` or `judge-fail` label.
- **Your GitHub notifications**: when a PR passes or gets CONCERNS, or all 3 attempts in a day fail, the workflow tags you in a short comment (what changed, which expectations it was for, what the judge rejected earlier that day) and requests your review. Turn on GitHub mobile push or email for mentions and review requests to get it on your phone.
- **Actions → Daily UX check → a run → Artifacts**: screenshots and full results (`ux-tester`, `ux-judge`).

## One-time setup

1. **Add a Claude credential** in Settings → Secrets and variables → Actions → New repository secret. One of:
   - `CLAUDE_CODE_OAUTH_TOKEN`: uses your Claude subscription. Run `claude setup-token` on your laptop and paste the result.
   - `ANTHROPIC_API_KEY`: a key from platform.claude.com, billed per use.
2. **Let Actions open PRs**: Settings → Actions → General → Workflow permissions → tick "Allow GitHub Actions to create and approve pull requests".
3. **Protect main**: Settings → Branches → add a rule for `main` → "Require a pull request before merging". The agents can't merge anyway; this makes sure nothing else can.
4. **Try it**: Actions → Daily UX check → Run workflow.

## The rules that keep it honest

- `EXPECTATIONS.md` is the definition of "working". Only you edit it. Every finding has to quote a line from it.
- The fixer can only change `index.html`. A workflow step checks this outside the agent and stops the PR if anything else changed, including tests.
- Only one fix PR at a time. While one is open, the tester still reports daily but no new fix is opened.
- The judge reads the diff first, in a session with nothing else on the machine, and writes down what it does before it sees any results. This is enforced by the order of the workflow steps, not by asking nicely.
- The judge never sees the tester's report or findings, the fixer's notes or the PR description. It gets only the IDs it was meant to fix and measures the change against `EXPECTATIONS.md`.
- The judge starts from FAIL. A rejection must point at a diff line, a check result or a screenshot, because each one costs a round.
- The judge runs the checks itself, on a fresh machine, rather than trusting the fixer's results.
- The tester is told how its recent findings turned out (merged, closed, rejected by the judge), so it learns what was worth flagging.

## The checks

`tests/` runs the real app in Chromium at iPhone size, with:
- **Fake London** (`tests/support/world.ts`): nine docks around Bethnal Green and Liverpool Street, a simple router and a small place list. Tests change dock counts mid-ride to act out bikes running out. Results are the same every day.
- **Fake GPS and compass**: the tests move "you" along the planned route a point every 15 m, and turn the compass.
- **One live check** (`tests/live.spec.ts`) against the real TfL, routing and search services, to spot outside changes.
- **A screenshot tour** (`tests/tour.spec.ts`) for the look-and-feel lines the tests can't decide.

Run them on your laptop: `npm install`, `npx playwright install chromium`, then `npm test` (fake London) or `npm run test:all`.

## Weekly free roam

Every Saturday morning a separate workflow (`weekly-roam.yml`) gives one Claude session the fake London harness and lets it use the app however it likes: odd tap sequences, strange searches, docks emptying at awkward moments. It writes its own small scripts in `ux-run/roam/`, runs them, looks at the screenshots and posts what it found to the **Weekly free-roam report** issue.

It's report only. It can't change code, it doesn't open PRs and nothing it finds goes to the fixer. You decide which findings deserve a line in `EXPECTATIONS.md`; once they're there, the daily check tests them. To run it now: Actions → Weekly free roam → Run workflow.

## What it can't tell you

Fake GPS is clean; real GPS jitters and drops out. The fake router makes simple L-shaped routes; real ones have many short steps. Nobody here has ridden the route. A `judge-pass` means "worth a real ride", not "safe without one", especially for anything touching navigation or the camera.

## Cost

One Claude session on days without a fix, four on days with one (tester, fixer, two judge steps), and up to four more per retry after a judge FAIL, with at most 3 attempts a day. On Saturdays there's also one longer session for the free roam. Rough guide: well under £1 on a quiet day, a few pounds on a day with a fix if you use an API key. With a subscription token it counts against your plan's usage instead. To pause it, disable the workflow in Actions.
