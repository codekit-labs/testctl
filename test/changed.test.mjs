import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { isUnder, selectChangedTargets, gitChangedFiles } from '../lib/changed.mjs';

test('isUnder: nested file is under dir; sibling/prefix is not', () => {
  assert.equal(isUnder('/a/b/c.js', '/a/b'), true);
  assert.equal(isUnder('/a/b', '/a/b'), true);
  assert.equal(isUnder('/a/bc/d.js', '/a/b'), false);
  assert.equal(isUnder('/a/x.js', '/a/b'), false);
});

test('selectChangedTargets keeps path-based targets only when a changed file is under them', () => {
  const root = '/proj';
  const targets = [
    { stack: 'flutter', path: '/proj/apps/pos', label: 'apps/pos' },
    { stack: 'flutter', path: '/proj/apps/order', label: 'apps/order' },
  ];
  const changed = ['/proj/apps/pos/lib/main.dart'];
  const out = selectChangedTargets(targets, changed, root);
  assert.deepEqual(out.map((t) => t.label), ['apps/pos']);
});

test('selectChangedTargets always keeps frappe/nextjs (no path) and notices', () => {
  const targets = [
    { stack: 'frappe', label: 'frappe', config: {} },
    { stack: 'nextjs', label: 'nextjs', config: {} },
    { stack: 'flutter', path: '/proj/apps/pos', label: 'apps/pos' },
    { stack: 'frappe', label: 'frappe', notice: true, note: 'needs config' },
  ];
  const out = selectChangedTargets(targets, [], '/proj');
  assert.deepEqual(out.map((t) => t.stack), ['frappe', 'nextjs', 'frappe']);
});

test('selectChangedTargets resolves relative target paths against projectDir', () => {
  const targets = [{ stack: 'flutter', path: 'apps/pos', label: 'apps/pos' }];
  const changed = [resolve('/proj', 'apps/pos/lib/x.dart')];
  assert.equal(selectChangedTargets(targets, changed, '/proj').length, 1);
});

test('gitChangedFiles fails open (files=null + note) outside a git repo', () => {
  const dir = mkdtempSync(join(tmpdir(), 'testctl-nogit-'));
  const r = gitChangedFiles(dir, null);
  assert.equal(r.files, null);
  assert.match(r.note, /not a git repo/i);
});
