import { spawnAsync } from '../spawn.mjs';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeResult } from '../result.mjs';
import { ranButProducedNothing, capFailures, parseJestJson } from './shared.mjs';
import { parseJestCoverageSummary } from '../coverage.mjs';

// Build argv for a web (React/Vue) unit-test run. `cfg.command` (array or string) overrides.
// Otherwise pick by `cfg.runner`: 'vitest' → `vitest run --reporter=json`, else `jest --json`.
// Both emit jest-shaped JSON (parsed by parseJestJson).
export function buildWebArgv(cfg) {
  if (Array.isArray(cfg.command) && cfg.command.length) return cfg.command;
  if (typeof cfg.command === 'string' && cfg.command.trim()) return cfg.command.trim().split(/\s+/);
  if (cfg.runner === 'vitest') {
    return cfg.coverage
      ? ['npx', 'vitest', 'run', '--reporter=json', '--coverage', '--coverage.reporter=json-summary']
      : ['npx', 'vitest', 'run', '--reporter=json'];
  }
  return cfg.coverage
    ? ['npx', 'jest', '--json', '--coverage', '--coverageReporters=json-summary']
    : ['npx', 'jest', '--json'];
}

export async function runWeb(cfg) {
  const start = Date.now();
  const cwd = cfg.path || '.';
  const label = cfg.label || 'web';
  const runnerName = cfg.runner || 'jest';
  const [command, ...args] = buildWebArgv(cfg);
  const proc = await spawnAsync(command, args, { cwd });

  const logDir = mkdtempSync(join(tmpdir(), 'testctl-web-'));
  const logPath = join(logDir, 'web.log');
  let logBuf = `$ ${command} ${args.join(' ')} (cwd: ${cwd})\n${proc.stdout || ''}${proc.stderr || ''}`;

  if (proc.error && proc.error.code !== 'ENOBUFS') {
    writeFileSync(logPath, logBuf);
    return makeResult({ stack: 'web', label, errored: true, error: `failed to run ${runnerName}: ${proc.error.message}`, rawLogPath: logPath });
  }
  if (proc.error && proc.error.code === 'ENOBUFS') logBuf += '\n[testctl] output truncated at maxBuffer\n';
  writeFileSync(logPath, logBuf);

  let counts;
  try {
    counts = parseJestJson(proc.stdout || '');
  } catch (e) {
    return makeResult({ stack: 'web', label, errored: true, error: e.message, rawLogPath: logPath });
  }
  if (ranButProducedNothing(proc.status, counts)) {
    return makeResult({ stack: 'web', label, errored: true, error: `${runnerName} exited ${proc.status} with no test results`, rawLogPath: logPath });
  }
  let coverage = null;
  if (cfg.coverage && !cfg.command) {
    try {
      const sumPath = join(cwd, 'coverage', 'coverage-summary.json');
      if (existsSync(sumPath)) coverage = parseJestCoverageSummary(readFileSync(sumPath, 'utf8'));
    } catch { coverage = null; }
  }
  return makeResult({
    stack: 'web', label,
    passed: counts.passed, failed: counts.failed, skipped: counts.skipped,
    durationMs: Date.now() - start, rawLogPath: logPath, coverage,
    failures: capFailures(counts.failures || []),
  });
}
