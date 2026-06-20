#!/usr/bin/env node
import { writeFileSync, existsSync, readFileSync, mkdirSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve, relative } from 'node:path';
import { loadConfig } from '../lib/config.mjs';
import { frappePreflight, formatPreflight, frappePointer } from '../lib/preflight.mjs';
import { discoverTargets } from '../lib/discover.mjs';
import { mapPool } from '../lib/pool.mjs';
import { historyEntry, appendHistory, summarize, formatHistoryReport } from '../lib/history.mjs';
import { saveLastRun, loadLastRun, formatDigest } from '../lib/lastrun.mjs';
import { parseFirstBadCommit, buildBisectCriterion, formatBisectResult } from '../lib/bisect.mjs';
import { computeTrend, formatTrend } from '../lib/trend.mjs';
import { homedir } from 'node:os';
import { buildInitYaml, scanProject } from '../lib/init.mjs';
import { buildWorkflowYaml, buildGitlabYaml } from '../lib/ci.mjs';
import { runDoctor, formatDoctor } from '../lib/doctor.mjs';
import { makeResult } from '../lib/result.mjs';
import { formatReport, computeExitCode } from '../lib/report.mjs';
import { gitChangedFiles, selectChangedTargets, unconfiguredChangedNote, gitChangedLineRanges } from '../lib/changed.mjs';
import { toJUnitXml, toSarif, toHtml, toMarkdown } from '../lib/export.mjs';
import { shouldRetry } from '../lib/retry.mjs';
import { groupFailures, formatExplain } from '../lib/explain.mjs';
import { buildNotifyPayload, postWebhook } from '../lib/notify.mjs';
import { redactNotifyPayload } from '../lib/redact.mjs';
import { watchProject } from '../lib/watch.mjs';
import { applyCoverageGate, resolveThreshold } from '../lib/coverage.mjs';
import { parseLcovLines, parseDiffRanges, patchCoverage, formatPatchCoverage } from '../lib/diffcov.mjs';
import { langOf, isTestFile, extractSymbols, untestedSymbols } from '../lib/symbols.mjs';
import { formatContext } from '../lib/context.mjs';
import { runFrappe } from '../lib/runners/frappe.mjs';
import { runFlutter } from '../lib/runners/flutter.mjs';
import { runElectron } from '../lib/runners/electron.mjs';
import { runNextjs } from '../lib/runners/nextjs.mjs';
import { runSupabase } from '../lib/runners/supabase.mjs';
import { runWeb } from '../lib/runners/web.mjs';
import { runE2e } from '../lib/runners/e2e.mjs';
import { hashApp, appCacheKey, decideCached, loadCache, saveCache } from '../lib/cache.mjs';

const STACKS = ['frappe', 'flutter', 'electron', 'nextjs', 'supabase', 'web', 'e2e'];

function cmdInit(projectDir, { ci = false } = {}) {
  const path = join(projectDir, 'testctl.yaml');
  if (existsSync(path)) {
    console.log('testctl.yaml already exists — leaving it untouched.');
  } else {
    const detection = scanProject(projectDir, homedir());
    writeFileSync(path, buildInitYaml(detection));
    const a = detection.auto;
    console.log(`Created ${path}`);
    console.log(`  auto-detected: ${a.flutter} flutter, ${a.electron} electron, ${a.supabase} supabase, ${detection.nextjs} nextjs`);
    if (detection.frappe) {
      console.log(`  frappe app: ${detection.frappe.apps.join(', ')} (bench: ${detection.frappe.benchPath || 'not found — set benchPath'})`);
    }
    console.log('  Fill any <FILL-ME> values, then run: testctl run');
  }
  if (ci === 'gitlab') {
    const wfPath = join(projectDir, '.gitlab-ci.yml');
    if (existsSync(wfPath)) {
      console.log('.gitlab-ci.yml already exists — leaving it untouched.');
    } else {
      writeFileSync(wfPath, buildGitlabYaml());
      console.log(`Created ${wfPath}`);
    }
  } else if (ci) {
    const wfDir = join(projectDir, '.github', 'workflows');
    const wfPath = join(wfDir, 'testctl.yml');
    if (existsSync(wfPath)) {
      console.log('.github/workflows/testctl.yml already exists — leaving it untouched.');
    } else {
      mkdirSync(wfDir, { recursive: true });
      writeFileSync(wfPath, buildWorkflowYaml());
      console.log(`Created ${wfPath}`);
    }
  }
  return 0;
}

async function runTarget(target, coverage = false) {
  if (target.notice) {
    return makeResult({ stack: target.stack, present: true, label: target.label, note: target.note });
  }
  let result;
  if (target.stack === 'frappe') {
    result = runFrappe({ ...(target.config || {}), coverage });
  } else if (target.stack === 'flutter') {
    result = runFlutter({ path: target.path, coverage });
  } else if (target.stack === 'electron') {
    result = runElectron({ path: target.path, coverage });
  } else if (target.stack === 'nextjs') {
    result = runNextjs(target.config || {});
  } else if (target.stack === 'supabase') {
    result = runSupabase({ path: target.path });
  } else if (target.stack === 'web') {
    result = runWeb({ path: target.path, coverage, runner: target.runner, command: target.command, label: target.label });
  } else if (target.stack === 'e2e') {
    result = runE2e({ path: target.path, framework: target.framework, command: target.command, label: target.label });
  } else {
    result = makeResult({ stack: target.stack, errored: true, error: `unknown stack ${target.stack}` });
  }
  result = await result;
  result.label = target.label || result.stack;
  return result;
}

async function cmdRun(projectDir, only, coverage = false, concurrency = 4, minCoverage = null, changed = null, quiet = false, cache = false, junitPath = null, sarifPath = null, retries = null, htmlPath = null, notifyUrl = null, mdPath = null, changedCoverageMin = null) {
  const config = loadConfig(projectDir);
  let gate = minCoverage;
  if (gate == null && config.coverageMin != null) gate = config.coverageMin;
  if (typeof gate === 'number' && Number.isNaN(gate)) gate = null;
  if (gate != null) coverage = true;
  let patchGate = changedCoverageMin;
  if (patchGate == null && config.changedCoverageMin != null) patchGate = Number(config.changedCoverageMin);
  if (typeof patchGate === 'number' && Number.isNaN(patchGate)) patchGate = null;
  if (changed && patchGate != null) coverage = true;
  const useCache = cache || config.cache === true;
  if (retries == null) retries = config.retry != null ? Number(config.retry) : 0;
  if (Number.isNaN(retries) || retries < 0) retries = 0;
  let targets = discoverTargets(projectDir, config, only);

  let changedDiffText = '';
  if (changed) {
    const targetDirs = targets
      .map((t) => (t.path ? resolve(projectDir, t.path) : t.dir ? resolve(t.dir) : (t.config && t.config.benchPath) ? resolve(t.config.benchPath) : null))
      .filter(Boolean);
    const { files, note } = gitChangedFiles(projectDir, changed.ref, targetDirs);
    changedDiffText = gitChangedLineRanges(projectDir, changed.ref, targetDirs);
    if (note) console.log(note);
    if (files) {
      const nudge = unconfiguredChangedNote(targets, files);
      if (nudge) console.log(nudge);
      targets = selectChangedTargets(targets, files, projectDir);
      if (targets.length === 0) {
        console.log('No changed apps to test.');
        console.log('TESTCTL_JSON ' + JSON.stringify({ results: [], failedLogs: [] }));
        console.log('Exit code: 0');
        return 0;
      }
    }
  }

  const cacheStore = useCache ? loadCache(projectDir) : {};
  const hashByKey = {};
  const decisions = targets.map((t) => {
    if (useCache && t.path && !t.notice) {
      const h = hashApp(resolve(projectDir, t.path));
      hashByKey[appCacheKey(t)] = h;
      if (decideCached(cacheStore[appCacheKey(t)], h)) return { t, cached: true };
    }
    return { t, cached: false };
  });

  if (!quiet) {
    if (targets.length === 0) {
      console.log('No testable apps found.');
    } else {
      console.log('Discovered apps:');
      for (const d of decisions) {
        const t = d.t;
        const name = t.label && t.label !== t.stack ? `${t.stack} (${t.label})` : t.stack;
        const marker = d.cached ? '✓' : t.notice ? '⚠' : '•';
        const suffix = d.cached ? ' cached' : t.notice ? ' — ' + t.note : '';
        console.log(`  ${marker} ${name}${suffix}`);
      }
    }
    const runnable = decisions.filter((d) => !d.cached && !d.t.notice).length;
    if (runnable > 0) console.log(`\n▶ Running ${runnable} app(s) (concurrency ${concurrency})...`);
  }

  const toRun = decisions.filter((d) => !d.cached).map((d) => d.t);
  const ran = await mapPool(toRun, concurrency, async (t) => {
    const runOnce = async () => {
      try {
        return await runTarget(t, coverage);
      } catch (e) {
        return makeResult({ stack: t.stack, label: t.label, errored: true, error: String(e) });
      }
    };
    let result = await runOnce();
    let attempts = 1;
    while (shouldRetry(result.ok, attempts - 1, retries)) {
      result = await runOnce();
      attempts += 1;
    }
    result.attempts = attempts;
    if (result.ok && attempts > 1) {
      result.flaky = true;
      result.note = `passed on retry ${attempts - 1}/${retries}`;
    } else if (!result.ok && retries > 0) {
      result.note = `failed after ${retries} retr${retries === 1 ? 'y' : 'ies'}`;
    }
    return result;
  });

  let ri = 0;
  const results = decisions.map((d) =>
    d.cached
      ? makeResult({ stack: d.t.stack, label: d.t.label, present: true, note: 'unchanged since last green', cached: true })
      : ran[ri++],
  );

  if (useCache) {
    decisions.forEach((d, i) => {
      if (d.cached || !d.t.path || d.t.notice) return;
      const key = appCacheKey(d.t);
      cacheStore[key] = { hash: hashByKey[key] ?? null, ok: results[i].ok };
    });
    saveCache(projectDir, cacheStore);
  }

  applyCoverageGate(results, gate);
  if (!quiet) console.log('\n' + formatReport(results));
  const code = computeExitCode(results);
  console.log(`\nExit code: ${code}`);

  let code2 = code;
  if (changed) {
    const diffRanges = parseDiffRanges(changedDiffText);
    const lcovLines = new Map();
    const resolvedRanges = new Map();
    for (const d of decisions) {
      const t = d.t;
      const tdir = t.path ? resolve(projectDir, t.path) : null;
      if (!tdir) continue;
      const lcovPath = join(tdir, 'coverage', 'lcov.info');
      if (!existsSync(lcovPath)) continue;
      let lc;
      try { lc = parseLcovLines(readFileSync(lcovPath, 'utf8')); } catch { continue; }
      for (const [f, m] of lc) lcovLines.set(f, m);
      for (const [df, set] of diffRanges) {
        const absChanged = resolve(projectDir, df);
        if (!absChanged.startsWith(tdir + '/') && absChanged !== tdir) continue;
        const rel = absChanged.slice(tdir.length + 1);
        // NOTE: assumes projectDir == the target's git root (the common case). In a monorepo where each package is its own git repo under projectDir, the changed-line paths may not reconcile and patch coverage degrades gracefully to "no measurable" (never a wrong result).
        for (const key of [absChanged, df, rel, join(tdir, rel)]) {
          if (lc.has(key)) { resolvedRanges.set(key, set); break; }
        }
      }
    }
    const report = patchCoverage(lcovLines, resolvedRanges);
    console.log('\n' + formatPatchCoverage(report, patchGate));
    console.log('TESTCTL_PATCH_COVERAGE ' + JSON.stringify(report));
    if (patchGate != null && report.overall.pct != null && report.overall.pct < patchGate) {
      code2 = code2 === 0 ? 1 : code2;
    }
  }

  if (notifyUrl && code !== 0) {
    const payload = redactNotifyPayload(buildNotifyPayload(results, { project: projectDir.split('/').filter(Boolean).pop() || null }));
    console.log('TESTCTL_NOTIFY ' + JSON.stringify(payload));
    const res = await postWebhook(notifyUrl, payload);
    if (!res.ok) console.warn(`testctl: notify failed: ${res.error || 'status ' + res.status}`);
  }

  const failedLogs = results
    .filter((r) => r.present && !r.ok)
    .map((r) => ({ stack: r.stack, label: r.label, rawLogPath: r.rawLogPath, error: r.error }));
  console.log('TESTCTL_JSON ' + JSON.stringify({ results, failedLogs }));
  if (junitPath) {
    try { writeFileSync(resolve(projectDir, junitPath), toJUnitXml(results)); }
    catch (e) { console.warn(`testctl: could not write junit report: ${e.message}`); }
  }
  if (sarifPath) {
    try { writeFileSync(resolve(projectDir, sarifPath), JSON.stringify(toSarif(results), null, 2)); }
    catch (e) { console.warn(`testctl: could not write sarif report: ${e.message}`); }
  }
  if (htmlPath) {
    try { writeFileSync(resolve(projectDir, htmlPath), toHtml(results)); }
    catch (e) { console.warn(`testctl: could not write html report: ${e.message}`); }
  }
  if (mdPath) {
    try { writeFileSync(resolve(projectDir, mdPath), toMarkdown(results)); }
    catch (e) { console.warn(`testctl: could not write markdown report: ${e.message}`); }
  }
  const ts = new Date().toISOString();
  appendHistory(projectDir, historyEntry(results, ts));
  saveLastRun(projectDir, results, ts);
  return code2;
}

function cmdReport(projectDir) {
  const path = join(projectDir, '.testctl', 'history.jsonl');
  let text = '';
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    text = '';
  }
  console.log(formatHistoryReport(summarize(text)));
  return 0;
}

// `testctl trend [--window=N]` — read the run history testctl already persists and show the
// trajectory: per-app sparkline, pass-rate + coverage direction over the last N runs, and which apps
// newly regressed (green→red) or are improving (red→green). Read-only, exit 0 always (a recall, not a
// gate). Prints a machine-readable TESTCTL_TREND json line for tooling.
function cmdTrend(projectDir, window) {
  const path = join(projectDir, '.testctl', 'history.jsonl');
  let text = '';
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    text = '';
  }
  const trend = computeTrend(text, { window });
  console.log(formatTrend(trend));
  if (trend.totalRuns > 0) {
    console.log('TESTCTL_TREND ' + JSON.stringify(trend));
  }
  return 0;
}

// `testctl digest` — recall the last run's failure digest from .testctl/last-run.json
// WITHOUT re-running. Read-only, exit 0; prints a TESTCTL_DIGEST json line for tooling.
function cmdDigest(projectDir) {
  const record = loadLastRun(projectDir);
  console.log(formatDigest(record));
  if (record) {
    const failures = (record.results || []).flatMap((r) => (r.failures || []).map((f) => ({ stack: r.stack, ...f })));
    console.log('TESTCTL_DIGEST ' + JSON.stringify({ timestamp: record.timestamp, failures }));
  }
  return 0;
}

// `testctl bisect --good <ref> [--bad <ref>] [stack-or-path] [--test <substr>]`
// Drives `git bisect run` using `testctl run` as the good/bad oracle to find the commit that
// turned the suite (or one named test) red. Read-only on app code; always restores the original
// checkout via `git bisect reset` in a finally. Returns an exit code.
function cmdBisect(projectDir, opts) {
  const { good, bad, target, test } = opts;
  const git = (args) => spawnSync('git', ['-C', projectDir, ...args], { encoding: 'utf8' });

  // usage guard — no git mutation has happened yet
  if (!good) {
    console.error('Usage: testctl bisect --good <ref> [--bad <ref>] [stack-or-path] [--test <substr>]');
    console.error('  --good is required (the last commit where tests were green).');
    return 2;
  }

  // must be a git repo
  const inside = git(['rev-parse', '--is-inside-work-tree']);
  if (inside.error || inside.status !== 0 || (inside.stdout || '').trim() !== 'true') {
    console.error('testctl bisect: not a git repository — cannot bisect here.');
    return 2;
  }

  // refuse on a dirty tree (bisect checks out commits and would clobber/refuse)
  const status = git(['status', '--porcelain']);
  if ((status.stdout || '').trim() !== '') {
    console.error('testctl bisect: working tree has uncommitted changes — commit or stash before bisecting.');
    return 2;
  }

  // record where we started, so the finally can confirm where we land
  const branchRef = git(['symbolic-ref', '--quiet', '--short', 'HEAD']);
  const original = (branchRef.status === 0 && (branchRef.stdout || '').trim())
    ? branchRef.stdout.trim()
    : (git(['rev-parse', 'HEAD']).stdout || '').trim();

  const cliPath = process.argv[1];
  const criterion = buildBisectCriterion({ cliPath, target, test });
  const criterionLabel = test
    ? `test "${test}" appeared in failures`
    : 'the suite went red';

  let firstBad = null;
  try {
    const start = git(['bisect', 'start', bad, good]);
    if (start.error || start.status !== 0) {
      console.error('testctl bisect: `git bisect start` failed.');
      if (start.stderr) console.error(start.stderr.trim());
      return 1;
    }
    // `git bisect run <cmd>` — run via the shell so the criterion command string is parsed as written
    const run = spawnSync('git', ['-C', projectDir, 'bisect', 'run', 'sh', '-c', criterion], { encoding: 'utf8' });
    const out = (run.stdout || '') + (run.stderr || '');
    firstBad = parseFirstBadCommit(out);
  } finally {
    git(['bisect', 'reset']); // always restore the original checkout
  }

  if (!firstBad) {
    console.error('testctl bisect: could not determine a first bad commit — check that --good is actually green and --bad is actually red.');
    console.error(`(restored to ${original})`);
    return 1;
  }

  const subject = (git(['show', '-s', '--format=%s', firstBad]).stdout || '').trim();
  console.log(formatBisectResult({ firstBad, subject, criterionLabel }));
  console.log('TESTCTL_BISECT ' + JSON.stringify({ firstBad, subject }));
  return 0;
}

function cmdExplain(projectDir) {
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(join(projectDir, '.testctl', 'last-run.json'), 'utf8'));
  } catch {
    console.log('No recent run — run `testctl run` first.');
    return 0;
  }
  console.log(formatExplain(groupFailures(parsed.results || [])));
  return 0;
}

const CTX_SKIP = new Set(['node_modules', '.git', 'build', '.dart_tool', 'ios', 'android', '.next', 'dist', 'out', 'Pods', 'vendor', '.venv', '__pycache__', 'coverage', '.testctl']);
function walkSrcFiles(dir, acc, depth = 0) {
  if (depth > 6) return;
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (e.name.startsWith('.') || CTX_SKIP.has(e.name)) continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) walkSrcFiles(full, acc, depth + 1);
    else if (e.isFile()) acc.push(full);
  }
}

// `testctl context` — one compact per-app digest a test-skill can act on without
// discovering/running/reading broadly: status, failures, coverage, and the untested
// functions/classes (name + file:line) found by a cheap language-agnostic scan.
function cmdContext(projectDir, only) {
  const config = loadConfig(projectDir);
  const gate = config.coverageMin != null ? config.coverageMin : null;
  const targets = discoverTargets(projectDir, config, only).filter((t) => !t.notice);

  const lastByKey = {};
  try {
    const lr = JSON.parse(readFileSync(join(projectDir, '.testctl', 'last-run.json'), 'utf8'));
    for (const r of lr.results || []) lastByKey[`${r.stack}:${r.label || r.stack}`] = r;
  } catch { /* no prior run */ }

  const apps = targets.map((t) => {
    const last = lastByKey[`${t.stack}:${t.label || t.stack}`] || null;
    const app = { stack: t.stack, label: t.label || t.stack, path: t.path || null };
    app.tests = last ? (last.passed || 0) + (last.failed || 0) + (last.skipped || 0) : 0;
    app.hasTests = app.tests > 0;
    app.status = last ? (last.ok ? 'green' : 'red') : 'unknown';
    app.coverage = last ? (last.coverage ?? null) : null;
    app.failures = last ? (last.failures || []) : [];
    const t2 = resolveThreshold({ stack: t.stack, label: t.label }, gate);
    app.belowGate = app.coverage != null && t2 != null && app.coverage < t2;

    app.untested = [];
    if (t.path) {
      const abs = resolve(projectDir, t.path);
      const files = [];
      walkSrcFiles(abs, files);
      const testFiles = files.filter((f) => isTestFile(f));
      const srcFiles = files.filter((f) => !isTestFile(f));
      if (!app.hasTests && testFiles.length) app.hasTests = true;
      let testText = '';
      for (const tf of testFiles.slice(0, 60)) { try { testText += '\n' + readFileSync(tf, 'utf8'); } catch { /* skip */ } }
      const symbols = [];
      for (const sf of srcFiles.slice(0, 250)) {
        const lang = langOf(sf);
        if (!lang) continue;
        let txt = '';
        try { txt = readFileSync(sf, 'utf8'); } catch { continue; }
        for (const s of extractSymbols(txt, lang)) symbols.push({ ...s, file: relative(projectDir, sf) });
      }
      app.untested = untestedSymbols(symbols, testText).slice(0, 40);
    }
    app.untestedCount = app.untested.length;
    return app;
  });

  console.log(formatContext(apps));
  console.log('TESTCTL_CONTEXT ' + JSON.stringify({ apps }));
  return 0;
}

async function cmdWatch(projectDir, runOnce) {
  await runOnce();
  console.log('\n👀 watching for changes — Ctrl-C to stop');
  let running = false;
  watchProject(projectDir, async () => {
    if (running) return;
    running = true;
    console.log('\n— change detected, re-running —');
    try { await runOnce(); } catch (e) { console.warn(`testctl: ${e.message}`); }
    console.log('\n👀 watching for changes — Ctrl-C to stop');
    running = false;
  });
  return new Promise(() => {}); // keep the process alive until interrupted
}

function cmdDoctor(projectDir) {
  const report = runDoctor();
  console.log(formatDoctor(report));
  const ptr = frappePointer(loadConfig(projectDir));
  if (ptr) console.log('  ℹ ' + ptr);
  return report.node.ok ? 0 : 1;
}

function cmdPreflight(projectDir) {
  const config = loadConfig(projectDir);
  const f = config.stacks.frappe;
  const frappeList = Array.isArray(f) ? f : (f ? [f] : []);
  const fc = frappeList[0];
  let report;
  if (!fc) {
    report = frappePreflight({ configured: false });
  } else if (fc.ssh) {
    report = frappePreflight({ configured: true, remote: true });
  } else {
    const benchPath = fc.benchPath || '';
    const site = fc.site || '';
    const apps = Array.isArray(fc.apps) ? fc.apps : [];
    let siteConfig = {};
    try { siteConfig = JSON.parse(readFileSync(join(benchPath, 'sites', site, 'site_config.json'), 'utf8')); } catch { siteConfig = {}; }
    const appsWithBeforeTests = apps.filter((app) => {
      for (const p of [join(benchPath, 'apps', app, app, 'hooks.py'), join(benchPath, 'apps', app, 'hooks.py')]) {
        try { if (/^\s*before_tests\s*=/m.test(readFileSync(p, 'utf8'))) return true; } catch { /* try next path */ }
      }
      return false;
    });
    let devReqsOk = false;
    try {
      const proc = spawnSync(join(benchPath, 'env', 'bin', 'python'), ['-c', 'import xmlrunner, coverage'], { encoding: 'utf8' });
      devReqsOk = !proc.error && proc.status === 0;
    } catch { devReqsOk = false; }
    report = frappePreflight({ configured: true, remote: false, devReqsOk, siteConfig, appsWithBeforeTests, apps });
  }
  console.log(formatPreflight(report, { site: fc && fc.site ? fc.site : '<site>' }));
  console.log('Exit code: ' + (report.ok ? 0 : 1));
  return report.ok ? 0 : 1;
}

async function main() {
  const [, , cmd, arg] = process.argv;
  const projectDir = process.cwd();
  if (cmd === 'init') {
    const ciArg = process.argv.slice(3).find((a) => a === '--ci' || a.startsWith('--ci='));
    const ci = ciArg ? (ciArg.includes('=') ? (ciArg.split('=')[1] || 'github') : 'github') : false;
    return process.exit(cmdInit(projectDir, { ci }));
  }
  if (cmd === 'doctor') return process.exit(cmdDoctor(projectDir));
  if (cmd === 'preflight') return process.exit(cmdPreflight(projectDir));
  if (cmd === 'report') return process.exit(cmdReport(projectDir));
  if (cmd === 'trend') {
    const rest = process.argv.slice(3);
    const windowEntry = rest.find((a) => a.startsWith('--window='));
    const window = Math.max(2, Math.floor(Number((windowEntry || '').split('=')[1])) || 10);
    return process.exit(cmdTrend(projectDir, window));
  }
  if (cmd === 'explain') return process.exit(cmdExplain(projectDir));
  if (cmd === 'digest') return process.exit(cmdDigest(projectDir));
  if (cmd === 'bisect') {
    const rest = process.argv.slice(3);
    const flag = (name) => {
      const i = rest.findIndex((a) => a === name || a.startsWith(name + '='));
      if (i === -1) return null;
      const a = rest[i];
      if (a.includes('=')) return a.split('=').slice(1).join('=') || null;
      return rest[i + 1] && !rest[i + 1].startsWith('--') ? rest[i + 1] : null;
    };
    const good = flag('--good');
    const bad = flag('--bad') || 'HEAD';
    const test = flag('--test');
    // positional stack-or-path: first non-flag arg that is not consumed as a flag value
    const flagVals = new Set([good, bad === 'HEAD' ? null : bad, test].filter(Boolean));
    const positional = rest.find((a) => !a.startsWith('--') && !flagVals.has(a)) || null;
    if (positional && !STACKS.includes(positional) && !existsSync(resolve(projectDir, positional))) {
      console.error(`Unknown stack/path "${positional}". Valid stacks: ${STACKS.join(', ')}`);
      return process.exit(2);
    }
    return process.exit(cmdBisect(projectDir, { good, bad, target: positional, test }));
  }
  if (cmd === 'context') {
    const a = process.argv[3];
    return process.exit(cmdContext(projectDir, a && STACKS.includes(a) ? a : null));
  }
  if (cmd === 'run') {
    const rest = process.argv.slice(3);
    const coverage = rest.includes('--coverage');
    const positionals = rest.filter((a) => !a.startsWith('--'));
    const only = positionals[0] && STACKS.includes(positionals[0]) ? positionals[0] : null;
    if (positionals[0] && !only) {
      console.error(`Unknown stack "${positionals[0]}". Valid: ${STACKS.join(', ')}`);
      return process.exit(2);
    }
    const concEntry = rest.find((a) => a.startsWith('--concurrency='));
    const concurrency = Math.max(1, Math.floor(Number((concEntry || '').split('=')[1])) || 4);
    const mcEntry = rest.find((a) => a.startsWith('--min-coverage='));
    const mc = mcEntry ? Number(mcEntry.split('=')[1]) : null;
    const minCoverage = mc != null && !Number.isNaN(mc) ? mc : null;
    const quiet = rest.includes('--quiet');
    const changedEntry = rest.find((a) => a === '--changed' || a.startsWith('--changed='));
    const changed = changedEntry
      ? { ref: changedEntry.startsWith('--changed=') ? changedEntry.split('=')[1] || null : null }
      : null;
    const cache = rest.includes('--cache');
    const junitEntry = rest.find((a) => a === '--report-junit' || a.startsWith('--report-junit='));
    const junitPath = junitEntry ? (junitEntry.includes('=') ? junitEntry.split('=')[1] || 'testctl-junit.xml' : 'testctl-junit.xml') : null;
    const sarifEntry = rest.find((a) => a === '--report-sarif' || a.startsWith('--report-sarif='));
    const sarifPath = sarifEntry ? (sarifEntry.includes('=') ? sarifEntry.split('=')[1] || 'testctl-sarif.json' : 'testctl-sarif.json') : null;
    const htmlEntry = rest.find((a) => a === '--report-html' || a.startsWith('--report-html='));
    const htmlPath = htmlEntry ? (htmlEntry.includes('=') ? htmlEntry.split('=')[1] || 'testctl-report.html' : 'testctl-report.html') : null;
    const mdEntry = rest.find((a) => a === '--report-md' || a.startsWith('--report-md='));
    const mdPath = mdEntry ? (mdEntry.includes('=') ? mdEntry.split('=')[1] || 'testctl-report.md' : 'testctl-report.md') : null;
    const retryEntry = rest.find((a) => a.startsWith('--retry='));
    const retries = retryEntry ? Math.max(0, Math.floor(Number(retryEntry.split('=')[1])) || 0) : null;
    const notifyEntry = rest.find((a) => a.startsWith('--notify='));
    const notifyUrl = notifyEntry ? notifyEntry.split('=').slice(1).join('=') || null : null;
    const ccmEntry = rest.find((a) => a.startsWith('--changed-coverage-min='));
    const ccm = ccmEntry ? Number(ccmEntry.split('=')[1]) : null;
    const changedCoverageMin = ccm != null && !Number.isNaN(ccm) ? ccm : null;
    const watch = rest.includes('--watch');
    const runOnce = () => cmdRun(projectDir, only, coverage, concurrency, minCoverage, changed, quiet, cache, junitPath, sarifPath, retries, htmlPath, notifyUrl, mdPath, changedCoverageMin);
    if (watch) { await cmdWatch(projectDir, runOnce); return; }
    return process.exit(await runOnce());
  }
  console.log('Usage:\n  testctl init [--ci[=github|gitlab]]\n  testctl doctor\n  testctl preflight   (Frappe test-readiness)\n  testctl run [frappe|flutter|electron|nextjs|supabase|web|e2e] [--coverage] [--min-coverage=N] [--concurrency=N] [--changed[=ref]] [--changed-coverage-min=N] [--quiet] [--cache] [--report-junit[=path]] [--report-sarif[=path]] [--report-html[=path]] [--report-md[=path]] [--retry=N] [--notify=url] [--watch]\n  testctl report\n  testctl trend [--window=N]   (is testing getting better or worse over the last N runs?)\n  testctl explain\n  testctl digest   (recall last run\'s failure digest, no re-run)\n  testctl bisect --good <ref> [--bad <ref>] [stack-or-path] [--test <substr>]   (find the commit that turned tests red)\n  testctl context');
  return process.exit(cmd ? 2 : 0);
}

main();
