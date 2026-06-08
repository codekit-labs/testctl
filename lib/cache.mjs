import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const SKIP = new Set([
  'node_modules', '.git', 'build', '.dart_tool', 'ios', 'android', '.next',
  'dist', 'out', 'Pods', 'vendor', '.venv', '__pycache__', 'coverage', '.testctl',
]);

function walkFiles(dir, acc) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (e.name.startsWith('.') || SKIP.has(e.name)) continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) walkFiles(full, acc);
    else if (e.isFile()) acc.push(full);
  }
}

// Impure: sha1 over sorted (relpath + bytes) of source/test files under absPath.
// Returns a hex string, or null if the path is missing.
export function hashApp(absPath) {
  if (!existsSync(absPath)) return null;
  const files = [];
  walkFiles(absPath, files);
  files.sort();
  const h = createHash('sha1');
  for (const f of files) {
    try {
      h.update(relative(absPath, f));
      h.update('\0');
      h.update(readFileSync(f));
      h.update('\0');
    } catch { /* skip unreadable file */ }
  }
  return h.digest('hex');
}

// Pure helpers.
export function appCacheKey(target) { return `${target.stack}:${target.label || target.stack}`; }
export function decideCached(entry, currentHash) {
  return !!(entry && currentHash && entry.hash === currentHash && entry.ok);
}

// Impure best-effort cache I/O at <projectDir>/.testctl/cache.json (self-ignoring folder).
export function loadCache(projectDir) {
  try {
    return JSON.parse(readFileSync(join(projectDir, '.testctl', 'cache.json'), 'utf8')) || {};
  } catch {
    return {};
  }
}
export function saveCache(projectDir, cache) {
  try {
    const tdir = join(projectDir, '.testctl');
    if (!existsSync(tdir)) mkdirSync(tdir, { recursive: true });
    const gi = join(tdir, '.gitignore');
    if (!existsSync(gi)) writeFileSync(gi, '*\n');
    writeFileSync(join(tdir, 'cache.json'), JSON.stringify(cache));
  } catch { /* best-effort */ }
}
