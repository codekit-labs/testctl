import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, realpathSync } from 'node:fs';
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

test('Frappe with INCOMPLETE config (missing site/apps) is a notice, not a failing run', () => {
  const root = tmp();
  const t = discoverTargets(root, { stacks: { frappe: { benchPath: '/b' } } }).find((x) => x.stack === 'frappe');
  assert.ok(t);
  assert.equal(t.notice, true);
  assert.equal(t.config, undefined);
});

test('empty project yields no targets', () => {
  assert.deepEqual(discoverTargets(tmp(), {}), []);
});

test('Frappe as a list of two complete sites yields two targets labeled by site', () => {
  const root = tmp();
  const cfg = { stacks: { frappe: [
    { benchPath: '/b', site: 'site_a', apps: ['a'] },
    { benchPath: '/b', site: 'site_b', apps: ['b'] },
  ] } };
  const fr = discoverTargets(root, cfg).filter((t) => t.stack === 'frappe');
  assert.equal(fr.length, 2);
  assert.deepEqual(fr.map((t) => t.label).sort(), ['site_a', 'site_b']);
  for (const t of fr) { assert.notEqual(t.notice, true); assert.ok(t.config); }
  assert.equal(fr.find((t) => t.label === 'site_a').config.apps[0], 'a');
});

test('Frappe list mixing complete + incomplete yields one target and one notice, labeled by site', () => {
  const root = tmp();
  const cfg = { stacks: { frappe: [
    { benchPath: '/b', site: 'good', apps: ['a'] },
    { benchPath: '/b', site: 'bad' },
  ] } };
  const fr = discoverTargets(root, cfg).filter((t) => t.stack === 'frappe');
  assert.equal(fr.length, 2);
  const good = fr.find((t) => t.label === 'good');
  const bad = fr.find((t) => t.label === 'bad');
  assert.notEqual(good.notice, true);
  assert.ok(good.config);
  assert.equal(bad.notice, true);
  assert.equal(bad.config, undefined);
});

test('discoverTargets: a Frappe app with no config → notice target carrying its dir', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'testctl-frappe-detect-')));
  writeFileSync(join(root, 'hooks.py'), '# marker');
  const targets = discoverTargets(root, {});
  const frappe = targets.find((t) => t.stack === 'frappe' && t.notice);
  assert.ok(frappe, 'frappe notice present');
  assert.equal(frappe.dir, root);
});

test('Frappe single-element list keeps the legacy "frappe" label', () => {
  const root = tmp();
  const cfg = { stacks: { frappe: [{ benchPath: '/b', site: 's', apps: ['a'] }] } };
  const fr = discoverTargets(root, cfg).filter((t) => t.stack === 'frappe');
  assert.equal(fr.length, 1);
  assert.equal(fr[0].label, 'frappe');
  assert.ok(fr[0].config);
});

test('discoverTargets: react + vitest dir → web target (runner vitest, label react)', () => {
  const root = mkdtempSync(join(tmpdir(), 'testctl-web-disc-'));
  writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'ui', devDependencies: { react: '18', vitest: '1' } }));
  const targets = discoverTargets(root, {});
  const web = targets.find((t) => t.stack === 'web');
  assert.ok(web, 'web target present');
  assert.equal(web.path, root);
  assert.equal(web.runner, 'vitest');
  assert.equal(web.label, 'react');
});

test('discoverTargets: a Next.js dir is NOT also a web target', () => {
  const root = mkdtempSync(join(tmpdir(), 'testctl-next-disc-'));
  writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'app', dependencies: { next: '14', react: '18' }, devDependencies: { vitest: '1' } }));
  const targets = discoverTargets(root, {});
  assert.equal(targets.some((t) => t.stack === 'web'), false);
});

test('discover: playwright dir → e2e (playwright) target, coexists with web', () => {
  const root = mkdtempSync(join(tmpdir(), 'testctl-disc-e2e-'));
  writeFileSync(join(root, 'package.json'), JSON.stringify({
    name: 'app', devDependencies: { react: '18', vitest: '1', '@playwright/test': '1' },
  }));
  const targets = discoverTargets(root);
  const web = targets.find((t) => t.stack === 'web');
  const e2e = targets.find((t) => t.stack === 'e2e');
  assert.ok(web, 'web unit target present');
  assert.ok(e2e, 'e2e target present');
  assert.equal(e2e.framework, 'playwright');
  assert.equal(e2e.label, 'e2e (playwright)');
});

test('discover: flutter integration_test → e2e (flutter) target, coexists with flutter', () => {
  const root = mkdtempSync(join(tmpdir(), 'testctl-disc-e2eflu-'));
  writeFileSync(join(root, 'pubspec.yaml'), 'name: app\ndev_dependencies:\n  flutter_test:\n    sdk: flutter\n');
  mkdirSync(join(root, 'integration_test'));
  const targets = discoverTargets(root);
  assert.ok(targets.find((t) => t.stack === 'flutter'), 'flutter unit target present');
  const e2e = targets.find((t) => t.stack === 'e2e');
  assert.ok(e2e, 'e2e target present');
  assert.equal(e2e.framework, 'flutter-integration');
  assert.equal(e2e.label, 'e2e (flutter)');
});

test('discover: onlyStack=e2e filters to e2e target', () => {
  const root = mkdtempSync(join(tmpdir(), 'testctl-disc-e2eonly-'));
  writeFileSync(join(root, 'package.json'), JSON.stringify({
    name: 'app', devDependencies: { react: '18', vitest: '1', '@playwright/test': '1' },
  }));
  const targets = discoverTargets(root, {}, 'e2e');
  assert.equal(targets.length, 1);
  assert.equal(targets[0].stack, 'e2e');
});

test('discover: cfg.e2e.command override is carried onto the e2e target', () => {
  const root = mkdtempSync(join(tmpdir(), 'testctl-disc-e2ecfg-'));
  writeFileSync(join(root, 'package.json'), JSON.stringify({
    name: 'app', devDependencies: { '@playwright/test': '1' },
  }));
  const targets = discoverTargets(root, { stacks: { e2e: { command: 'pnpm e2e' } } }, 'e2e');
  assert.equal(targets.length, 1);
  assert.equal(targets[0].command, 'pnpm e2e');
});
