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

// Impure: collect changed files (working-tree + staged + untracked, plus vs `ref` when given).
// Returns { files: string[]|null, note: string|null }. files=null → caller runs everything.
export function gitChangedFiles(projectDir, ref = null) {
  const git = (args) => spawnSync('git', args, { cwd: projectDir, encoding: 'utf8' });
  const inside = git(['rev-parse', '--is-inside-work-tree']);
  if (inside.error || inside.status !== 0 || !/true/.test(inside.stdout || '')) {
    return { files: null, note: 'not a git repo — running all targets' };
  }
  const root = (git(['rev-parse', '--show-toplevel']).stdout || '').trim() || projectDir;
  const set = new Set();
  const add = (out) => {
    for (const line of (out || '').split('\n')) {
      const f = line.trim();
      if (f) set.add(resolve(root, f));
    }
  };
  add(git(['diff', '--name-only', 'HEAD']).stdout);              // tracked changes vs HEAD
  add(git(['ls-files', '--others', '--exclude-standard']).stdout); // untracked
  if (ref) add(git(['diff', '--name-only', `${ref}...HEAD`]).stdout);
  return { files: [...set], note: null };
}
