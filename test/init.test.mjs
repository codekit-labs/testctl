import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from 'yaml';
import { buildInitYaml } from '../lib/init.mjs';

test('buildInitYaml writes a frappe block with real benchPath/apps and a site placeholder + hint', () => {
  const y = buildInitYaml({
    auto: { flutter: 0, electron: 0, supabase: 0 },
    frappe: { benchPath: '/home/me/frappe-bench', apps: ['erptrue_app'], sites: ['at.test', 'demo.local'] },
    nextjs: 0,
  });
  assert.match(y, /benchPath: \/home\/me\/frappe-bench/);
  assert.match(y, /apps: \[erptrue_app\]/);
  assert.match(y, /site: <FILL-ME>/);
  assert.match(y, /at\.test, demo\.local/);
  assert.match(y, /allow_tests/);
});

test('buildInitYaml adds a nextjs vercelUrl placeholder when next is detected', () => {
  const y = buildInitYaml({ auto: { flutter: 0, electron: 0, supabase: 0 }, frappe: null, nextjs: 1 });
  assert.match(y, /nextjs:/);
  assert.match(y, /vercelUrl: <FILL-ME>/);
});

test('buildInitYaml notes auto-detected stacks in a comment', () => {
  const y = buildInitYaml({ auto: { flutter: 3, electron: 1, supabase: 0 }, frappe: null, nextjs: 0 });
  assert.match(y, /Auto-detected/);
  assert.match(y, /3 Flutter app\(s\)/);
  assert.match(y, /1 Electron app\(s\)/);
});

test('buildInitYaml emits an empty stacks map when nothing needs config', () => {
  const y = buildInitYaml({ auto: { flutter: 2, electron: 0, supabase: 0 }, frappe: null, nextjs: 0 });
  assert.match(y, /auto-discover/);
  const parsed = parse(y);
  assert.deepEqual(parsed.stacks, {});
});

test('buildInitYaml always produces valid YAML', () => {
  const y = buildInitYaml({
    auto: { flutter: 1, electron: 0, supabase: 0 },
    frappe: { benchPath: '/b', apps: ['a'], sites: [] },
    nextjs: 1,
  });
  const parsed = parse(y);
  assert.equal(parsed.stacks.frappe.benchPath, '/b');
  assert.deepEqual(parsed.stacks.frappe.apps, ['a']);
  assert.equal(parsed.stacks.nextjs.vercelUrl, '<FILL-ME>');
});
