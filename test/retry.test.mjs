import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shouldRetry } from '../lib/retry.mjs';

test('shouldRetry: ok never retries', () => {
  assert.equal(shouldRetry(true, 0, 3), false);
});
test('shouldRetry: not ok retries while retries remain', () => {
  assert.equal(shouldRetry(false, 0, 2), true);
  assert.equal(shouldRetry(false, 1, 2), true);
  assert.equal(shouldRetry(false, 2, 2), false);
});
test('shouldRetry: maxRetries 0 never retries', () => {
  assert.equal(shouldRetry(false, 0, 0), false);
});
