import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeResult } from '../lib/result.mjs';
import { historyEntry, summarize, formatHistoryReport } from '../lib/history.mjs';

test('historyEntry builds apps + totals from present results, ignoring absent', () => {
  const results = [
    makeResult({ stack: 'flutter', label: 'apps/pos', passed: 3, failed: 0 }),
    makeResult({ stack: 'electron', label: 'desktop', passed: 1, failed: 1 }),
    makeResult({ stack: 'frappe', present: false }),
  ];
  const e = historyEntry(results, '2026-06-06T10:00:00Z');
  assert.equal(e.ts, '2026-06-06T10:00:00Z');
  assert.equal(e.apps.length, 2);
  assert.equal(e.totals.passed, 4);
  assert.equal(e.totals.failed, 1);
  assert.equal(e.totals.apps, 2);
});

test('summarize computes runs, passRate, and flaky across history lines', () => {
  const lines = [
    JSON.stringify({ ts: 't1', apps: [{ stack: 'flutter', label: 'a', ok: true, passed: 1, failed: 0, skipped: 0 }] }),
    JSON.stringify({ ts: 't2', apps: [{ stack: 'flutter', label: 'a', ok: false, passed: 0, failed: 1, skipped: 0 }] }),
    'not json — should be skipped',
    JSON.stringify({ ts: 't3', apps: [{ stack: 'flutter', label: 'a', ok: true, passed: 1, failed: 0, skipped: 0 }] }),
  ].join('\n');
  const s = summarize(lines);
  assert.equal(s.totalRuns, 3);
  assert.equal(s.lastRun.ts, 't3');
  const a = s.perApp['flutter (a)'];
  assert.equal(a.runs, 3);
  assert.equal(a.passRate, 67);
  assert.equal(a.flaky, true);
});

test('summarize marks a consistently-green app non-flaky', () => {
  const lines = [
    JSON.stringify({ ts: 't1', apps: [{ stack: 'flutter', label: 'b', ok: true, passed: 2, failed: 0, skipped: 0 }] }),
    JSON.stringify({ ts: 't2', apps: [{ stack: 'flutter', label: 'b', ok: true, passed: 2, failed: 0, skipped: 0 }] }),
  ].join('\n');
  const a = summarize(lines).perApp['flutter (b)'];
  assert.equal(a.passRate, 100);
  assert.equal(a.flaky, false);
});

test('formatHistoryReport renders totals, an app row, and flaky flag', () => {
  const s = summarize(JSON.stringify({ ts: 't1', apps: [{ stack: 'flutter', label: 'a', ok: false, passed: 0, failed: 1, skipped: 0 }] }));
  const out = formatHistoryReport(s);
  assert.match(out, /run history/i);
  assert.match(out, /flutter \(a\)/);
  assert.match(out, /Flaky/);
});

test('formatHistoryReport handles empty history', () => {
  const out = formatHistoryReport(summarize(''));
  assert.match(out, /No run history yet/);
});
test('historyEntry records coverage per app', () => {
  const results = [makeResult({ stack: 'flutter', label: 'a', passed: 1, failed: 0, coverage: 80 })];
  const e = historyEntry(results, 't');
  assert.equal(e.apps[0].coverage, 80);
});

test('summarize keeps last coverage and formatHistoryReport shows a Cov column', () => {
  const lines = [
    JSON.stringify({ ts: 't1', apps: [{ stack: 'flutter', label: 'a', ok: true, passed: 1, failed: 0, skipped: 0, coverage: 50 }] }),
    JSON.stringify({ ts: 't2', apps: [{ stack: 'flutter', label: 'a', ok: true, passed: 1, failed: 0, skipped: 0, coverage: 72 }] }),
  ].join('\n');
  const s = summarize(lines);
  assert.equal(s.perApp['flutter (a)'].lastCoverage, 72);
  const out = formatHistoryReport(s);
  assert.match(out, /Cov/);
  assert.match(out, /72%/);
});
