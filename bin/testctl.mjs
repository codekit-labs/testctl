#!/usr/bin/env node
import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig } from '../lib/config.mjs';
import { discoverTargets } from '../lib/discover.mjs';
import { mapPool } from '../lib/pool.mjs';
import { historyEntry, appendHistory, summarize, formatHistoryReport } from '../lib/history.mjs';
import { homedir } from 'node:os';
import { buildInitYaml, scanProject } from '../lib/init.mjs';
import { runDoctor, formatDoctor } from '../lib/doctor.mjs';
import { makeResult } from '../lib/result.mjs';
import { formatReport, computeExitCode } from '../lib/report.mjs';
import { applyCoverageGate } from '../lib/coverage.mjs';
import { runFrappe } from '../lib/runners/frappe.mjs';
import { runFlutter } from '../lib/runners/flutter.mjs';
import { runElectron } from '../lib/runners/electron.mjs';
import { runNextjs } from '../lib/runners/nextjs.mjs';
import { runSupabase } from '../lib/runners/supabase.mjs';

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

async function cmdRun(projectDir, only, coverage = false, concurrency = 4, minCoverage = null) {
  const config = loadConfig(projectDir);
  if (minCoverage == null && config.coverageMin != null) minCoverage = Number(config.coverageMin);
  if (Number.isNaN(minCoverage)) minCoverage = null;
  if (minCoverage != null) coverage = true;
  const targets = discoverTargets(projectDir, config, only);

  if (targets.length === 0) {
    console.log('No testable apps found.');
  } else {
    console.log('Discovered apps:');
    for (const t of targets) {
      const name = t.label && t.label !== t.stack ? `${t.stack} (${t.label})` : t.stack;
      console.log(`  ${t.notice ? '⚠' : '•'} ${name}${t.notice ? ' — ' + t.note : ''}`);
    }
  }

  const runnable = targets.filter((t) => !t.notice).length;
  if (runnable > 0) console.log(`\n▶ Running ${runnable} app(s) (concurrency ${concurrency})...`);
  const results = await mapPool(targets, concurrency, async (t) => {
    try {
      return await runTarget(t, coverage);
    } catch (e) {
      return makeResult({ stack: t.stack, label: t.label, errored: true, error: String(e) });
    }
  });

  applyCoverageGate(results, minCoverage);
  console.log('\n' + formatReport(results));
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
    return process.exit(await cmdRun(projectDir, only, coverage, concurrency, minCoverage));
  }
  console.log('Usage:\n  testctl init\n  testctl doctor\n  testctl run [frappe|flutter|electron|nextjs|supabase] [--coverage] [--min-coverage=N] [--concurrency=N]\n  testctl report');
  return process.exit(cmd ? 2 : 0);
}

main();
