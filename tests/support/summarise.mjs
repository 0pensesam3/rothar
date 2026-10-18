// Turns Playwright's results.json into a short Markdown table the agents can read,
// keyed by the expectation IDs in EXPECTATIONS.md.
// Usage: node tests/support/summarise.mjs ux-run/results.json > ux-run/summary.md
// Also prints `failing=<ids>` to $GITHUB_OUTPUT when run in Actions.
import fs from 'node:fs';

const file = process.argv[2] || 'ux-run/results.json';
if (!fs.existsSync(file)) { console.log('No results file: the test run did not finish.'); process.exit(0); }
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const strip = s => String(s || '').replace(/\u001b\[[0-9;]*m/g, '');

const rows = [];
const walk = (suite, trail = []) => {
  for (const spec of suite.specs || []) for (const t of spec.tests || []) {
    const r = t.results?.[t.results.length - 1] || {};
    const errs = (r.errors || []).map(e => strip(e.message).split('\n').filter(l => l.trim() && !/^\s*>?\s*\d*\s*\|/.test(l)).slice(0, 4).join(' / '));
    rows.push({ id: spec.title.split(' ')[0], title: spec.title, project: t.projectName, status: r.status || t.status,
                secs: Math.round((r.duration || 0) / 1000), errors: errs, file: spec.file });
  }
  for (const s of suite.suites || []) walk(s, [...trail, s.title]);
};
(data.suites || []).forEach(s => walk(s));

const bad = rows.filter(r => r.status !== 'passed' && r.status !== 'skipped');
const mockedBad = bad.filter(r => r.project === 'mocked');
const liveBad = bad.filter(r => r.project === 'live');
const esc = s => String(s).replace(/\|/g, '\\|');

let out = `# Test results\n\n`;
out += `${rows.length} checks: ${rows.length - bad.length} passed, ${mockedBad.length} failed against fake London, ${liveBad.length} failed against live data.\n\n`;
if (bad.length) {
  out += `## Failing\n\n| ID | Run | Check | What went wrong |\n|---|---|---|---|\n`;
  for (const r of bad) out += `| ${r.id} | ${r.project} | ${esc(r.title)} | ${esc(r.errors.join(' • ') || r.status)} |\n`;
  out += '\n';
}
out += `## All checks\n\n| ID | Run | Result | Time |\n|---|---|---|---|\n`;
for (const r of rows) out += `| ${r.id} | ${r.project} | ${r.status === 'passed' ? 'pass' : r.status} | ${r.secs}s |\n`;
console.log(out);

if (process.env.GITHUB_OUTPUT) {
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `failing=${[...new Set(mockedBad.map(r => r.id))].join(',')}\n`);
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `live_failing=${[...new Set(liveBad.map(r => r.id))].join(',')}\n`);
}
