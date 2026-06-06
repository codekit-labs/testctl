import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

export function isFlutterDir(dir) {
  const pubspec = join(dir, 'pubspec.yaml');
  if (!existsSync(pubspec)) return false;
  const text = readFileSync(pubspec, 'utf8');
  return /\bsdk:\s*flutter\b/.test(text) || /^\s*flutter:\s*$/m.test(text);
}

function readPkg(dir) {
  const pkgPath = join(dir, 'package.json');
  if (!existsSync(pkgPath)) return null;
  try {
    return JSON.parse(readFileSync(pkgPath, 'utf8'));
  } catch {
    return null;
  }
}

function allDeps(pkg) {
  return { ...(pkg?.dependencies || {}), ...(pkg?.devDependencies || {}) };
}

export function isElectronDir(dir) {
  const pkg = readPkg(dir);
  return !!(pkg && allDeps(pkg).electron);
}

export function isNextDir(dir) {
  const pkg = readPkg(dir);
  return !!(pkg && allDeps(pkg).next);
}

export function isSupabaseDir(dir) {
  return existsSync(join(dir, 'supabase', 'config.toml'));
}

export function hasFrappeMarker(dir, depth = 0) {
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
