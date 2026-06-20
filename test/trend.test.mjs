import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeTrend, formatTrend } from '../lib/trend.mjs';

// Helper: build one history line. `apps` is an array of {stack,label,ok,coverage,errored}.
function line(apps) {
  const full = apps.map((a) => ({
    stack: a.stack,
    label: a.label,
    passed: a.passed ?? (a.ok ? 1 : 0),
    failed: a.failed ?? (a.ok ? 0 : 1),
    skipped: 0,
    ok: a.ok,
    errored: a.errored ?? false,
    coverage: a.coverage ?? null,
  }));
  return JSON.stringify({ ts: a => a, apps: full, totals: {} });
}
// build a JSONL document from arrays of app-state arrays
function jsonl(...runs) {
  return runs.map((apps) => line(apps)).join('\n') + '\n';
}

test('empty history → empty flag, empty apps, message renders', () => {
  const t = computeTrend('', {});
  assert.equal(t.totalRuns, 0);
  assert.deepEqual(t.apps, {});
  assert.deepEqual(t.regressedKeys, []);
  assert.deepEqual(t.improvedKeys, []);
  assert.equal(formatTrend(t), 'No run history yet — run `testctl run` first.');
});

test('malformed / blank lines are skipped, valid runs counted', () => {
  const text =
    '\n' +
    'not json at all\n' +
    line([{ stack: 'flutter', label: 'app', ok: true, coverage: 80 }]) + '\n' +
    '   \n' +
    '{ broken json\n' +
    line([{ stack: 'flutter', label: 'app', ok: true, coverage: 82 }]) + '\n';
  const t = computeTrend(text, {});
  assert.equal(t.totalRuns, 2);
  assert.ok(t.apps['flutter (app)']);
  assert.equal(t.apps['flutter (app)'].runs, 2);
});

test('series + sparkline use ✓ ✗ · for pass/fail/errored', () => {
  const t = computeTrend(
    jsonl(
      [{ stack: 'web', label: 'ui', ok: true, coverage: 50 }],
      [{ stack: 'web', label: 'ui', ok: false, coverage: 50 }],
      [{ stack: 'web', label: 'ui', ok: false, errored: true, coverage: null }],
    ),
    {},
  );
  const a = t.apps['web (ui)'];
  assert.equal(a.runs, 3);
  assert.deepEqual(
    a.series.map((s) => s.ok),
    [true, false, false],
  );
  assert.equal(a.sparkline, '✓✗·');
});

test('pass direction: second half vs first half of the window', () => {
  // 4 runs: first half fail,fail (0%), second half pass,pass (100%) → up
  const up = computeTrend(
    jsonl(
      [{ stack: 'web', label: 'ui', ok: false }],
      [{ stack: 'web', label: 'ui', ok: false }],
      [{ stack: 'web', label: 'ui', ok: true }],
      [{ stack: 'web', label: 'ui', ok: true }],
    ),
    {},
  ).apps['web (ui)'];
  assert.equal(up.passRatePrev, 0);
  assert.equal(up.passRateNow, 100);
  assert.equal(up.passDir, 'up');

  // reverse → down
  const down = computeTrend(
    jsonl(
      [{ stack: 'web', label: 'ui', ok: true }],
      [{ stack: 'web', label: 'ui', ok: true }],
      [{ stack: 'web', label: 'ui', ok: false }],
      [{ stack: 'web', label: 'ui', ok: false }],
    ),
    {},
  ).apps['web (ui)'];
  assert.equal(down.passDir, 'down');

  // steady → flat
  const flat = computeTrend(
    jsonl(
      [{ stack: 'web', label: 'ui', ok: true }],
      [{ stack: 'web', label: 'ui', ok: true }],
      [{ stack: 'web', label: 'ui', ok: true }],
      [{ stack: 'web', label: 'ui', ok: true }],
    ),
    {},
  ).apps['web (ui)'];
  assert.equal(flat.passDir, 'flat');
});

test('coverage direction: first vs last non-null in the window', () => {
  const t = computeTrend(
    jsonl(
      [{ stack: 'frappe', label: 'erp', ok: true, coverage: 60 }],
      [{ stack: 'frappe', label: 'erp', ok: true, coverage: null }],
      [{ stack: 'frappe', label: 'erp', ok: true, coverage: 72 }],
    ),
    {},
  ).apps['frappe (erp)'];
  assert.equal(t.coverageFirst, 60);
  assert.equal(t.coverageNow, 72);
  assert.equal(t.coverageDelta, 12);
  assert.equal(t.coverageDir, 'up');
});

test('coverage all-null → no coverage, flat', () => {
  const t = computeTrend(
    jsonl(
      [{ stack: 'nextjs', label: 'site', ok: true, coverage: null }],
      [{ stack: 'nextjs', label: 'site', ok: true, coverage: null }],
    ),
    {},
  ).apps['nextjs (site)'];
  assert.equal(t.coverageFirst, null);
  assert.equal(t.coverageNow, null);
  assert.equal(t.coverageDelta, null);
  assert.equal(t.coverageDir, 'flat');
});

test('regressed: green earlier in window, latest run not ok', () => {
  const t = computeTrend(
    jsonl(
      [{ stack: 'web', label: 'ui', ok: true }],
      [{ stack: 'web', label: 'ui', ok: true }],
      [{ stack: 'web', label: 'ui', ok: false }],
    ),
    {},
  );
  assert.equal(t.apps['web (ui)'].regressed, true);
  assert.deepEqual(t.regressedKeys, ['web (ui)']);
  assert.deepEqual(t.improvedKeys, []);
});

test('improved: red earlier in window, latest run ok', () => {
  const t = computeTrend(
    jsonl(
      [{ stack: 'web', label: 'ui', ok: false }],
      [{ stack: 'web', label: 'ui', ok: false }],
      [{ stack: 'web', label: 'ui', ok: true }],
    ),
    {},
  );
  assert.equal(t.apps['web (ui)'].regressed, false);
  assert.deepEqual(t.improvedKeys, ['web (ui)']);
  assert.deepEqual(t.regressedKeys, []);
});

test('windowing: only the last N runs are considered', () => {
  // 5 runs, window 3: first two are fail and must be ignored, so no regression
  const runs = [
    [{ stack: 'web', label: 'ui', ok: true }],
    [{ stack: 'web', label: 'ui', ok: false }],
    [{ stack: 'web', label: 'ui', ok: true }],
    [{ stack: 'web', label: 'ui', ok: true }],
    [{ stack: 'web', label: 'ui', ok: true }],
  ];
  const t = computeTrend(jsonl(...runs), { window: 3 });
  assert.equal(t.window, 3);
  assert.equal(t.apps['web (ui)'].runs, 3); // last 3 only
  assert.equal(t.apps['web (ui)'].sparkline, '✓✓✓');
  assert.equal(t.apps['web (ui)'].regressed, false);
});

test('app present in only some runs: series counts only present runs', () => {
  const t = computeTrend(
    jsonl(
      [{ stack: 'web', label: 'ui', ok: true }],
      [{ stack: 'flutter', label: 'mob', ok: true }],
      [
        { stack: 'web', label: 'ui', ok: false },
        { stack: 'flutter', label: 'mob', ok: true },
      ],
    ),
    {},
  );
  assert.equal(t.apps['web (ui)'].runs, 2);
  assert.equal(t.apps['flutter (mob)'].runs, 2);
  assert.equal(t.apps['web (ui)'].regressed, true);
});

test('formatTrend: regressed app surfaced in footer, improving tagged', () => {
  const t = computeTrend(
    jsonl(
      [
        { stack: 'web', label: 'ui', ok: true, coverage: 70 },
        { stack: 'frappe', label: 'erp', ok: false, coverage: 40 },
      ],
      [
        { stack: 'web', label: 'ui', ok: false, coverage: 65 },
        { stack: 'frappe', label: 'erp', ok: true, coverage: 55 },
      ],
    ),
    {},
  );
  const out = formatTrend(t);
  assert.match(out, /testctl trend/);
  assert.match(out, /REGRESSED/);
  assert.match(out, /improved/);
  assert.match(out, /web \(ui\)/);
  // footer calls out the regressed app first
  assert.match(out, /newly failing/);
  assert.match(out, /web \(ui\)/);
});
