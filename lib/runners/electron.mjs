import { spawnAsync } from '../spawn.mjs';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeResult } from '../result.mjs';
import { ranButProducedNothing } from './shared.mjs';
import { parseJestCoverageSummary } from '../coverage.mjs';

export function parseJestJson(output) {
  // Jest may emit log lines before the JSON; grab the last top-level {...} block.
  const firstBrace = output.indexOf('{');
  const lastBrace = output.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1) {
    throw new Error('no JSON object found in jest output');
  }
  const data = JSON.parse(output.slice(firstBrace, lastBrace + 1));
  return {
    passed: Number(data.numPassedTests || 0),
    failed: Number(data.numFailedTests || 0),
    skipped: Number(data.numPendingTests || 0),
  };
}

// Build the argv for the test command. Defaults to `npx jest --json`. A user may
// override via cfg.command, given as a full argv array (preferred) or a
// space-separated string. The override must still emit jest-style JSON on stdout.
export function buildElectronArgv(cfg) {
  if (Array.isArray(cfg.command) && cfg.command.length) return cfg.command;
  if (typeof cfg.command === 'string' && cfg.command.trim()) return cfg.command.trim().split(/\s+/);
  return cfg.coverage
    ? ['npx', 'jest', '--json', '--coverage', '--coverageReporters=json-summary']
    : ['npx', 'jest', '--json'];
}

export async function runElectron(cfg) {
  const start = Date.now();
  const cwd = cfg.path || '.';
  const [command, ...args] = buildElectronArgv(cfg);
  const proc = await spawnAsync(command, args, { cwd });

  const logDir = mkdtempSync(join(tmpdir(), 'testctl-electron-'));
  const logPath = join(logDir, 'electron.log');
  let logBuf = `$ ${command} ${args.join(' ')} (cwd: ${cwd})\n${proc.stdout || ''}${proc.stderr || ''}`;

  if (proc.error && proc.error.code !== 'ENOBUFS') {
    writeFileSync(logPath, logBuf);
    return makeResult({ stack: 'electron', errored: true, error: `failed to run jest: ${proc.error.message}`, rawLogPath: logPath });
  }
  if (proc.error && proc.error.code === 'ENOBUFS') {
    logBuf += '\n[testctl] output truncated at maxBuffer\n';
  }
  writeFileSync(logPath, logBuf);

  let counts;
  try {
    counts = parseJestJson(proc.stdout || '');
  } catch (e) {
    return makeResult({ stack: 'electron', errored: true, error: e.message, rawLogPath: logPath });
  }
  if (ranButProducedNothing(proc.status, counts)) {
    return makeResult({ stack: 'electron', errored: true, error: `jest exited ${proc.status} with no test results`, rawLogPath: logPath });
  }
  let coverage = null;
  if (cfg.coverage && !cfg.command) {
    try {
      const sumPath = join(cwd, 'coverage', 'coverage-summary.json');
      if (existsSync(sumPath)) coverage = parseJestCoverageSummary(readFileSync(sumPath, 'utf8'));
    } catch { coverage = null; }
  }
  return makeResult({
    stack: 'electron',
    passed: counts.passed,
    failed: counts.failed,
    skipped: counts.skipped,
    durationMs: Date.now() - start,
    rawLogPath: logPath,
    coverage,
  });
}
