# Daily UX check

Every morning at about 06:00 (London, summer time) three separate Claude sessions check Rothar, fix what they can and wait for you.

| Step | Who | Can change code? | Sees | Does well when |
|---|---|---|---|---|
| 1 | **Tester** runs every check, reads the code for at least one riding expectation, looks at the screenshots, writes the report, ranks up to 3 bugs | No | Results, screenshots, `EXPECTATIONS.md`, the code, how its last 10 findings turned out | It finds a real bug tied to an expectation ID, with evidence and a checkable `done_when`. Noise counts against it. |
| 2 | **Fixer** changes `index.html` for **one** bug; the workflow opens a draft PR for it alone | `index.html` only | That bug; on a revision, its own last diff and the judge's reasons | The bug's `done_when` is true and every changed line serves it. Nothing else touched. |
| 3a | **Judge, cold read** describes what the diff does | No | The diff, `index.html`, `EXPECTATIONS.md`. Nothing else is on the machine yet. | It says what the code does, not what anyone claimed. |
| 3b | **Judge, verdict** re-runs every check and looks for a reason to reject | No | Its own cold read, the ID it was meant to fix (ID only), before and after results and screenshots. Never the tester's or the fixer's writing. | It finds a real, evidenced reason to reject, or finds none after looking hard. |

After the judge:
- **PASS or CONCERNS**: the draft becomes a normal PR, you're tagged and asked to review. That's the only time you hear about a fix.
- **FAIL**: the fixer revises the *same* PR with the judge's reasons, keeping what worked. Up to 3 attempts per bug.
- **Still failing after 3, but safe**: you get it anyway, labelled `judge-best-effort`, with what the judge still objects to. The judge writes `SAFE: yes` when merging would leave the app no worse than now, even if the fix is incomplete. It isn't told which attempt it's judging, so the last one gets the same scrutiny as the first.
- **Still failing after 3, and not safe**: the PR is closed and labelled `ux-parked`, and the fixer starts on the tester's next pick. If every pick ends like this, you get one message saying what was tried and why.

So every bug the tester picks ends with a PR for you within 3 attempts, unless the best the fixer managed would make the app worse.

The tester runs once per check; later attempts reuse its findings rather than re-checking.

You approve by merging. Merging an agent PR starts the next check straight away. Nothing merges by itself.

Where to look:
- **Daily UX report** issue: one comment per run, written by the tester.
- **PRs labelled `ux-agent`**: fixes, one bug each. Drafts are still being worked on; ignore them. Each attempt gets a judge comment, and the PR carries the latest `judge-pass`, `judge-concerns` or `judge-fail` label, plus `judge-best-effort` when it reached you on the last attempt without passing.
- **Your GitHub notifications**: you're tagged when a fix passes, gets CONCERNS or is a safe best attempt (what changed, which expectation it was for, what the judge rejected on the way), when nothing passed today, and when a run breaks. Turn on GitHub mobile push for mentions and review requests to get these on your phone.
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
- The judge never sees the tester's report or findings, the fixer's notes, the PR description or its own earlier verdicts. It gets only the ID it was meant to fix and measures the whole change against `EXPECTATIONS.md`.
- The judge starts from FAIL, but only fails a fix for four reasons: not fixed in the code, a regression, out of scope, or a new problem a rider would hit. Each must point at a diff line, a check result or a screenshot. Smaller things are notes, so good fixes reach you.
- The judge runs the checks itself, on a fresh machine, rather than trusting the fixer's results.
- One bug per PR, so a bad fix for one bug never throws away a good fix for another.
- The tester is told how its recent findings turned out (merged, closed, parked), so it learns what was worth flagging.

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

One Claude session on days without a fix. Each fix attempt is three more (fixer and two judge steps). Worst case is three bugs times three attempts, nine attempts in a day; a typical day with a fix is one or two. On Saturdays there's also one longer session for the free roam. Rough guide: well under £1 on a quiet day, a few pounds on a day with a fix if you use an API key. With a subscription token it counts against your plan's usage instead. To pause it, disable the workflow in Actions.
