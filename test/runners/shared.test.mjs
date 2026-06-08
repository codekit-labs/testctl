import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ranButProducedNothing, capFailures } from '../../lib/runners/shared.mjs';
import { buildElectronArgv } from '../../lib/runners/electron.mjs';

test('ranButProducedNothing flags non-zero exit with no tests', () => {
  assert.equal(ranButProducedNothing(1, { passed: 0, failed: 0, skipped: 0 }), true);
});
test('ranButProducedNothing allows non-zero exit when tests were collected', () => {
  assert.equal(ranButProducedNothing(1, { passed: 0, failed: 2, skipped: 0 }), false);
});
test('ranButProducedNothing allows clean zero-exit zero-test run', () => {
  assert.equal(ranButProducedNothing(0, { passed: 0, failed: 0, skipped: 0 }), false);
});
test('ranButProducedNothing treats null status with no tests as failure', () => {
  assert.equal(ranButProducedNothing(null, { passed: 0, failed: 0, skipped: 0 }), true);
});

test('buildElectronArgv defaults to npx jest --json', () => {
  assert.deepEqual(buildElectronArgv({}), ['npx', 'jest', '--json']);
});
test('buildElectronArgv accepts a full argv array override', () => {
  assert.deepEqual(buildElectronArgv({ command: ['yarn', 'test', '--json'] }), ['yarn', 'test', '--json']);
});
test('buildElectronArgv splits a string override', () => {
  assert.deepEqual(buildElectronArgv({ command: 'npx playwright test --reporter=json' }), ['npx', 'playwright', 'test', '--reporter=json']);
});

test('capFailures trims long messages', () => {
  const out = capFailures([{ test: 't', file: null, line: null, message: 'x'.repeat(1000) }]);
  assert.ok(out[0].message.length < 850);
  assert.match(out[0].message, /\[truncated\]$/);
});
test('capFailures limits to 20 and appends a +N more marker', () => {
  const many = Array.from({ length: 25 }, (_, i) => ({ test: `t${i}`, file: null, line: null, message: 'm' }));
  const out = capFailures(many);
  assert.equal(out.length, 21);
  assert.match(out[20].test, /\+5 more/);
});
test('capFailures returns short lists unchanged', () => {
  const inp = [{ test: 't', file: 'f', line: 1, message: 'm' }];
  assert.deepEqual(capFailures(inp), inp);
});
