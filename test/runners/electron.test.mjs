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

test('parseJestJson extracts failures with test name, file, message', () => {
  const json = JSON.stringify({
    numPassedTests: 1, numFailedTests: 1, numPendingTests: 0,
    testResults: [{
      name: '/proj/src/math.test.js',
      assertionResults: [
        { fullName: 'math adds', status: 'passed', failureMessages: [] },
        { fullName: 'math subtracts', status: 'failed', failureMessages: ['Error: expected 2 received 3\n    at Object.<anonymous>'] },
      ],
    }],
  });
  const r = parseJestJson(json);
  assert.equal(r.failed, 1);
  assert.equal(r.failures.length, 1);
  assert.equal(r.failures[0].test, 'math subtracts');
  assert.equal(r.failures[0].file, 'math.test.js');
  assert.match(r.failures[0].message, /expected 2 received 3/);
});
