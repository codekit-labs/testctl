import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { isUnder, selectChangedTargets, gitChangedFiles, gitRepoRoots, unconfiguredChangedNote } from '../lib/changed.mjs';

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

test('gitRepoRoots: unions project root + each target dir’s toplevel, de-duped, nulls dropped, stable order', () => {
  const map = { '/proj': null, '/proj/apps/a': '/proj/apps/a', '/proj/apps/b': '/proj/apps/b', '/proj/apps/a/sub': '/proj/apps/a' };
  const toplevel = (d) => (d in map ? map[d] : null);
  const roots = gitRepoRoots('/proj', ['/proj/apps/a', '/proj/apps/a/sub', '/proj/apps/b'], toplevel);
  assert.deepEqual(roots, ['/proj/apps/a', '/proj/apps/b']);
});

test('gitRepoRoots: includes the project root when it is itself a repo, first', () => {
  const toplevel = (d) => (d === '/p' ? '/p' : (d === '/p/x' ? '/p/x' : null));
  assert.deepEqual(gitRepoRoots('/p', ['/p/x'], toplevel), ['/p', '/p/x']);
});

test('gitChangedFiles: unions changes from two separate sub-repos under a non-git root', () => {
  if (spawnSync('git', ['--version']).status !== 0) return; // skip if git absent
  // realpath: git rev-parse --show-toplevel canonicalizes symlinks (e.g. macOS /var → /private/var),
  // so resolve the temp root to its canonical form to compare like-for-like.
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'testctl-multirepo-')));
  const mkrepo = (name, file) => {
    const dir = join(root, name);
    mkdirSync(dir, { recursive: true });
    spawnSync('git', ['init', '-q'], { cwd: dir });
    spawnSync('git', ['config', 'user.email', 't@t'], { cwd: dir });
    spawnSync('git', ['config', 'user.name', 't'], { cwd: dir });
    writeFileSync(join(dir, file), 'x');
    return join(dir, file);
  };
  const fa = mkrepo('apps/a', 'a.py');
  const fb = mkrepo('apps/b', 'b.py');
  const { files } = gitChangedFiles(root, null, [join(root, 'apps/a'), join(root, 'apps/b')]);
  assert.ok(Array.isArray(files));
  assert.ok(files.includes(fa), 'change in repo a found');
  assert.ok(files.includes(fb), 'change in repo b found');
});

test('gitChangedFiles: no repo anywhere → files null with the run-all note (unchanged floor)', () => {
  const empty = mkdtempSync(join(tmpdir(), 'testctl-norepo-'));
  const { files, note } = gitChangedFiles(empty, null, []);
  assert.equal(files, null);
  assert.match(note, /not a git repo/);
});

test('unconfiguredChangedNote: changed file under a notice target dir → actionable init note', () => {
  const targets = [
    { stack: 'frappe', label: 'frappe', notice: true, dir: '/proj' },
    { stack: 'flutter', path: '/proj/app' },
  ];
  const note = unconfiguredChangedNote(targets, ['/proj/apps/x/foo.py']);
  assert.match(note, /unconfigured frappe/i);
  assert.match(note, /testctl init/);
});

test('unconfiguredChangedNote: no changes / no notice dir / no match → null', () => {
  assert.equal(unconfiguredChangedNote([{ stack: 'frappe', notice: true, dir: '/proj' }], []), null);
  assert.equal(unconfiguredChangedNote([{ stack: 'frappe', notice: true }], ['/proj/x']), null);
  assert.equal(unconfiguredChangedNote([{ stack: 'flutter', path: '/p/app' }], ['/p/app/x']), null);
});
