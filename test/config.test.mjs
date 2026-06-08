import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig } from '../lib/config.mjs';

function tmpProject() {
  return mkdtempSync(join(tmpdir(), 'testctl-config-'));
}

function withTmp(yaml) {
  const dir = tmpProject();
  writeFileSync(join(dir, 'testctl.yaml'), yaml);
  return dir;
}

test('returns empty stacks when no testctl.yaml exists', () => {
  const dir = tmpProject();
  const cfg = loadConfig(dir);
  assert.deepEqual(cfg, { stacks: {} });
});

test('parses a testctl.yaml with all three stacks', () => {
  const dir = tmpProject();
  writeFileSync(join(dir, 'testctl.yaml'), [
    'stacks:',
    '  frappe:',
    '    benchPath: /path/to/frappe-bench',
    '    site: test',
    '    apps: [app_one, app_two]',
    '  flutter:',
    '    path: ./mobile',
    '  electron:',
    '    path: ./desktop',
    '',
  ].join('\n'));
  const cfg = loadConfig(dir);
  assert.equal(cfg.stacks.frappe.site, 'test');
  assert.deepEqual(cfg.stacks.frappe.apps, ['app_one', 'app_two']);
  assert.equal(cfg.stacks.flutter.path, './mobile');
  assert.equal(cfg.stacks.electron.path, './desktop');
});

test('throws a clear error on malformed yaml', () => {
  const dir = tmpProject();
  writeFileSync(join(dir, 'testctl.yaml'), 'stacks:\n  frappe:\n  - bad: : :\n');
  assert.throws(() => loadConfig(dir), /testctl\.yaml/);
});

test('loadConfig surfaces coverageMin when present', () => {
  const dir = tmpProject();
  writeFileSync(join(dir, 'testctl.yaml'), 'coverageMin: 70\nstacks:\n  flutter: {}\n');
  const cfg = loadConfig(dir);
  assert.equal(cfg.coverageMin, 70);
  assert.deepEqual(cfg.stacks, { flutter: {} });
});

test('loadConfig omits coverageMin when absent', () => {
  const dir = tmpProject();
  writeFileSync(join(dir, 'testctl.yaml'), 'stacks:\n  flutter: {}\n');
  const cfg = loadConfig(dir);
  assert.equal('coverageMin' in cfg, false);
});

test('loadConfig surfaces cache:true when present and omits it otherwise', () => {
  const d1 = tmpProject();
  writeFileSync(join(d1, 'testctl.yaml'), 'cache: true\nstacks:\n  flutter: {}\n');
  assert.equal(loadConfig(d1).cache, true);
  const d2 = tmpProject();
  writeFileSync(join(d2, 'testctl.yaml'), 'stacks:\n  flutter: {}\n');
  assert.equal('cache' in loadConfig(d2), false);
});

test('loadConfig surfaces retry when present and omits it otherwise', () => {
  const d1 = withTmp('retry: 2\nstacks:\n  flutter: {}\n');
  assert.equal(loadConfig(d1).retry, 2);
  const d2 = withTmp('stacks:\n  flutter: {}\n');
  assert.equal('retry' in loadConfig(d2), false);
});
