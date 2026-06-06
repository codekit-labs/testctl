import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseJestJson } from '../../lib/runners/electron.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const json = readFileSync(join(here, '../fixtures/jest-output.json'), 'utf8');

test('parseJestJson maps jest counts to the uniform shape', () => {
  const r = parseJestJson(json);
  assert.equal(r.passed, 15);
  assert.equal(r.failed, 2);
  assert.equal(r.skipped, 1);
});

test('parseJestJson extracts the JSON object even with leading log noise', () => {
  const noisy = 'PASS some/test\nconsole.log noise\n' + json;
  const r = parseJestJson(noisy);
  assert.equal(r.passed, 15);
});
