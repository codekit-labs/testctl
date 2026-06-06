import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { XMLParser } from 'fast-xml-parser';
import { makeResult } from '../result.mjs';
import { parseCoverageXml } from '../coverage.mjs';

export function parseFrappeJUnit(xml) {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
  const doc = parser.parse(xml);

  let suites = [];
  if (doc.testsuites && doc.testsuites.testsuite) {
    suites = Array.isArray(doc.testsuites.testsuite) ? doc.testsuites.testsuite : [doc.testsuites.testsuite];
  } else if (doc.testsuite) {
    suites = Array.isArray(doc.testsuite) ? doc.testsuite : [doc.testsuite];
  }

  let tests = 0, failures = 0, errors = 0, skipped = 0;
  for (const s of suites) {
    tests += Number(s['@_tests'] || 0);
    failures += Number(s['@_failures'] || 0);
    errors += Number(s['@_errors'] || 0);
    skipped += Number(s['@_skipped'] || 0);
  }
  const failed = failures + errors;
  const passed = Math.max(0, tests - failed - skipped);
  return { passed, failed, skipped };
}

// Runs `bench run-tests` per app with JUnit XML output, summing results. Each app
// runs independently: one app failing to produce output does not abort the others;
// partial counts are preserved and the failures are reported together.
export function runFrappe(cfg) {
  const start = Date.now();
  const { benchPath, site, apps } = cfg;
  if (!benchPath || !site || !Array.isArray(apps) || apps.length === 0) {
    return makeResult({ stack: 'frappe', errored: true, error: 'frappe config requires benchPath, site, and apps[]' });
  }

  const logDir = mkdtempSync(join(tmpdir(), 'testctl-frappe-'));
  const logPath = join(logDir, 'frappe.log');
  let logBuf = '';
  const totals = { passed: 0, failed: 0, skipped: 0 };
  const appErrors = [];

  for (const app of apps) {
    const xmlPath = join(logDir, `${app}.xml`);
    const args = ['--site', site, 'run-tests', '--app', app, '--junit-xml-output', xmlPath];
    if (cfg.coverage) args.push('--coverage');
    const proc = spawnSync('bench', args, { cwd: benchPath, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    logBuf += `\n$ bench ${args.join(' ')}\n${proc.stdout || ''}${proc.stderr || ''}`;

    if (proc.error) {
      appErrors.push(`${app}: failed to run bench: ${proc.error.message}`);
      continue;
    }
    if (existsSync(xmlPath)) {
      const r = parseFrappeJUnit(readFileSync(xmlPath, 'utf8'));
      totals.passed += r.passed;
      totals.failed += r.failed;
      totals.skipped += r.skipped;
    } else {
      appErrors.push(`${app}: no JUnit output (is allow_tests enabled for the site?)`);
    }
  }

  writeFileSync(logPath, logBuf);

  if (appErrors.length) {
    return makeResult({
      stack: 'frappe',
      passed: totals.passed,
      failed: totals.failed,
      skipped: totals.skipped,
      durationMs: Date.now() - start,
      rawLogPath: logPath,
      errored: true,
      error: appErrors.join('; '),
    });
  }
  let coverage = null;
  if (cfg.coverage) {
    for (const p of [join(benchPath, 'sites', 'coverage.xml'), join(benchPath, 'coverage.xml')]) {
      try {
        if (existsSync(p)) { coverage = parseCoverageXml(readFileSync(p, 'utf8')); break; }
      } catch { coverage = null; }
    }
  }
  return makeResult({
    stack: 'frappe',
    passed: totals.passed,
    failed: totals.failed,
    skipped: totals.skipped,
    durationMs: Date.now() - start,
    rawLogPath: logPath,
    coverage,
  });
}
