import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnAsync } from '../lib/spawn.mjs';

test('spawnAsync captures stdout and a zero status', async () => {
  const r = await spawnAsync('node', ['-e', "process.stdout.write('hi')"]);
  assert.equal(r.status, 0);
  assert.equal(r.stdout, 'hi');
  assert.equal(r.error, null);
});

test('spawnAsync reports a non-zero status', async () => {
  const r = await spawnAsync('node', ['-e', 'process.exit(3)']);
  assert.equal(r.status, 3);
  assert.equal(r.error, null);
});

test('spawnAsync resolves with an error for a missing command (no throw)', async () => {
  const r = await spawnAsync('definitely-not-a-real-command-xyz', []);
  assert.ok(r.error);
  assert.equal(r.status, null);
});
