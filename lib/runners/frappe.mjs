import { spawnAsync } from '../spawn.mjs';
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { XMLParser } from 'fast-xml-parser';
import { makeResult } from '../result.mjs';
import { capFailures } from './shared.mjs';
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
  const failures2 = [];
  for (const s of suites) {
    let cases = s.testcase || [];
    cases = Array.isArray(cases) ? cases : [cases];
    for (const c of cases) {
      const fe = c.failure || c.error;
      if (!fe) continue;
      const feArr = Array.isArray(fe) ? fe : [fe];
      const parts = feArr.map((x) => `${x['@_message'] || ''}\n${typeof x === 'string' ? x : x['#text'] || ''}`.trim());
      failures2.push({
        test: `${c['@_classname'] || ''}.${c['@_name'] || ''}`.replace(/^\./, ''),
        file: null, line: null,
        message: parts.join('\n').trim(),
      });
    }
  }
  return { passed, failed, skipped, failures: failures2 };
}

// Recognise known `bench run-tests` failure signatures from captured stdout/stderr, so testctl
// reports an accurate, actionable reason instead of the generic "no JUnit output" guess — which
// otherwise sends the user (or Claude) to manually `cat` the raw log to find out what happened.
// Returns a short message, or null when nothing is recognised (caller uses the generic fallback).
export function classifyFrappeFailure(output) {
  const text = String(output || '');
  if (!text) return null;
  // Most common on a restored PRODUCTION bench: dev/test deps (xmlrunner etc.) aren't installed,
  // so bench refuses to run tests at all. This is one-time bench setup, not a test failure.
  if (/Development dependencies are required|bench setup requirements --dev/i.test(text)) {
    return "bench is missing dev requirements (xmlrunner etc.) — run 'bench setup requirements --dev' on the bench; this is one-time bench setup, not a test failure";
  }
  // Restored site whose encryption_key no longer matches its encrypted fields (e.g. a Connected
  // App / Email Account OAuth secret). Frappe initialises email accounts during test setup, so a
  // single undecryptable secret blocks the whole run. Very common after a backup/restore.
  if (/cryptography\.fernet\.InvalidToken|Encryption key is invalid|Failed to decrypt key/i.test(text)) {
    return 'restored-site encryption-key mismatch — an encrypted field cannot be decrypted (often a Connected App / Email Account OAuth secret). Restore the original `encryption_key` in site_config.json, or clear/disable the affected record on this site. Not a test failure';
  }
  // Frappe auto-creates test masters (e.g. _Test Company) during bootstrap; a mandatory (often
  // custom) field with no value aborts the whole run before any test executes.
  const mand = text.match(/MandatoryError:\s*(.+)/);
  if (mand) {
    return `test bootstrap failed — a mandatory field is unset when Frappe creates its test masters (${mand[1].trim()}). Seed it via a before_tests hook (run /testctl:frappe-bootstrap to generate one), or make the field non-mandatory on the test site. Not a test failure`;
  }
  // A required linked master doesn't exist yet (e.g. _Test Holiday List) when Frappe builds its test
  // masters — surfaces as a LinkValidationError / "Could not find <Doctype>: _Test <Name>". Because
  // this classifier only runs when NO JUnit was produced (a crash before any test executed), a
  // LinkValidationError here is necessarily a bootstrap-time one, not an in-test assertion failure.
  const link = text.match(/Could not find\s+(.+?:\s*_Test [^\n]+)/);
  if (/LinkValidationError/i.test(text) || link) {
    const detail = link ? link[1].trim() : (text.match(/LinkValidationError:\s*(.+)/) || [, ''])[1].trim();
    const suffix = detail ? ` (${detail})` : '';
    return `test bootstrap failed — a required master is missing when Frappe creates its test masters${suffix}. Create it via a before_tests hook (run /testctl:frappe-bootstrap to generate one), or add it to the app's test fixtures. Not a test failure`;
  }
  if (/Site\s+\S+\s+does not exist/i.test(text)) {
    return 'site not found — check `site` in testctl.yaml matches a real bench site';
  }
  return null;
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
  const allFailures = [];
  const appErrors = [];

  const safeName = (v) => v.replace(/[^A-Za-z0-9._-]+/g, '_');
  const units = (Array.isArray(cfg.modules) && cfg.modules.length)
    ? cfg.modules.map((m) => ({ kind: 'module', value: m }))
    : apps.map((a) => ({ kind: 'app', value: a }));

  for (const unit of units) {
    let xmlText = null;
    let unitOut = ''; // captured stdout+stderr for this unit, for failure classification

    if (remote) {
      const remoteXml = `/tmp/testctl-${safeName(unit.value)}.xml`;
      const run = await runSsh(cfg.ssh, buildRemoteBenchCommand(benchPath, site, unit.value, remoteXml, unit.kind));
      if (run.error) {
        appErrors.push(`${unit.value}: ${run.error}`);
        continue;
      }
      unitOut = `${run.proc.stdout || ''}${run.proc.stderr || ''}`;
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
      unitOut = `${proc.stdout || ''}${proc.stderr || ''}`;
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
      allFailures.push(...(r.failures || []));
    } else {
      const specific = classifyFrappeFailure(unitOut);
      appErrors.push(`${unit.value}: ${specific || `no JUnit output (is allow_tests enabled${remote ? ' on the remote site' : ''}?)`}`);
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
    failures: capFailures(allFailures),
  };
  if (appErrors.length) return makeResult({ ...base, errored: true, error: appErrors.join('; ') });
  return makeResult(base);
}
