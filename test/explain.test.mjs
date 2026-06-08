import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeResult } from '../lib/result.mjs';
import { normalizeSig, groupFailures, formatExplain } from '../lib/explain.mjs';

test('normalizeSig: first line, digits→#, empty→(no message)', () => {
  assert.equal(normalizeSig('Expected 2 but got 3\nat foo'), 'Expected # but got #');
  assert.equal(normalizeSig(''), '(no message)');
});
test('groupFailures clusters numeric variants across apps', () => {
  const results = [
    makeResult({ stack: 'flutter', label: 'a', failed: 1, failures: [{ test: 't1', message: 'expected 2 got 3' }] }),
    makeResult({ stack: 'electron', label: 'b', failed: 1, failures: [{ test: 't2', message: 'expected 5 got 4' }] }),
  ];
  const g = groupFailures(results);
  assert.equal(g.length, 1);
  assert.equal(g[0].count, 2);
  assert.deepEqual(g[0].apps.sort(), ['electron (b)', 'flutter (a)']);
});
test('formatExplain summarizes groups; empty → celebratory', () => {
  assert.match(formatExplain([]), /No failures/);
  const out = formatExplain(groupFailures([
    makeResult({ stack: 'flutter', label: 'a', failed: 2, failures: [
      { test: 't1', message: 'boom 1' }, { test: 't2', message: 'boom 2' },
    ] }),
  ]));
  assert.match(out, /2 failures across 1 app → 1 group/);
  assert.match(out, /×2  boom #/);
});
