import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeResult } from '../lib/result.mjs';

test('makeResult fills defaults and derives ok', () => {
  const r = makeResult({ stack: 'flutter', passed: 3, failed: 0, durationMs: 100 });
  assert.equal(r.stack, 'flutter');
  assert.equal(r.present, true);
  assert.equal(r.passed, 3);
  assert.equal(r.failed, 0);
  assert.equal(r.skipped, 0);
  assert.equal(r.ok, true);
  assert.equal(r.errored, false);
});

test('makeResult marks ok false when failures exist', () => {
  const r = makeResult({ stack: 'frappe', passed: 1, failed: 2 });
  assert.equal(r.ok, false);
});

test('makeResult supports not-present and errored states', () => {
  const absent = makeResult({ stack: 'electron', present: false });
  assert.equal(absent.present, false);
  assert.equal(absent.ok, true); // absent never fails the build

  const errored = makeResult({ stack: 'frappe', errored: true, error: 'flutter not found' });
  assert.equal(errored.errored, true);
  assert.equal(errored.ok, false);
  assert.equal(errored.error, 'flutter not found');
});

test('makeResult defaults label to the stack name and note to null', () => {
  const r = makeResult({ stack: 'flutter' });
  assert.equal(r.label, 'flutter');
  assert.equal(r.note, null);
});

test('makeResult accepts an explicit label and note', () => {
  const r = makeResult({ stack: 'flutter', label: 'apps/pos', note: 'needs config' });
  assert.equal(r.label, 'apps/pos');
  assert.equal(r.note, 'needs config');
});
