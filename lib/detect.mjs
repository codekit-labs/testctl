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

export function isWebDir(dir) {
  const pkg = readPkg(dir);
  if (!pkg) return false;
  const deps = allDeps(pkg);
  if (deps.next || deps.electron) return false; // those keep their own runners
  const hasRunner = !!(deps.vitest || deps.jest);
  const hasFramework = !!(deps.react || deps['react-dom'] || deps.vue ||
    deps['@vue/test-utils'] || deps['@testing-library/react']);
  return hasRunner && hasFramework;
}

export function webRunner(dir) {
  const deps = allDeps(readPkg(dir) || {});
  return deps.vitest ? 'vitest' : 'jest';
}

export function webFramework(dir) {
  const deps = allDeps(readPkg(dir) || {});
  if (deps.react || deps['react-dom'] || deps['@testing-library/react']) return 'react';
  if (deps.vue || deps['@vue/test-utils']) return 'vue';
  return 'web';
}

function hasPlaywrightConfig(dir) {
  return existsSync(join(dir, 'playwright.config.ts')) ||
    existsSync(join(dir, 'playwright.config.js')) ||
    existsSync(join(dir, 'playwright.config.mjs'));
}

function hasFlutterIntegration(dir) {
  if (!existsSync(join(dir, 'pubspec.yaml'))) return false;
  try {
    return statSync(join(dir, 'integration_test')).isDirectory();
  } catch {
    return false;
  }
}

export function isE2eDir(dir) {
  const deps = allDeps(readPkg(dir) || {});
  if (deps['@playwright/test'] || hasPlaywrightConfig(dir)) return true;
  return hasFlutterIntegration(dir);
}

// 'playwright' wins if both present (documented).
export function e2eFramework(dir) {
  const deps = allDeps(readPkg(dir) || {});
  if (deps['@playwright/test'] || hasPlaywrightConfig(dir)) return 'playwright';
  if (hasFlutterIntegration(dir)) return 'flutter-integration';
  return 'playwright';
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
