import { test } from 'node:test';
import assert from 'node:assert/strict';
import { actionFor, formatContext } from '../lib/context.mjs';

test('actionFor picks the right action per state', () => {
  assert.equal(actionFor({ hasTests: false }), 'generate');
  assert.equal(actionFor({ hasTests: true, status: 'red' }), 'fix');
  assert.equal(actionFor({ hasTests: true, status: 'green', belowGate: true }), 'boost');
  assert.equal(actionFor({ hasTests: true, status: 'green', untestedCount: 3 }), 'harden');
  assert.equal(actionFor({ hasTests: true, status: 'green', untestedCount: 0 }), 'ok');
});

test('formatContext renders an action-tagged row per app', () => {
  const out = formatContext([
    { stack: 'flutter', label: 'a', hasTests: true, status: 'green', tests: 5, coverage: 80, untestedCount: 2 },
    { stack: 'electron', label: 'd', hasTests: false, untestedCount: 4 },
  ]);
  assert.match(out, /\[harden\] flutter \(a\)/);
  assert.match(out, /\[generate\] electron \(d\)/);
  assert.match(out, /untested:2/);
});
