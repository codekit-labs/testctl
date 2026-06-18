import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { isFlutterDir, isElectronDir, isSupabaseDir, isNextDir, hasFrappeMarker, isWebDir, webRunner, webFramework, isE2eDir, e2eFramework } from './detect.mjs';

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
  const web = isWebDir(dir);
  const e2e = isE2eDir(dir);
  if (pathStacks.length || isNext || web || e2e) {
    for (const stack of pathStacks) acc.push({ stack, dir });
    if (isNext) acc.push({ stack: 'nextjs', dir });
    if (web) acc.push({ stack: 'web', dir, runner: webRunner(dir), framework: webFramework(dir) });
    if (e2e) acc.push({ stack: 'e2e', dir, framework: e2eFramework(dir) });
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
    } else if (f.stack === 'web') {
      targets.push({ stack: 'web', path: f.dir, label: lbl || f.framework || 'web', runner: f.runner });
    } else if (f.stack === 'e2e') {
      const fwLabel = f.framework === 'flutter-integration' ? 'flutter' : f.framework;
      targets.push({ stack: 'e2e', path: f.dir, label: lbl ? `${lbl} (e2e ${fwLabel})` : `e2e (${fwLabel})`, framework: f.framework });
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

  if (cfg.web && cfg.web.path) {
    for (let i = targets.length - 1; i >= 0; i--) {
      if (targets[i].stack === 'web') targets.splice(i, 1);
    }
    targets.push({ stack: 'web', path: cfg.web.path, label: 'web', runner: cfg.web.runner || 'jest', command: cfg.web.command });
  }

  if (cfg.e2e && (cfg.e2e.path || cfg.e2e.command)) {
    for (let i = targets.length - 1; i >= 0; i--) {
      if (targets[i].stack === 'e2e') targets.splice(i, 1);
    }
    targets.push({
      stack: 'e2e',
      path: cfg.e2e.path || '.',
      label: 'e2e',
      framework: cfg.e2e.framework || 'playwright',
      command: cfg.e2e.command,
    });
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
    targets.push({ stack: 'frappe', label: 'frappe', notice: true, dir: root, note: 'needs benchPath, site, apps in testctl.yaml' });
  }

  return onlyStack ? targets.filter((t) => t.stack === onlyStack) : targets;
}
