import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

function detectFlutter(dir) {
  const pubspec = join(dir, 'pubspec.yaml');
  if (!existsSync(pubspec)) return { present: false };
  const text = readFileSync(pubspec, 'utf8');
  // A Flutter (not plain Dart) pubspec depends on the flutter SDK.
  const isFlutter = /\bsdk:\s*flutter\b/.test(text) || /^\s*flutter:\s*$/m.test(text);
  return isFlutter ? { present: true, path: dir } : { present: false };
}

function detectElectron(dir) {
  const pkgPath = join(dir, 'package.json');
  if (!existsSync(pkgPath)) return { present: false };
  let pkg;
  try {
    pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  } catch {
    return { present: false };
  }
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  return deps.electron ? { present: true, path: dir } : { present: false };
}

// Shallow recursive search (max depth 3) for a Frappe app marker.
function hasFrappeMarker(dir, depth = 0) {
  if (depth > 3) return false;
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return false;
  }
  if (entries.includes('hooks.py') || entries.includes('modules.txt')) return true;
  for (const name of entries) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const full = join(dir, name);
    let isDir = false;
    try {
      isDir = statSync(full).isDirectory();
    } catch {
      isDir = false;
    }
    if (isDir && hasFrappeMarker(full, depth + 1)) return true;
  }
  return false;
}

function detectFrappe(dir, config) {
  const cfg = config?.stacks?.frappe;
  if (cfg && cfg.site && Array.isArray(cfg.apps) && cfg.apps.length > 0) {
    return { present: true, config: cfg };
  }
  return hasFrappeMarker(dir) ? { present: true, path: dir } : { present: false };
}

function detectNextjs(dir, config) {
  const cfg = config?.stacks?.nextjs;
  if (cfg) return { present: true, config: cfg };
  const pkgPath = join(dir, 'package.json');
  if (!existsSync(pkgPath)) return { present: false };
  let pkg;
  try {
    pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  } catch {
    return { present: false };
  }
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  return deps.next ? { present: true } : { present: false };
}

function detectSupabase(dir, config) {
  const cfg = config?.stacks?.supabase;
  if (cfg) return { present: true, config: cfg };
  return existsSync(join(dir, 'supabase', 'config.toml')) ? { present: true, path: dir } : { present: false };
}

export function detectStacks(projectDir, config = {}) {
  return {
    frappe: detectFrappe(projectDir, config),
    flutter: detectFlutter(projectDir),
    electron: detectElectron(projectDir),
    nextjs: detectNextjs(projectDir, config),
    supabase: detectSupabase(projectDir, config),
  };
}
