import { spawnSync } from 'node:child_process';
import { resolve, sep } from 'node:path';

// Is absolute file `f` inside absolute directory `dir`?
export function isUnder(f, dir) {
  const nf = resolve(f);
  const nd = resolve(dir);
  return nf === nd || nf.startsWith(nd + sep);
}

// Pure: keep targets affected by the changed files.
// - path-based target (flutter/electron/supabase): keep iff a changed file is under its abs path
// - no-path target (frappe/nextjs): keep (conservative)
// - notice target: keep
export function selectChangedTargets(targets, changedAbsFiles, projectDir) {
  return targets.filter((t) => {
    if (t.notice) return true;
    if (!t.path) return true;
    const abs = resolve(projectDir, t.path);
    return changedAbsFiles.some((f) => isUnder(f, abs));
  });
}

// Absolute git toplevel for `dir`, or null when dir isn't in a repo OR git is unavailable.
// (Uses `git -C <dir> rev-parse --show-toplevel`, which also resolves `.git` files for submodules.)
export function gitToplevel(dir) {
  const r = spawnSync('git', ['-C', dir, 'rev-parse', '--show-toplevel'], { encoding: 'utf8' });
  if (r.error || r.status !== 0) return null;
  const top = (r.stdout || '').trim();
  return top ? resolve(top) : null;
}

// Distinct git repo roots covering the project + each app dir. Pure given an injected `toplevel`.
// Project root first, then targets in order; nulls dropped, de-duplicated.
export function gitRepoRoots(projectDir, targetDirs = [], toplevel = gitToplevel) {
  const roots = [];
  const seen = new Set();
  const add = (d) => {
    if (d == null) return;
    const r = toplevel(d);
    if (r && !seen.has(r)) { seen.add(r); roots.push(r); }
  };
  add(projectDir);
  for (const d of targetDirs) add(d);
  return roots;
}

// Changed files (working-tree + staged + untracked, plus vs `ref`) within a single repo root.
function changedInRepo(root, ref) {
  const git = (args) => spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  const set = new Set();
  const add = (out) => {
    for (const line of (out || '').split('\n')) {
      const f = line.trim();
      if (f) set.add(resolve(root, f));
    }
  };
  add(git(['diff', '--name-only', 'HEAD']).stdout);
  add(git(['ls-files', '--others', '--exclude-standard']).stdout);
  if (ref) add(git(['diff', '--name-only', `${ref}...HEAD`]).stdout);
  return set;
}

// Impure: collect changed files unioned across the project repo AND each app's own repo.
// Returns { files: string[]|null, note: string|null }. files=null → caller runs everything.
export function gitChangedFiles(projectDir, ref = null, targetDirs = []) {
  const roots = gitRepoRoots(projectDir, targetDirs);
  if (roots.length === 0) {
    return { files: null, note: 'not a git repo — running all targets' };
  }
  const all = new Set();
  for (const root of roots) for (const f of changedInRepo(root, ref)) all.add(f);
  const note = roots.length > 1 ? `scanned ${roots.length} git repos for changes` : null;
  return { files: [...all], note };
}

// If any notice target (a detected-but-unconfigured app, e.g. Frappe with no testctl.yaml) contains
// a changed file, return a one-line actionable nudge; else null.
export function unconfiguredChangedNote(targets, changedAbsFiles) {
  if (!Array.isArray(changedAbsFiles) || changedAbsFiles.length === 0) return null;
  for (const t of targets) {
    if (!t.notice || !t.dir) continue;
    const abs = resolve(t.dir);
    const n = changedAbsFiles.filter((f) => isUnder(f, abs)).length;
    if (n > 0) return `${n} changed file(s) are in an unconfigured ${t.stack} app — run testctl init to test it`;
  }
  return null;
}

// Impure: the raw unified diff for changed files, unioned across the project repo AND each app's repo.
// Mirrors gitChangedFiles' multi-repo handling. Returns the concatenated `git diff` text (never null;
// empty string when nothing / no repo). Parsing lives in lib/diffcov.mjs (parseDiffRanges) so this
// stays a thin I/O wrapper.
export function gitChangedLineRanges(projectDir, ref = null, targetDirs = []) {
  const roots = gitRepoRoots(projectDir, targetDirs);
  if (roots.length === 0) return '';
  const git = (root, args) => spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  let text = '';
  for (const root of roots) {
    // working-tree + staged (and vs ref when given); unified diff with default 3 lines of context.
    const wt = git(root, ['diff', 'HEAD']);
    if (!wt.error && wt.status === 0 && wt.stdout) text += wt.stdout;
    if (ref) {
      const r = git(root, ['diff', `${ref}...HEAD`]);
      if (!r.error && r.status === 0 && r.stdout) text += r.stdout;
    }
  }
  return text;
}
