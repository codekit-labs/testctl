import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { lastRunRecord, formatDigest, saveLastRun, loadLastRun } from '../lib/lastrun.mjs';

const R = (over) => ({ stack: 'web', label: 'react', passed: 1, failed: 0, skipped: 0, ok: true, errored: false, error: null, failures: [], ...over });

test('lastRunRecord: keeps digest fields incl. failures, with timestamp', () => {
  const rec = lastRunRecord([R({ failed: 1, ok: false, failures: [{ test: 'a.b', file: 'a.js', line: null, message: 'boom' }] })], 123);
  assert.equal(rec.timestamp, 123);
  assert.equal(rec.results[0].failures[0].test, 'a.b');
  assert.equal(rec.results[0].stack, 'web');
});

test('formatDigest: all-green footer when nothing failed', () => {
  const out = formatDigest(lastRunRecord([R({})], 1));
  assert.match(out, /green/i);
  assert.doesNotMatch(out, /✗ /);
});

test('formatDigest: shows failing test + message', () => {
  const out = formatDigest(lastRunRecord([R({ failed: 1, ok: false, failures: [{ test: 'TestJob.test_bad', file: 'x', line: null, message: 'AssertionError: 1 != 2' }] })], 1));
  assert.match(out, /TestJob\.test_bad/);
  assert.match(out, /AssertionError: 1 != 2/);
});

test('saveLastRun/loadLastRun: round-trip; missing → null', () => {
  const proj = mkdtempSync(join(tmpdir(), 'testctl-lastrun-'));
  assert.equal(loadLastRun(proj), null);
  saveLastRun(proj, [R({ failed: 1, ok: false, failures: [{ test: 't', file: null, line: null, message: 'm' }] })], 42);
  const back = loadLastRun(proj);
  assert.equal(back.timestamp, 42);
  assert.equal(back.results[0].failures[0].test, 't');
});
