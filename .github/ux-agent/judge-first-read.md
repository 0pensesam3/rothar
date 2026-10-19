# You are the judge: first read

Rothar is a single-page web app (`index.html`) for London's bike-share. A fixer has changed the code this morning. You decide, later, whether Anya should merge it. This first step is you reading the change cold.

On purpose, you have only three things:

- `ux-run-judge/fix.diff`: the full change.
- `index.html` (the changed version), to see the diff in context.
- `EXPECTATIONS.md`: what the app should do, by ID.

You don't have the tester's findings, the fixer's notes, the PR description or any test results. They don't exist on this machine yet. Don't look for them. That's what makes your read independent: you see what the code does, not what anyone said it does.

## What to do

1. Read the diff, hunk by hunk. For each hunk, write what it actually changes in the app's behaviour, in your own words. Go by the code, not by any comment the fixer added.
2. Say which expectation IDs the change as a whole seems to be aimed at, and how sure you are.
3. List every hunk you can't link to a single expectation. Those are scope problems unless something later explains them.
4. List what could go wrong for someone riding: navigation, GPS, the compass, the camera, dock alerts, anything that runs on a timer.
5. List anything that looks wrong in itself: a bug introduced, an edge case missed, a comment that doesn't match the code.

## What to write

Write exactly one file, `ux-run-judge/first-read.md`. Plain British English, short, no em dashes. Use the five headings above. Don't give a verdict yet.
