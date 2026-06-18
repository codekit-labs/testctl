import { spawnAsync } from '../spawn.mjs';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeResult } from '../result.mjs';
import { ranButProducedNothing, capFailures } from './shared.mjs';
import { parseFlutterJson } from './flutter.mjs';

// Build argv for an e2e run. `cfg.command` (array or string) overrides.
// Otherwise pick by `cfg.framework`:
//   'playwright'          → npx playwright test --reporter=json
//   'flutter-integration' → flutter test integration_test --machine
export function buildE2eArgv(cfg) {
  if (Array.isArray(cfg.command) && cfg.command.length) return cfg.command;
  if (typeof cfg.command === 'string' && cfg.command.trim()) return cfg.command.trim().split(/\s+/);
  if (cfg.framework === 'flutter-integration') {
    return ['flutter', 'test', 'integration_test', '--machine'];
  }
  return ['npx', 'playwright', 'test', '--reporter=json'];
}

// Parse Playwright's `json` reporter output (pure). Counts come from the stable top-level `stats`:
//   passed = expected + flaky  (flaky = failed-then-passed-on-retry; ultimately passed, so counted as passed)
//   failed = unexpected, skipped = skipped
// failures[] walks suites[] recursively → each spec with ok === false. Throws on unparseable JSON.
export function parsePlaywrightJson(output) {
  const firstBrace = output.indexOf('{');
  const lastBrace = output.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1) {
    throw new Error('no JSON object found in Playwright output');
  }
  const data = JSON.parse(output.slice(firstBrace, lastBrace + 1));
  const stats = data.stats || {};
  const failures = [];
  const walk = (suites) => {
    for (const suite of suites || []) {
      for (const spec of suite.specs || []) {
        if (spec.ok === false) {
          let message = '';
          for (const t of spec.tests || []) {
            for (const res of t.results || []) {
              if (res.error && res.error.message) { message = res.error.message; break; }
            }
            if (message) break;
          }
          failures.push({
            test: spec.title || 'unknown test',
            file: suite.file || null,
            line: spec.line ?? null,
            message: (message.split('\n')[0] || '').trim(),
          });
        }
      }
      walk(suite.suites);
    }
  };
  walk(data.suites);
  return {
    passed: Number(stats.expected || 0) + Number(stats.flaky || 0),
    failed: Number(stats.unexpected || 0),
    skipped: Number(stats.skipped || 0),
    failures,
  };
}

export async function runE2e(cfg) {
  const start = Date.now();
  const cwd = cfg.path || '.';
  const framework = cfg.framework || 'playwright';
  const label = cfg.label || 'e2e';
  const [command, ...args] = buildE2eArgv({ framework, command: cfg.command });
  const proc = await spawnAsync(command, args, { cwd });

  const logDir = mkdtempSync(join(tmpdir(), 'testctl-e2e-'));
  const logPath = join(logDir, 'e2e.log');
  let logBuf = `$ ${command} ${args.join(' ')} (cwd: ${cwd})\n${proc.stdout || ''}${proc.stderr || ''}`;

  if (proc.error && proc.error.code !== 'ENOBUFS') {
    writeFileSync(logPath, logBuf);
    return makeResult({ stack: 'e2e', label, errored: true, error: `failed to run ${command}: ${proc.error.message}`, rawLogPath: logPath });
  }
  if (proc.error && proc.error.code === 'ENOBUFS') logBuf += '\n[testctl] output truncated at maxBuffer\n';
  writeFileSync(logPath, logBuf);

  let counts;
  try {
    counts = framework === 'flutter-integration'
      ? parseFlutterJson(proc.stdout || '')
      : parsePlaywrightJson(proc.stdout || '');
  } catch (e) {
    return makeResult({ stack: 'e2e', label, errored: true, error: e.message, rawLogPath: logPath });
  }
  if (ranButProducedNothing(proc.status, counts)) {
    return makeResult({ stack: 'e2e', label, errored: true, error: `${command} exited ${proc.status} with no test results`, rawLogPath: logPath });
  }
  return makeResult({
    stack: 'e2e', label,
    passed: counts.passed, failed: counts.failed, skipped: counts.skipped,
    durationMs: Date.now() - start, rawLogPath: logPath, coverage: null,
    failures: capFailures(counts.failures || []),
  });
}
