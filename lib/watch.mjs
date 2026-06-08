import { watch } from 'node:fs';

const IGNORE = ['node_modules', '.git', 'build', '.dart_tool', '.next', 'dist', 'out', 'Pods', 'vendor', '.venv', '__pycache__', 'coverage', '.testctl'];

// Pure: should a changed path (relative, as fs.watch reports) trigger a re-run?
export function isWatchableChange(filename) {
  if (!filename) return false;
  const parts = String(filename).split(/[\\/]/);
  if (parts.some((p) => IGNORE.includes(p))) return false;
  return true;
}

// Impure: watch dir recursively, debounce, call onChange() for watchable changes. Returns the watcher.
export function watchProject(dir, onChange, { debounceMs = 300 } = {}) {
  let timer = null;
  return watch(dir, { recursive: true }, (_event, filename) => {
    if (!isWatchableChange(filename)) return;
    clearTimeout(timer);
    timer = setTimeout(onChange, debounceMs);
  });
}
