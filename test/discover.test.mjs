import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { discoverTargets } from '../lib/discover.mjs';

function tmp() {
  return mkdtempSync(join(tmpdir(), 'testctl-discover-'));
}
function flutterApp(dir) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'pubspec.yaml'), 'name: app\ndependencies:\n  flutter:\n    sdk: flutter\n');
}

test('finds multiple Flutter apps in subdirectories, labeled by relative path', () => {
  const root = tmp();
  flutterApp(join(root, 'apps', 'pos'));
  flutterApp(join(root, 'apps', 'order'));
  const targets = discoverTargets(root, {});
  const flutter = targets.filter((t) => t.stack === 'flutter').map((t) => t.label).sort();
  assert.deepEqual(flutter, ['apps/order', 'apps/pos']);
  for (const t of targets.filter((t) => t.stack === 'flutter')) assert.ok(t.path);
});

test('skips node_modules and prunes inside a matched app (no example sub-app)', () => {
  const root = tmp();
  flutterApp(join(root, 'mobile'));
  flutterApp(join(root, 'mobile', 'example'));
  flutterApp(join(root, 'node_modules', 'pkg'));
  const labels = discoverTargets(root, {}).filter((t) => t.stack === 'flutter').map((t) => t.label);
  assert.deepEqual(labels, ['mobile']);
});

test('onlyStack filters the targets', () => {
  const root = tmp();
  flutterApp(join(root, 'mobile'));
  mkdirSync(join(root, 'desktop'), { recursive: true });
  writeFileSync(join(root, 'desktop', 'package.json'), JSON.stringify({ devDependencies: { electron: '^31' } }));
  const only = discoverTargets(root, {}, 'flutter');
  assert.equal(only.length, 1);
  assert.equal(only[0].stack, 'flutter');
});

test('an explicit config path overrides walking for that stack', () => {
  const root = tmp();
  flutterApp(join(root, 'mobile'));
  const targets = discoverTargets(root, { stacks: { flutter: { path: './custom' } } });
  const flutter = targets.filter((t) => t.stack === 'flutter');
  assert.equal(flutter.length, 1);
  assert.equal(flutter[0].path, './custom');
});

test('Next.js without a configured vercelUrl becomes a non-runnable notice', () => {
  const root = tmp();
  mkdirSync(join(root, 'web'), { recursive: true });
  writeFileSync(join(root, 'web', 'package.json'), JSON.stringify({ dependencies: { next: '^14' } }));
  const t = discoverTargets(root, {}).find((x) => x.stack === 'nextjs');
  assert.ok(t);
  assert.equal(t.notice, true);
  assert.match(t.note, /vercelUrl/);
});

test('Frappe app without config becomes a non-runnable notice', () => {
  const root = tmp();
  mkdirSync(join(root, 'my_app'), { recursive: true });
  writeFileSync(join(root, 'my_app', 'hooks.py'), 'app_name = "my_app"\n');
  const t = discoverTargets(root, {}).find((x) => x.stack === 'frappe');
  assert.ok(t);
  assert.equal(t.notice, true);
  assert.match(t.note, /benchPath|site|apps/);
});

test('Frappe with config is a runnable target (no notice)', () => {
  const root = tmp();
  const t = discoverTargets(root, { stacks: { frappe: { benchPath: '/b', site: 's', apps: ['a'] } } }).find((x) => x.stack === 'frappe');
  assert.ok(t);
  assert.notEqual(t.notice, true);
  assert.ok(t.config);
});

test('empty project yields no targets', () => {
  assert.deepEqual(discoverTargets(tmp(), {}), []);
});
