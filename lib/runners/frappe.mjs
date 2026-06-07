import { spawnAsync } from '../spawn.mjs';
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

// --- SSH helpers (pure) ---

// Common ssh args (no BatchMode — sshInvocation adds it for key mode only).
export function buildSshArgs(ssh, remoteCommand) {
  const args = ['-o', 'StrictHostKeyChecking=accept-new', '-o', 'ConnectTimeout=10'];
  if (ssh.key) args.push('-i', ssh.key);
  if (ssh.port) args.push('-p', String(ssh.port));
  args.push(ssh.host, remoteCommand);
  return args;
}

export function buildRemoteBenchCommand(benchPath, site, value, xmlPath, kind = 'app') {
  const flag = kind === 'module' ? '--module' : '--app';
  return `cd ${benchPath} && bench --site ${site} run-tests ${flag} ${value} --junit-xml-output ${xmlPath}`;
}

// Local `bench run-tests` argv for one run-unit (an app or a test module).
export function buildLocalBenchArgs({ site, kind, value, xmlPath, coverage }) {
  const flag = kind === 'module' ? '--module' : '--app';
  const args = ['--site', site, 'run-tests', flag, value, '--junit-xml-output', xmlPath];
  if (coverage) args.push('--coverage');
  return args;
}

// Pick ssh (key) vs sshpass -e ssh (password). Pure given an injected env.
export function sshInvocation(ssh, remoteCommand, env = process.env) {
  const base = buildSshArgs(ssh, remoteCommand);
  const usesPassword = ssh.password != null || ssh.passwordEnv != null;
  if (usesPassword) {
    const password = ssh.password != null ? ssh.password : env[ssh.passwordEnv];
    if (!password) return { error: `SSH password not set (export ${ssh.passwordEnv || 'the password'})` };
    return { command: 'sshpass', args: ['-e', 'ssh', ...base], childEnv: { SSHPASS: password } };
  }
  return { command: 'ssh', args: ['-o', 'BatchMode=yes', ...base], childEnv: {} };
}

// Run one ssh command; returns { proc } or { error }.
async function runSsh(ssh, remoteCommand) {
  const inv = sshInvocation(ssh, remoteCommand, process.env);
  if (inv.error) return { error: inv.error };
  const proc = await spawnAsync(inv.command, inv.args, { env: { ...process.env, ...inv.childEnv } });
  return { proc };
}

// Runs `bench run-tests` per app — locally, or on a remote bench when cfg.ssh is set.
export async function runFrappe(cfg) {
  const start = Date.now();
  const { benchPath, site, apps } = cfg;
  if (!benchPath || !site || !Array.isArray(apps) || apps.length === 0) {
    return makeResult({ stack: 'frappe', errored: true, error: 'frappe config requires benchPath, site, and apps[]' });
  }

  const remote = !!cfg.ssh;
  const logDir = mkdtempSync(join(tmpdir(), 'testctl-frappe-'));
  const logPath = join(logDir, 'frappe.log');
  let logBuf = '';
  const totals = { passed: 0, failed: 0, skipped: 0 };
  const appErrors = [];

  const safeName = (v) => v.replace(/[^A-Za-z0-9._-]+/g, '_');
  const units = (Array.isArray(cfg.modules) && cfg.modules.length)
    ? cfg.modules.map((m) => ({ kind: 'module', value: m }))
    : apps.map((a) => ({ kind: 'app', value: a }));

  for (const unit of units) {
    let xmlText = null;

    if (remote) {
      const remoteXml = `/tmp/testctl-${safeName(unit.value)}.xml`;
      const run = await runSsh(cfg.ssh, buildRemoteBenchCommand(benchPath, site, unit.value, remoteXml, unit.kind));
      if (run.error) {
        appErrors.push(`${unit.value}: ${run.error}`);
        continue;
      }
      logBuf += `\n$ ssh ${cfg.ssh.host} (bench run-tests --${unit.kind} ${unit.value})\n${run.proc.stdout || ''}${run.proc.stderr || ''}`;
      if (run.proc.error) {
        const msg = run.proc.error.code === 'ENOENT'
          ? 'sshpass not installed — install it or use key auth'
          : `remote bench failed: ${run.proc.error.message}`;
        appErrors.push(`${unit.value}: ${msg}`);
        continue;
      }
      const cat = await runSsh(cfg.ssh, `cat ${remoteXml}`);
      if (!cat.error && cat.proc && !cat.proc.error && cat.proc.status === 0 && (cat.proc.stdout || '').includes('<testsuite')) {
        xmlText = cat.proc.stdout;
      }
      await runSsh(cfg.ssh, `rm -f ${remoteXml}`); // best-effort cleanup
    } else {
      const xmlPath = join(logDir, `${safeName(unit.value)}.xml`);
      const args = buildLocalBenchArgs({ site, kind: unit.kind, value: unit.value, xmlPath, coverage: cfg.coverage });
      const proc = await spawnAsync('bench', args, { cwd: benchPath });
      logBuf += `\n$ bench ${args.join(' ')}\n${proc.stdout || ''}${proc.stderr || ''}`;
      if (proc.error) {
        appErrors.push(`${unit.value}: failed to run bench: ${proc.error.message}`);
        continue;
      }
      if (existsSync(xmlPath)) xmlText = readFileSync(xmlPath, 'utf8');
    }

    if (xmlText) {
      const r = parseFrappeJUnit(xmlText);
      totals.passed += r.passed;
      totals.failed += r.failed;
      totals.skipped += r.skipped;
    } else {
      appErrors.push(`${unit.value}: no JUnit output (is allow_tests enabled${remote ? ' on the remote site' : ''}?)`);
    }
  }

  writeFileSync(logPath, logBuf);

  let coverage = null;
  if (cfg.coverage && !remote) {
    for (const p of [join(benchPath, 'sites', 'coverage.xml'), join(benchPath, 'coverage.xml')]) {
      try {
        if (existsSync(p)) { coverage = parseCoverageXml(readFileSync(p, 'utf8')); break; }
      } catch {
        coverage = null;
      }
    }
  }

  const base = {
    stack: 'frappe',
    passed: totals.passed,
    failed: totals.failed,
    skipped: totals.skipped,
    durationMs: Date.now() - start,
    rawLogPath: logPath,
    coverage,
  };
  if (appErrors.length) return makeResult({ ...base, errored: true, error: appErrors.join('; ') });
  return makeResult(base);
}
