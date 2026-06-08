import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { hashApp, appCacheKey, decideCached, loadCache, saveCache } from '../lib/cache.mjs';

function appDir(files) {
  const dir = mkdtempSync(join(tmpdir(), 'testctl-cache-'));
  for (const [rel, content] of Object.entries(files)) {
    const full = join(dir, rel);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, content);
  }
  return dir;
}

test('hashApp is stable for identical content and changes when a file changes', () => {
  const d = appDir({ 'lib/a.js': 'one', 'lib/b.js': 'two' });
  const h1 = hashApp(d);
  const h2 = hashApp(d);
  assert.equal(h1, h2);
  writeFileSync(join(d, 'lib/a.js'), 'ONE');
  assert.notEqual(hashApp(d), h1);
  rmSync(d, { recursive: true, force: true });
});

test('hashApp ignores node_modules and returns null for a missing path', () => {
  const d = appDir({ 'lib/a.js': 'one' });
  const before = hashApp(d);
  mkdirSync(join(d, 'node_modules', 'pkg'), { recursive: true });
  writeFileSync(join(d, 'node_modules', 'pkg', 'x.js'), 'junk');
  assert.equal(hashApp(d), before);
  assert.equal(hashApp(join(d, 'does-not-exist')), null);
  rmSync(d, { recursive: true, force: true });
});

test('decideCached only true on hash match AND ok', () => {
  assert.equal(decideCached({ hash: 'a', ok: true }, 'a'), true);
  assert.equal(decideCached({ hash: 'a', ok: false }, 'a'), false);
  assert.equal(decideCached({ hash: 'a', ok: true }, 'b'), false);
  assert.equal(decideCached(undefined, 'a'), false);
  assert.equal(decideCached({ hash: 'a', ok: true }, null), false);
});

test('appCacheKey is stable per stack+label', () => {
  assert.equal(appCacheKey({ stack: 'flutter', label: 'apps/pos' }), 'flutter:apps/pos');
  assert.equal(appCacheKey({ stack: 'electron' }), 'electron:electron');
});

test('saveCache/loadCache round-trip; loadCache returns {} when absent', () => {
  const dir = mkdtempSync(join(tmpdir(), 'testctl-cacheio-'));
  assert.deepEqual(loadCache(dir), {});
  saveCache(dir, { 'flutter:a': { hash: 'h', ok: true } });
  assert.deepEqual(loadCache(dir), { 'flutter:a': { hash: 'h', ok: true } });
  rmSync(dir, { recursive: true, force: true });
});
