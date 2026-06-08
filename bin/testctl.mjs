#!/usr/bin/env node
import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { loadConfig } from '../lib/config.mjs';
import { discoverTargets } from '../lib/discover.mjs';
import { mapPool } from '../lib/pool.mjs';
import { historyEntry, appendHistory, summarize, formatHistoryReport } from '../lib/history.mjs';
import { homedir } from 'node:os';
import { buildInitYaml, scanProject } from '../lib/init.mjs';
import { runDoctor, formatDoctor } from '../lib/doctor.mjs';
import { makeResult } from '../lib/result.mjs';
import { formatReport, computeExitCode } from '../lib/report.mjs';
import { gitChangedFiles, selectChangedTargets } from '../lib/changed.mjs';
import { applyCoverageGate } from '../lib/coverage.mjs';
import { runFrappe } from '../lib/runners/frappe.mjs';
import { runFlutter } from '../lib/runners/flutter.mjs';
import { runElectron } from '../lib/runners/electron.mjs';
import { runNextjs } from '../lib/runners/nextjs.mjs';
import { runSupabase } from '../lib/runners/supabase.mjs';
import { hashApp, appCacheKey, decideCached, loadCache, saveCache } from '../lib/cache.mjs';

const STACKS = ['frappe', 'flutter', 'electron', 'nextjs', 'supabase'];

function cmdInit(projectDir) {
  const path = join(projectDir, 'testctl.yaml');
  if (existsSync(path)) {
    console.log('testctl.yaml already exists — leaving it untouched.');
    return 0;
  }
  const detection = scanProject(projectDir, homedir());
  writeFileSync(path, buildInitYaml(detection));
  const a = detection.auto;
  console.log(`Created ${path}`);
  console.log(`  auto-detected: ${a.flutter} flutter, ${a.electron} electron, ${a.supabase} supabase, ${detection.nextjs} nextjs`);
  if (detection.frappe) {
    console.log(`  frappe app: ${detection.frappe.apps.join(', ')} (bench: ${detection.frappe.benchPath || 'not found — set benchPath'})`);
  }
  console.log('  Fill any <FILL-ME> values, then run: testctl run');
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
  } else {
    result = makeResult({ stack: target.stack, errored: true, error: `unknown stack ${target.stack}` });
  }
  result = await result;
  result.label = target.label || result.stack;
  return result;
}

async function cmdRun(projectDir, only, coverage = false, concurrency = 4, minCoverage = null, changed = null, quiet = false, cache = false) {
  const config = loadConfig(projectDir);
  if (minCoverage == null && config.coverageMin != null) minCoverage = Number(config.coverageMin);
  if (Number.isNaN(minCoverage)) minCoverage = null;
  if (minCoverage != null) coverage = true;
  const useCache = cache || config.cache === true;
  let targets = discoverTargets(projectDir, config, only);

  if (changed) {
    const { files, note } = gitChangedFiles(projectDir, changed.ref);
    if (note) console.log(note);
    if (files) {
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
    try {
      return await runTarget(t, coverage);
    } catch (e) {
      return makeResult({ stack: t.stack, label: t.label, errored: true, error: String(e) });
    }
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

  applyCoverageGate(results, minCoverage);
  if (!quiet) console.log('\n' + formatReport(results));
  const code = computeExitCode(results);
  console.log(`\nExit code: ${code}`);

  const failedLogs = results
    .filter((r) => r.present && !r.ok)
    .map((r) => ({ stack: r.stack, label: r.label, rawLogPath: r.rawLogPath, error: r.error }));
  console.log('TESTCTL_JSON ' + JSON.stringify({ results, failedLogs }));
  appendHistory(projectDir, historyEntry(results, new Date().toISOString()));
  return code;
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

function cmdDoctor() {
  const report = runDoctor();
  console.log(formatDoctor(report));
  return report.node.ok ? 0 : 1;
}

async function main() {
  const [, , cmd, arg] = process.argv;
  const projectDir = process.cwd();
  if (cmd === 'init') return process.exit(cmdInit(projectDir));
  if (cmd === 'doctor') return process.exit(cmdDoctor());
  if (cmd === 'report') return process.exit(cmdReport(projectDir));
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
    return process.exit(await cmdRun(projectDir, only, coverage, concurrency, minCoverage, changed, quiet, cache));
  }
  console.log('Usage:\n  testctl init\n  testctl doctor\n  testctl run [frappe|flutter|electron|nextjs|supabase] [--coverage] [--min-coverage=N] [--concurrency=N] [--changed[=ref]] [--quiet] [--cache]\n  testctl report');
  return process.exit(cmd ? 2 : 0);
}

main();
