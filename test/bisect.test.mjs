import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFirstBadCommit, buildBisectCriterion, formatBisectResult } from '../lib/bisect.mjs';

test('parseFirstBadCommit: extracts the sha from the canonical line', () => {
  const out = [
    'Bisecting: 3 revisions left to test after this (roughly 2 steps)',
    'running node "/x/cli.mjs" run --quiet',
    'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678 is the first bad commit',
    'commit a1b2c3d4e5f60718293a4b5c6d7e8f9012345678',
  ].join('\n');
  assert.equal(
    parseFirstBadCommit(out),
    'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678',
  );
});

test('parseFirstBadCommit: null when the line is absent', () => {
  assert.equal(parseFirstBadCommit('Bisecting: 1 revision left\nno verdict here'), null);
  assert.equal(parseFirstBadCommit(''), null);
  assert.equal(parseFirstBadCommit(null), null);
});

test('parseFirstBadCommit: tolerates a short (7-char) sha', () => {
  assert.equal(parseFirstBadCommit('a1b2c3d is the first bad commit'), 'a1b2c3d');
});

test('buildBisectCriterion: no --test → plain quiet run, no target', () => {
  const cmd = buildBisectCriterion({ cliPath: '/x/cli.mjs', target: null, test: null });
  assert.equal(cmd, 'node "/x/cli.mjs" run --quiet');
});

test('buildBisectCriterion: positional target is passed through', () => {
  const cmd = buildBisectCriterion({ cliPath: '/x/cli.mjs', target: 'frappe', test: null });
  assert.equal(cmd, 'node "/x/cli.mjs" run frappe --quiet');
});

test('buildBisectCriterion: --test builds a TESTCTL_JSON-parsing node -e wrapper', () => {
  const cmd = buildBisectCriterion({ cliPath: '/x/cli.mjs', target: 'frappe', test: 'test_vat' });
  assert.match(cmd, /^node -e /);
  // the wrapper re-invokes the engine with the target and --quiet
  assert.match(cmd, /run/);
  assert.match(cmd, /frappe/);
  assert.match(cmd, /--quiet/);
  // it routes the verdict through the machine-readable line, not the exit code
  assert.match(cmd, /TESTCTL_JSON/);
  // the substring is embedded (json-escaped) so the wrapper can scan failures for it
  assert.match(cmd, /test_vat/);
  // escapes the engine path
  assert.match(cmd, /\/x\/cli\.mjs/);
});

test('buildBisectCriterion: --test with no target omits the positional', () => {
  const cmd = buildBisectCriterion({ cliPath: '/x/cli.mjs', target: null, test: 'test_vat' });
  assert.match(cmd, /run --quiet/);
  assert.doesNotMatch(cmd, /run null/);
});

test('formatBisectResult: shows sha, subject, criterion and both skill pointers', () => {
  const out = formatBisectResult({
    firstBad: 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678',
    subject: 'refactor invoice totals',
    criterionLabel: 'the suite went red',
  });
  assert.match(out, /a1b2c3d4e5f60718293a4b5c6d7e8f9012345678/);
  assert.match(out, /refactor invoice totals/);
  assert.match(out, /the suite went red/);
  assert.match(out, /regression-from-bug/);
  assert.match(out, /fix-failures/);
});
