import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isWatchableChange } from '../lib/watch.mjs';

test('isWatchableChange: source files trigger, noise dirs do not', () => {
  assert.equal(isWatchableChange('lib/x.mjs'), true);
  assert.equal(isWatchableChange('apps/pos/lib/main.dart'), true);
  assert.equal(isWatchableChange('node_modules/p/x.js'), false);
  assert.equal(isWatchableChange('.testctl/cache.json'), false);
  assert.equal(isWatchableChange('.git/HEAD'), false);
  assert.equal(isWatchableChange('build/out.o'), false);
  assert.equal(isWatchableChange(''), false);
  assert.equal(isWatchableChange(null), false);
});
