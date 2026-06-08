import { spawnAsync } from '../spawn.mjs';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeResult } from '../result.mjs';
import { ranButProducedNothing, capFailures } from './shared.mjs';
import { parseLcov } from '../coverage.mjs';

export function parseFlutterJson(output) {
  let passed = 0, failed = 0, skipped = 0;
  const names = new Map();     // id -> name
  const errors = new Map();    // testID -> { error, stackTrace }
  const failures = [];
  for (const line of output.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('{')) continue;
    let ev;
    try { ev = JSON.parse(trimmed); } catch { continue; }
    if (ev.type === 'testStart' && ev.test && !ev.test.hidden) {
      names.set(ev.test.id, ev.test.name);
      continue;
    }
    if (ev.type === 'error' && ev.testID != null) {
      errors.set(ev.testID, { error: ev.error || '', stackTrace: ev.stackTrace || '' });
      continue;
    }
    if (ev.type !== 'testDone' || ev.hidden) continue;
    if (ev.skipped) { skipped += 1; continue; }
    if (ev.result === 'success') { passed += 1; continue; }
    failed += 1;
    const err = errors.get(ev.testID) || { error: '', stackTrace: '' };
    let file = null, lineNo = null;
    const m = /([\w./-]+\.dart)\s+(\d+):\d+/.exec(err.stackTrace || '');
    if (m) { file = m[1]; lineNo = Number(m[2]); }
    failures.push({
      test: names.get(ev.testID) || 'unknown test',
      file, line: lineNo,
      message: `${err.error}\n${err.stackTrace}`.trim(),
    });
  }
  return { passed, failed, skipped, failures };
}

export async function runFlutter(cfg) {
  const start = Date.now();
  const cwd = cfg.path || '.';
  const args = cfg.coverage ? ['test', '--reporter', 'json', '--coverage'] : ['test', '--reporter', 'json'];
  const proc = await spawnAsync('flutter', args, { cwd });

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
  let coverage = null;
  if (cfg.coverage) {
    try {
      const lcovPath = join(cwd, 'coverage', 'lcov.info');
      if (existsSync(lcovPath)) coverage = parseLcov(readFileSync(lcovPath, 'utf8'));
    } catch { coverage = null; }
  }
  return makeResult({
    stack: 'flutter',
    passed: counts.passed,
    failed: counts.failed,
    skipped: counts.skipped,
    durationMs: Date.now() - start,
    rawLogPath: logPath,
    coverage,
    failures: capFailures(counts.failures || []),
  });
}
