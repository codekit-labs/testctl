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
