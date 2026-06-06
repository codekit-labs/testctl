import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeResult } from '../result.mjs';
import { ranButProducedNothing } from './shared.mjs';

// Pure: parse pgTAP / TAP output into pass/fail/skip counts.
export function parseTap(tap) {
  let passed = 0, failed = 0, skipped = 0;
  for (const line of tap.split('\n')) {
    const t = line.trim();
    // SKIP and TODO are TAP directives: a SKIP'd test or a TODO (expected-to-fail)
    // test is not a real pass/fail — bucket both as skipped regardless of ok/not ok.
    const isDirective = /#\s*(skip|todo)\b/i.test(t);
    if (/^ok\b/.test(t)) {
      if (isDirective) skipped += 1; else passed += 1;
    } else if (/^not ok\b/.test(t)) {
      if (isDirective) skipped += 1; else failed += 1;
    }
  }
  return { passed, failed, skipped };
}

// Runs `supabase test db` (pgTAP) and parses the TAP output.
export function runSupabase(cfg) {
  const start = Date.now();
  const cwd = cfg.path || '.';
  const proc = spawnSync('supabase', ['test', 'db'], { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

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
  });
}
