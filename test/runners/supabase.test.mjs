import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseTap } from '../../lib/runners/supabase.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const tap = readFileSync(join(here, '../fixtures/supabase-tap.txt'), 'utf8');

test('parseTap counts ok / not ok / skip', () => {
  const r = parseTap(tap);
  // ok 1,2,5 = 3 passed; not ok 3 = 1 failed; ok 4 # SKIP = 1 skipped
  assert.equal(r.passed, 3);
  assert.equal(r.failed, 1);
  assert.equal(r.skipped, 1);
});

test('parseTap ignores non-result lines (plan, comments)', () => {
  const r = parseTap('1..1\n# a comment\nok 1 - solo\n');
  assert.equal(r.passed, 1);
  assert.equal(r.failed, 0);
  assert.equal(r.skipped, 0);
});

test('parseTap treats SKIP and TODO directives as skipped, not failed', () => {
  const r = parseTap('1..3\nnot ok 1 - pending # SKIP wip\nnot ok 2 - known bug # TODO fix later\nok 3 - real\n');
  assert.equal(r.passed, 1);
  assert.equal(r.failed, 0);
  assert.equal(r.skipped, 2);
});

test('parseTap extracts not-ok failures with description', () => {
  const tap = 'ok 1 - first\nnot ok 2 - second thing\n# expected 5 got 4\nok 3 - third\n';
  const r = parseTap(tap);
  assert.equal(r.failed, 1);
  assert.equal(r.failures.length, 1);
  assert.equal(r.failures[0].test, 'second thing');
  assert.match(r.failures[0].message, /expected 5 got 4/);
});
