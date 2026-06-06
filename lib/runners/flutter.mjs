import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeResult } from '../result.mjs';
import { ranButProducedNothing } from './shared.mjs';

export function parseFlutterJson(output) {
  let passed = 0, failed = 0, skipped = 0;
  for (const line of output.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('{')) continue;
    let ev;
    try {
      ev = JSON.parse(trimmed);
    } catch {
      continue;
    }
    if (ev.type !== 'testDone' || ev.hidden) continue;
    if (ev.skipped) skipped += 1;
    else if (ev.result === 'success') passed += 1;
    else failed += 1; // failure or error
  }
  return { passed, failed, skipped };
}

export function runFlutter(cfg) {
  const start = Date.now();
  const cwd = cfg.path || '.';
  const args = ['test', '--reporter', 'json'];
  const proc = spawnSync('flutter', args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

  const logDir = mkdtempSync(join(tmpdir(), 'testctl-flutter-'));
  const logPath = join(logDir, 'flutter.log');
  let logBuf = `$ flutter ${args.join(' ')} (cwd: ${cwd})\n${proc.stdout || ''}${proc.stderr || ''}`;

  if (proc.error && proc.error.code !== 'ENOBUFS') {
    writeFileSync(logPath, logBuf);
    return makeResult({ stack: 'flutter', errored: true, error: `failed to run flutter: ${proc.error.message}`, rawLogPath: logPath });
  }
  if (proc.error && proc.error.code === 'ENOBUFS') {
    logBuf += '\n[testctl] output truncated at maxBuffer\n';
  }
  writeFileSync(logPath, logBuf);

  const counts = parseFlutterJson(proc.stdout || '');
  if (ranButProducedNothing(proc.status, counts)) {
    return makeResult({ stack: 'flutter', errored: true, error: `flutter exited ${proc.status} with no test results`, rawLogPath: logPath });
  }
  return makeResult({
    stack: 'flutter',
    passed: counts.passed,
    failed: counts.failed,
    skipped: counts.skipped,
    durationMs: Date.now() - start,
    rawLogPath: logPath,
  });
}
