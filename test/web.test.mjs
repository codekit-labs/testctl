import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isWebDir, webRunner, webFramework } from '../lib/detect.mjs';
import { buildWebArgv } from '../lib/runners/web.mjs';

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

test('buildWebArgv: vitest default → vitest run --reporter=json', () => {
  assert.deepEqual(buildWebArgv({ runner: 'vitest' }), ['npx', 'vitest', 'run', '--reporter=json']);
});
test('buildWebArgv: jest default (no runner) → jest --json', () => {
  assert.deepEqual(buildWebArgv({}), ['npx', 'jest', '--json']);
});
test('buildWebArgv: vitest + coverage', () => {
  assert.deepEqual(buildWebArgv({ runner: 'vitest', coverage: true }),
    ['npx', 'vitest', 'run', '--reporter=json', '--coverage', '--coverage.reporter=json-summary', '--coverage.reporter=lcov']);
});
test('buildWebArgv: jest + coverage', () => {
  assert.deepEqual(buildWebArgv({ runner: 'jest', coverage: true }),
    ['npx', 'jest', '--json', '--coverage', '--coverageReporters=json-summary', '--coverageReporters=lcov']);
});
test('buildWebArgv: command override (array + string) wins', () => {
  assert.deepEqual(buildWebArgv({ command: ['pnpm', 'test'] }), ['pnpm', 'test']);
  assert.deepEqual(buildWebArgv({ command: 'yarn test --json' }), ['yarn', 'test', '--json']);
});

test('buildWebArgv (jest, coverage) adds the lcov reporter alongside json-summary', () => {
  const argv = buildWebArgv({ runner: 'jest', coverage: true });
  assert.ok(argv.includes('--coverageReporters=json-summary'), 'keeps json-summary');
  assert.ok(argv.includes('--coverageReporters=lcov'), 'adds lcov');
});

test('buildWebArgv (vitest, coverage) adds the lcov reporter alongside json-summary', () => {
  const argv = buildWebArgv({ runner: 'vitest', coverage: true });
  assert.ok(argv.includes('--coverage.reporter=json-summary'), 'keeps json-summary');
  assert.ok(argv.includes('--coverage.reporter=lcov'), 'adds lcov');
});
