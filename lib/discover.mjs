import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { isFlutterDir, isElectronDir, isSupabaseDir, isNextDir, hasFrappeMarker } from './detect.mjs';

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'build', '.dart_tool', 'ios', 'android', '.next',
  'dist', 'out', 'Pods', 'vendor', '.venv', '__pycache__', 'coverage',
]);
const MAX_DEPTH = 5;

function pathStacksFor(dir) {
  const m = [];
  if (isFlutterDir(dir)) m.push('flutter');
  if (isElectronDir(dir)) m.push('electron');
  if (isSupabaseDir(dir)) m.push('supabase');
  return m;
}

function walk(root, dir, depth, acc) {
  if (depth > MAX_DEPTH) return;
  const pathStacks = pathStacksFor(dir);
  const isNext = isNextDir(dir);
  if (pathStacks.length || isNext) {
    for (const stack of pathStacks) acc.push({ stack, dir });
    if (isNext) acc.push({ stack: 'nextjs', dir });
    return; // prune: don't recurse into a matched app
  }
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    if (e.name.startsWith('.') || SKIP_DIRS.has(e.name)) continue;
    walk(root, join(dir, e.name), depth + 1, acc);
  }
}

export function discoverTargets(root, config = {}, onlyStack = null) {
  const cfg = config.stacks || {};
  const found = [];
  walk(root, root, 0, found);

  const targets = [];
  const labelFor = (dir) => {
    const r = relative(root, dir);
    return r === '' ? null : r;
  };

  for (const f of found) {
    const lbl = labelFor(f.dir);
    if (f.stack === 'nextjs') {
      if (!(cfg.nextjs && cfg.nextjs.vercelUrl)) {
        targets.push({ stack: 'nextjs', label: lbl || 'nextjs', notice: true, note: 'needs vercelUrl in testctl.yaml' });
      }
    } else {
      targets.push({ stack: f.stack, path: f.dir, label: lbl || f.stack });
    }
  }

  for (const stack of ['flutter', 'electron', 'supabase']) {
    if (cfg[stack] && cfg[stack].path) {
      for (let i = targets.length - 1; i >= 0; i--) {
        if (targets[i].stack === stack) targets.splice(i, 1);
      }
      targets.push({ stack, path: cfg[stack].path, label: stack });
    }
  }

  if (cfg.nextjs && cfg.nextjs.vercelUrl) {
    for (let i = targets.length - 1; i >= 0; i--) {
      if (targets[i].stack === 'nextjs') targets.splice(i, 1);
    }
    targets.push({ stack: 'nextjs', config: cfg.nextjs, label: 'nextjs' });
  }

  const frappeList = Array.isArray(cfg.frappe) ? cfg.frappe : (cfg.frappe ? [cfg.frappe] : []);
  const multi = frappeList.length > 1;
  for (const fc of frappeList) {
    const label = multi ? (fc && fc.site ? String(fc.site) : 'frappe') : 'frappe';
    const complete = fc && fc.benchPath && fc.site && Array.isArray(fc.apps) && fc.apps.length > 0;
    if (complete) {
      targets.push({ stack: 'frappe', config: fc, label });
    } else {
      targets.push({ stack: 'frappe', label, notice: true, note: 'needs benchPath, site, apps in testctl.yaml' });
    }
  }
  if (frappeList.length === 0 && hasFrappeMarker(root)) {
    // Detected on disk without config: a non-failing notice, never a runnable target.
    targets.push({ stack: 'frappe', label: 'frappe', notice: true, note: 'needs benchPath, site, apps in testctl.yaml' });
  }

  return onlyStack ? targets.filter((t) => t.stack === onlyStack) : targets;
}
