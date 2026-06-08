import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFlutterJson } from '../../lib/runners/flutter.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const lines = readFileSync(join(here, '../fixtures/flutter-events.jsonl'), 'utf8');

test('parseFlutterJson ignores hidden tests and counts the rest', () => {
  const r = parseFlutterJson(lines);
  // visible: id2 success, id3 failure, id4 skipped
  assert.equal(r.passed, 1);
  assert.equal(r.failed, 1);
  assert.equal(r.skipped, 1);
});

test('parseFlutterJson tolerates blank lines and non-JSON noise', () => {
  const noisy = 'Running tests...\n' + lines + '\n\n';
  const r = parseFlutterJson(noisy);
  assert.equal(r.passed, 1);
  assert.equal(r.failed, 1);
});

test('parseFlutterJson extracts failures with name and message', () => {
  const lines = [
    JSON.stringify({ type: 'testStart', test: { id: 1, name: 'adds' } }),
    JSON.stringify({ type: 'testStart', test: { id: 2, name: 'subtracts' } }),
    JSON.stringify({ type: 'error', testID: 2, error: 'Expected 2 but got 3', stackTrace: 'test/math_test.dart 12:7  main' }),
    JSON.stringify({ type: 'testDone', testID: 1, result: 'success', hidden: false }),
    JSON.stringify({ type: 'testDone', testID: 2, result: 'error', hidden: false }),
  ].join('\n');
  const r = parseFlutterJson(lines);
  assert.equal(r.failed, 1);
  assert.equal(r.failures.length, 1);
  assert.equal(r.failures[0].test, 'subtracts');
  assert.match(r.failures[0].message, /Expected 2 but got 3/);
  assert.equal(r.failures[0].file, 'test/math_test.dart');
  assert.equal(r.failures[0].line, 12);
});
