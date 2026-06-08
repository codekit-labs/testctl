import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLcov, parseJestCoverageSummary, parseCoverageXml } from '../lib/coverage.mjs';
import { applyCoverageGate } from '../lib/coverage.mjs';

test('parseLcov computes line coverage % across records', () => {
  const lcov = 'SF:a.dart\nLF:10\nLH:8\nend_of_record\nSF:b.dart\nLF:10\nLH:2\nend_of_record\n';
  assert.equal(parseLcov(lcov), 50);
});
test('parseLcov returns null when no lines found', () => {
  assert.equal(parseLcov('SF:a\nLF:0\nLH:0\nend_of_record\n'), null);
  assert.equal(parseLcov(''), null);
});
test('parseJestCoverageSummary reads total.lines.pct (rounded)', () => {
  assert.equal(parseJestCoverageSummary(JSON.stringify({ total: { lines: { pct: 63.7 } } })), 64);
});
test('parseJestCoverageSummary returns null on bad json or missing field', () => {
  assert.equal(parseJestCoverageSummary('not json'), null);
  assert.equal(parseJestCoverageSummary(JSON.stringify({ total: {} })), null);
});
test('parseCoverageXml reads Cobertura line-rate as a percent', () => {
  assert.equal(parseCoverageXml('<?xml version="1.0"?><coverage line-rate="0.83" version="1"></coverage>'), 83);
});
test('parseCoverageXml returns null when absent or unparseable', () => {
  assert.equal(parseCoverageXml('<coverage></coverage>'), null);
  assert.equal(parseCoverageXml('garbage'), null);
});

const mk = (over) => ({ stack: 'flutter', label: 'a', present: true, errored: false, ok: true, coverage: null, note: undefined, ...over });

test('applyCoverageGate fails a present app below the minimum', () => {
  const r = mk({ coverage: 64 });
  applyCoverageGate([r], 70);
  assert.equal(r.ok, false);
  assert.equal(r.note, 'coverage 64% < min 70%');
});
test('applyCoverageGate leaves an app at or above the minimum untouched', () => {
  const eq = mk({ coverage: 70 });
  const above = mk({ coverage: 90 });
  applyCoverageGate([eq, above], 70);
  assert.equal(eq.ok, true);
  assert.equal(eq.note, undefined);
  assert.equal(above.ok, true);
});
test('applyCoverageGate ignores apps with no measured coverage', () => {
  const r = mk({ coverage: null });
  applyCoverageGate([r], 70);
  assert.equal(r.ok, true);
  assert.equal(r.note, undefined);
});
test('applyCoverageGate ignores errored and not-present apps', () => {
  const errored = mk({ coverage: 10, errored: true });
  const absent = mk({ coverage: 10, present: false });
  applyCoverageGate([errored, absent], 70);
  assert.equal(errored.ok, true);
  assert.equal(absent.ok, true);
});
test('applyCoverageGate with null min is a no-op', () => {
  const r = mk({ coverage: 5 });
  applyCoverageGate([r], null);
  assert.equal(r.ok, true);
  assert.equal(r.note, undefined);
});
test('applyCoverageGate returns the same array reference', () => {
  const arr = [mk({ coverage: 5 })];
  assert.equal(applyCoverageGate(arr, 70), arr);
});

import { resolveThreshold } from '../lib/coverage.mjs';

test('resolveThreshold: number applies globally', () => {
  assert.equal(resolveThreshold({ stack: 'flutter', label: 'a' }, 70), 70);
});
test('resolveThreshold: map resolves label > stack > default', () => {
  const m = { flutter: 80, 'apps/pos': 90, default: 50 };
  assert.equal(resolveThreshold({ stack: 'flutter', label: 'apps/pos' }, m), 90);
  assert.equal(resolveThreshold({ stack: 'flutter', label: 'apps/x' }, m), 80);
  assert.equal(resolveThreshold({ stack: 'electron', label: 'd' }, m), 50);
});
test('resolveThreshold: null when no match and no default; null min', () => {
  assert.equal(resolveThreshold({ stack: 'electron', label: 'd' }, { flutter: 80 }), null);
  assert.equal(resolveThreshold({ stack: 'flutter', label: 'a' }, null), null);
});
test('applyCoverageGate with a map fails only apps under their resolved bar', () => {
  const results = [
    { stack: 'flutter', label: 'a', present: true, errored: false, ok: true, coverage: 70 },
    { stack: 'electron', label: 'd', present: true, errored: false, ok: true, coverage: 70 },
  ];
  applyCoverageGate(results, { flutter: 80, default: 50 });
  assert.equal(results[0].ok, false);                 // 70 < 80
  assert.match(results[0].note, /< min 80%/);
  assert.equal(results[1].ok, true);                  // 70 >= 50
});
