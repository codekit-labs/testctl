// Dependency-free, language-agnostic symbol scan. Pure functions only.
// These are HINTS (cheap regex, not a parser) — enough to point a skill at the
// untested functions/classes without reading whole files. The skill confirms by
// opening the flagged file. Supports Python, Dart, and JS/TS.

const KEYWORDS = new Set([
  'if', 'for', 'while', 'switch', 'catch', 'return', 'function', 'class', 'async',
  'await', 'new', 'typeof', 'void', 'case', 'do', 'else', 'try', 'super', 'this',
]);

// Map a file path to a scan language, or null if unsupported.
export function langOf(path) {
  const ext = (String(path).match(/\.([a-z0-9]+)$/i) || [])[1] || '';
  if (ext === 'py') return 'py';
  if (ext === 'dart') return 'dart';
  if (['js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs'].includes(ext)) return 'js';
  return null;
}

// Is this path a test file (by name/dir convention)?
export function isTestFile(path) {
  const p = String(path);
  return /(^|[\\/])tests?[\\/]/.test(p)
    || /(^|[\\/])test_\w+\.(py|dart|js|ts)$/.test(p)
    || /[._-](test|spec)\.[a-z]+$/i.test(p)
    || /_test\.(py|dart)$/.test(p);
}

// Pure: extract declared functions/classes from source text. Returns [{ name, line, kind }].
export function extractSymbols(text, lang) {
  const out = [];
  const seen = new Set();
  const push = (name, line, kind) => {
    if (!name || KEYWORDS.has(name) || name.startsWith('_')) return; // skip private/dunder
    const key = `${name}:${line}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ name, line, kind });
  };
  const lines = String(text || '').split('\n');
  lines.forEach((line, i) => {
    const ln = i + 1;
    if (lang === 'py') {
      let m = /^\s*def\s+(\w+)/.exec(line); if (m) push(m[1], ln, 'function');
      m = /^\s*class\s+(\w+)/.exec(line); if (m) push(m[1], ln, 'class');
    } else if (lang === 'js') {
      let m = /^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+(\w+)/.exec(line); if (m) push(m[1], ln, 'function');
      m = /^\s*(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[\w$]+)\s*=>/.exec(line); if (m) push(m[1], ln, 'function');
      m = /^\s*(?:export\s+)?(?:default\s+)?(?:abstract\s+)?class\s+(\w+)/.exec(line); if (m) push(m[1], ln, 'class');
    } else if (lang === 'dart') {
      let m = /^\s*(?:abstract\s+)?class\s+(\w+)/.exec(line); if (m) push(m[1], ln, 'class');
      m = /^\s*(?:[\w<>?,\s]+\s+)?(\w+)\s*\([^;{]*\)\s*(?:async\s*\*?\s*)?(?:\{|=>)/.exec(line);
      if (m) push(m[1], ln, 'function');
    }
  });
  return out;
}

// Pure: which of `symbols` are NOT referenced by name anywhere in the test text(s)?
export function untestedSymbols(symbols, testText) {
  const t = String(testText || '');
  return symbols.filter((s) => !new RegExp(`\\b${s.name}\\b`).test(t));
}
