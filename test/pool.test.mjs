import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapPool } from '../lib/pool.mjs';

test('mapPool preserves input order', async () => {
  const r = await mapPool([1, 2, 3, 4], 2, async (x) => x * 10);
  assert.deepEqual(r, [10, 20, 30, 40]);
});

test('mapPool never exceeds the concurrency limit', async () => {
  let running = 0;
  let maxRunning = 0;
  const fn = async () => {
    running += 1;
    maxRunning = Math.max(maxRunning, running);
    await new Promise((res) => setTimeout(res, 5));
    running -= 1;
    return null;
  };
  await mapPool([1, 2, 3, 4, 5, 6], 2, fn);
  assert.ok(maxRunning <= 2, `maxRunning ${maxRunning} should be <= 2`);
});

test('mapPool clamps a limit below 1 up to 1', async () => {
  const r = await mapPool([1, 2], 0, async (x) => x);
  assert.deepEqual(r, [1, 2]);
});
