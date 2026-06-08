import { spawnAsync } from '../spawn.mjs';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeResult } from '../result.mjs';
import { ranButProducedNothing, capFailures } from './shared.mjs';

// Pure: parse pgTAP / TAP output into pass/fail/skip counts.
export function parseTap(tap) {
  let passed = 0, failed = 0, skipped = 0;
  const failures = [];
  let current = null; // the most recent failure, to attach diagnostics
  for (const line of tap.split('\n')) {
    const t = line.trim();
    const isDirective = /#\s*(skip|todo)\b/i.test(t);
    if (/^ok\b/.test(t)) {
      current = null;
      if (isDirective) skipped += 1; else passed += 1;
    } else if (/^not ok\b/.test(t)) {
      if (isDirective) { skipped += 1; current = null; continue; }
      failed += 1;
      const desc = (t.replace(/^not ok\s*\d*\s*-?\s*/, '') || 'unnamed test').trim();
      current = { test: desc, file: null, line: null, message: t };
      failures.push(current);
    } else if (current && t.startsWith('#')) {
      current.message += `\n${t}`;
    } else if (t === '') {
      // keep current; blank lines don't end a diagnostic block
    } else {
      current = null;
    }
  }
  return { passed, failed, skipped, failures };
}

// Runs `supabase test db` (pgTAP) and parses the TAP output.
export async function runSupabase(cfg) {
  const start = Date.now();
  const cwd = cfg.path || '.';
  const proc = await spawnAsync('supabase', ['test', 'db'], { cwd });

  const logDir = mkdtempSync(join(tmpdir(), 'testctl-supabase-'));
  const logPath = join(logDir, 'supabase.log');
  const logBuf = `$ supabase test db (cwd: ${cwd})\n${proc.stdout || ''}${proc.stderr || ''}`;
  writeFileSync(logPath, logBuf);

  if (proc.error) {
    const msg = proc.error.code === 'ENOENT'
      ? "supabase CLI not found — install it and run 'supabase start'"
      : `failed to run supabase: ${proc.error.message}`;
    return makeResult({ stack: 'supabase', errored: true, error: msg, rawLogPath: logPath });
  }

  const counts = parseTap(proc.stdout || '');
  if (ranButProducedNothing(proc.status, counts)) {
    return makeResult({ stack: 'supabase', errored: true, error: "supabase test db produced no results — is 'supabase start' running?", rawLogPath: logPath });
  }
  return makeResult({
    stack: 'supabase',
    passed: counts.passed,
    failed: counts.failed,
    skipped: counts.skipped,
    durationMs: Date.now() - start,
    rawLogPath: logPath,
    failures: capFailures(counts.failures || []),
  });
}
