import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isE2eDir, e2eFramework } from '../../lib/detect.mjs';
import { buildE2eArgv, parsePlaywrightJson } from '../../lib/runners/e2e.mjs';

// ---- detection helpers ----
function dir(setup) {
  const d = mkdtempSync(join(tmpdir(), 'testctl-e2e-detect-'));
  setup(d);
  return d;
}
function pkg(d, deps) {
  writeFileSync(join(d, 'package.json'), JSON.stringify({ name: 'x', devDependencies: deps }));
}

test('isE2eDir: @playwright/test in devDeps → true', () => {
  assert.equal(isE2eDir(dir((d) => pkg(d, { '@playwright/test': '1' }))), true);
});
test('isE2eDir: playwright.config.ts present → true', () => {
  assert.equal(isE2eDir(dir((d) => { pkg(d, {}); writeFileSync(join(d, 'playwright.config.ts'), ''); })), true);
});
test('isE2eDir: pubspec + integration_test/ → true', () => {
  assert.equal(isE2eDir(dir((d) => {
    writeFileSync(join(d, 'pubspec.yaml'), 'name: app\n');
    mkdirSync(join(d, 'integration_test'));
  })), true);
});
test('isE2eDir: plain react+vitest (no playwright, no integration_test) → false', () => {
  assert.equal(isE2eDir(dir((d) => pkg(d, { react: '18', vitest: '1' }))), false);
});
test('isE2eDir: empty dir → false', () => {
  assert.equal(isE2eDir(dir(() => {})), false);
});

test('e2eFramework: playwright wins when both present', () => {
  const d = dir((d2) => {
    pkg(d2, { '@playwright/test': '1' });
    writeFileSync(join(d2, 'pubspec.yaml'), 'name: app\n');
    mkdirSync(join(d2, 'integration_test'));
  });
  assert.equal(e2eFramework(d), 'playwright');
});
test('e2eFramework: flutter integration when only integration_test/', () => {
  const d = dir((d2) => { writeFileSync(join(d2, 'pubspec.yaml'), 'name: app\n'); mkdirSync(join(d2, 'integration_test')); });
  assert.equal(e2eFramework(d), 'flutter-integration');
});
test('e2eFramework: playwright.config.js → playwright', () => {
  const d = dir((d2) => { pkg(d2, {}); writeFileSync(join(d2, 'playwright.config.js'), ''); });
  assert.equal(e2eFramework(d), 'playwright');
});

// ---- buildE2eArgv ----
test('buildE2eArgv: playwright default', () => {
  assert.deepEqual(buildE2eArgv({ framework: 'playwright' }), ['npx', 'playwright', 'test', '--reporter=json']);
});
test('buildE2eArgv: flutter-integration default', () => {
  assert.deepEqual(buildE2eArgv({ framework: 'flutter-integration' }),
    ['flutter', 'test', 'integration_test', '--machine']);
});
test('buildE2eArgv: command override (array) wins', () => {
  assert.deepEqual(buildE2eArgv({ framework: 'playwright', command: ['pnpm', 'e2e'] }), ['pnpm', 'e2e']);
});
test('buildE2eArgv: command override (string) wins', () => {
  assert.deepEqual(buildE2eArgv({ framework: 'flutter-integration', command: 'make e2e' }), ['make', 'e2e']);
});

// ---- parsePlaywrightJson ----
const SAMPLE = JSON.stringify({
  config: { version: '1.40.0' },
  stats: { startTime: '2026-06-18T10:00:00.000Z', duration: 4210, expected: 3, skipped: 1, unexpected: 2, flaky: 1 },
  suites: [
    {
      title: 'auth.spec.ts',
      file: 'tests/auth.spec.ts',
      specs: [
        { title: 'logs in', ok: true, line: 5, tests: [{ results: [{ status: 'passed' }] }] },
        { title: 'rejects bad password', ok: false, line: 12,
          tests: [{ results: [{ status: 'failed', error: { message: "expect(received).toBe(expected)\n  Expected: true\n  Received: false" } }] }] },
      ],
      suites: [
        {
          title: 'nested',
          file: 'tests/auth.spec.ts',
          specs: [
            { title: 'locks out after 5 tries', ok: false, line: 30,
              tests: [{ results: [{ status: 'failed', error: { message: 'TimeoutError: locator.click: Timeout 30000ms exceeded' } }] }] },
          ],
        },
      ],
    },
  ],
});

test('parsePlaywrightJson: counts from stats (flaky counts as passed)', () => {
  const r = parsePlaywrightJson(SAMPLE);
  assert.equal(r.passed, 4);   // expected(3) + flaky(1)
  assert.equal(r.failed, 2);   // unexpected
  assert.equal(r.skipped, 1);  // skipped
});
test('parsePlaywrightJson: failures walked recursively from ok===false specs', () => {
  const r = parsePlaywrightJson(SAMPLE);
  assert.equal(r.failures.length, 2);
  assert.deepEqual(r.failures[0], {
    test: 'rejects bad password',
    file: 'tests/auth.spec.ts',
    line: 12,
    message: 'expect(received).toBe(expected)',
  });
  assert.equal(r.failures[1].test, 'locks out after 5 tries');
  assert.equal(r.failures[1].line, 30);
  assert.equal(r.failures[1].message, 'TimeoutError: locator.click: Timeout 30000ms exceeded');
});
test('parsePlaywrightJson: throws on unparseable JSON', () => {
  assert.throws(() => parsePlaywrightJson('not json at all'), /JSON/);
});
test('parsePlaywrightJson: missing stats → zeros, no throw', () => {
  const r = parsePlaywrightJson(JSON.stringify({ suites: [] }));
  assert.deepEqual(r, { passed: 0, failed: 0, skipped: 0, failures: [] });
});
test('parsePlaywrightJson: flaky tests counted as passed (expected + flaky)', () => {
  // stats: expected=2, flaky=1, unexpected=1, skipped=0 → passed must be 3 (2+1), not 2
  const r = parsePlaywrightJson(JSON.stringify({
    stats: { expected: 2, unexpected: 1, skipped: 0, flaky: 1 },
    suites: [],
  }));
  assert.equal(r.passed, 3, 'flaky should be added to passed');
  assert.equal(r.failed, 1);
  assert.equal(r.skipped, 0);
});
