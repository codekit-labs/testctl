import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isWebDir, webRunner, webFramework } from '../lib/detect.mjs';

function pkgDir(deps) {
  const d = mkdtempSync(join(tmpdir(), 'testctl-web-detect-'));
  writeFileSync(join(d, 'package.json'), JSON.stringify({ name: 'x', devDependencies: deps }));
  return d;
}

test('isWebDir: react + vitest → true', () => {
  assert.equal(isWebDir(pkgDir({ react: '18', vitest: '1' })), true);
});
test('isWebDir: vue + jest → true', () => {
  assert.equal(isWebDir(pkgDir({ vue: '3', jest: '29' })), true);
});
test('isWebDir: next present → false (Next.js has its own runner)', () => {
  assert.equal(isWebDir(pkgDir({ react: '18', vitest: '1', next: '14' })), false);
});
test('isWebDir: electron present → false (electron has its own runner)', () => {
  assert.equal(isWebDir(pkgDir({ react: '18', jest: '29', electron: '30' })), false);
});
test('isWebDir: framework but no test runner → false', () => {
  assert.equal(isWebDir(pkgDir({ react: '18' })), false);
});
test('isWebDir: runner but no framework → false', () => {
  assert.equal(isWebDir(pkgDir({ vitest: '1' })), false);
});
test('webRunner: vitest wins over jest', () => {
  assert.equal(webRunner(pkgDir({ vue: '3', vitest: '1', jest: '29' })), 'vitest');
  assert.equal(webRunner(pkgDir({ react: '18', jest: '29' })), 'jest');
});
test('webFramework: react / vue / web', () => {
  assert.equal(webFramework(pkgDir({ react: '18', vitest: '1' })), 'react');
  assert.equal(webFramework(pkgDir({ vue: '3', jest: '29' })), 'vue');
  assert.equal(webFramework(pkgDir({ '@testing-library/react': '14', vitest: '1' })), 'react');
});
