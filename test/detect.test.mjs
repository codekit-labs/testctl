import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { detectStacks } from '../lib/detect.mjs';

function tmpProject() {
  return mkdtempSync(join(tmpdir(), 'testctl-detect-'));
}

test('detects Flutter from pubspec.yaml referencing flutter sdk', () => {
  const dir = tmpProject();
  writeFileSync(join(dir, 'pubspec.yaml'), 'name: app\ndependencies:\n  flutter:\n    sdk: flutter\n');
  const found = detectStacks(dir, {});
  assert.equal(found.flutter.present, true);
  assert.equal(found.flutter.path, dir);
});

test('does NOT detect Flutter from a plain Dart pubspec', () => {
  const dir = tmpProject();
  writeFileSync(join(dir, 'pubspec.yaml'), 'name: cli\ndependencies:\n  args: ^2.0.0\n');
  const found = detectStacks(dir, {});
  assert.equal(found.flutter.present, false);
});

test('detects Electron from package.json electron dependency', () => {
  const dir = tmpProject();
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ devDependencies: { electron: '^31.0.0' } }));
  const found = detectStacks(dir, {});
  assert.equal(found.electron.present, true);
});

test('does NOT detect Electron from a non-electron package.json', () => {
  const dir = tmpProject();
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ dependencies: { express: '^4.0.0' } }));
  const found = detectStacks(dir, {});
  assert.equal(found.electron.present, false);
});

test('detects Frappe from a hooks.py in the tree', () => {
  const dir = tmpProject();
  const appDir = join(dir, 'my_app');
  mkdirSync(appDir);
  writeFileSync(join(appDir, 'hooks.py'), 'app_name = "my_app"\n');
  const found = detectStacks(dir, {});
  assert.equal(found.frappe.present, true);
});

test('detects Frappe from explicit config even without hooks.py', () => {
  const dir = tmpProject();
  const found = detectStacks(dir, { stacks: { frappe: { site: 'test', apps: ['my_app'], benchPath: '/x' } } });
  assert.equal(found.frappe.present, true);
});

test('reports all absent for an empty project', () => {
  const dir = tmpProject();
  const found = detectStacks(dir, {});
  assert.equal(found.frappe.present, false);
  assert.equal(found.flutter.present, false);
  assert.equal(found.electron.present, false);
});

test('detects Next.js from package.json next dependency', () => {
  const dir = tmpProject();
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ dependencies: { next: '^14.0.0' } }));
  const found = detectStacks(dir, {});
  assert.equal(found.nextjs.present, true);
});

test('detects Next.js from explicit config (vercelUrl) without next dep', () => {
  const dir = tmpProject();
  const found = detectStacks(dir, { stacks: { nextjs: { vercelUrl: 'https://x.vercel.app' } } });
  assert.equal(found.nextjs.present, true);
});

test('does NOT detect Next.js from a non-next package.json', () => {
  const dir = tmpProject();
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ dependencies: { express: '^4.0.0' } }));
  const found = detectStacks(dir, {});
  assert.equal(found.nextjs.present, false);
});

test('detects Supabase from supabase/config.toml', () => {
  const dir = tmpProject();
  mkdirSync(join(dir, 'supabase'));
  writeFileSync(join(dir, 'supabase', 'config.toml'), '[api]\nport = 54321\n');
  const found = detectStacks(dir, {});
  assert.equal(found.supabase.present, true);
});

test('detects Supabase from explicit config', () => {
  const dir = tmpProject();
  const found = detectStacks(dir, { stacks: { supabase: { path: './' } } });
  assert.equal(found.supabase.present, true);
});

test('reports nextjs and supabase absent for an empty project', () => {
  const dir = tmpProject();
  const found = detectStacks(dir, {});
  assert.equal(found.nextjs.present, false);
  assert.equal(found.supabase.present, false);
});
