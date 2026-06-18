import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Pure: the persisted shape — only digest-relevant fields.
export function lastRunRecord(results, timestamp) {
  return {
    timestamp,
    results: (results || []).map((r) => ({
      stack: r.stack, label: r.label || r.stack,
      passed: r.passed || 0, failed: r.failed || 0, skipped: r.skipped || 0,
      ok: !!r.ok, errored: !!r.errored, error: r.error || null,
      failures: Array.isArray(r.failures) ? r.failures : [],
    })),
  };
}

// Pure: compact human digest of a stored record.
export function formatDigest(record) {
  if (!record || !Array.isArray(record.results) || record.results.length === 0) {
    return 'No run recorded yet — run `testctl run` first.';
  }
  const lines = ['testctl digest (last run)', '─────────────────────────'];
  let totalFail = 0, redStacks = 0;
  for (const r of record.results) {
    const mark = r.errored ? '⚠' : (r.failed > 0 ? '✗' : '✓');
    if (r.failed > 0 || r.errored) redStacks++;
    lines.push(`  ${mark} ${r.stack}${r.label && r.label !== r.stack ? ` (${r.label})` : ''} — ${r.passed}P/${r.failed}F/${r.skipped}S${r.errored ? `  [${r.error || 'errored'}]` : ''}`);
    for (const f of r.failures || []) {
      totalFail++;
      const msg = (f.message || '').split('\n')[0];
      lines.push(`      ✗ ${f.test || 'unknown'}${f.file ? ` (${f.file})` : ''} — ${msg}`);
    }
  }
  lines.push(totalFail === 0 && redStacks === 0
    ? 'All recorded stacks were green.'
    : `${totalFail} failing test(s) across ${redStacks} stack(s). (recalled, not re-run)`);
  return lines.join('\n');
}

// Impure best-effort I/O at <projectDir>/.testctl/last-run.json (self-ignoring folder).
export function saveLastRun(projectDir, results, timestamp) {
  try {
    const tdir = join(projectDir, '.testctl');
    if (!existsSync(tdir)) mkdirSync(tdir, { recursive: true });
    const gi = join(tdir, '.gitignore');
    if (!existsSync(gi)) writeFileSync(gi, '*\n');
    writeFileSync(join(tdir, 'last-run.json'), JSON.stringify(lastRunRecord(results, timestamp)));
  } catch { /* best-effort */ }
}
export function loadLastRun(projectDir) {
  try {
    return JSON.parse(readFileSync(join(projectDir, '.testctl', 'last-run.json'), 'utf8')) || null;
  } catch {
    return null;
  }
}
