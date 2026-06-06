#!/usr/bin/env node
import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig } from '../lib/config.mjs';
import { discoverTargets } from '../lib/discover.mjs';
import { historyEntry, appendHistory, summarize, formatHistoryReport } from '../lib/history.mjs';
import { homedir } from 'node:os';
import { buildInitYaml, scanProject } from '../lib/init.mjs';
import { makeResult } from '../lib/result.mjs';
import { formatReport, computeExitCode } from '../lib/report.mjs';
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

async function runTarget(target) {
  if (target.notice) {
    return makeResult({ stack: target.stack, present: true, label: target.label, note: target.note });
  }
  let result;
  if (target.stack === 'frappe') {
    result = runFrappe(target.config || {});
  } else if (target.stack === 'flutter') {
    result = runFlutter({ path: target.path });
  } else if (target.stack === 'electron') {
    result = runElectron({ path: target.path });
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

async function cmdRun(projectDir, only) {
  const config = loadConfig(projectDir);
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

  const results = [];
  for (const t of targets) {
    if (!t.notice) {
      const name = t.label && t.label !== t.stack ? `${t.stack} (${t.label})` : t.stack;
      console.log(`\n▶ Running ${name}...`);
    }
    results.push(await runTarget(t));
  }

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

async function main() {
  const [, , cmd, arg] = process.argv;
  const projectDir = process.cwd();
  if (cmd === 'init') return process.exit(cmdInit(projectDir));
  if (cmd === 'report') return process.exit(cmdReport(projectDir));
  if (cmd === 'run') {
    const only = arg && STACKS.includes(arg) ? arg : null;
    if (arg && !only) {
      console.error(`Unknown stack "${arg}". Valid: ${STACKS.join(', ')}`);
      return process.exit(2);
    }
    return process.exit(await cmdRun(projectDir, only));
  }
  console.log('Usage:\n  testctl init\n  testctl run [frappe|flutter|electron|nextjs|supabase]\n  testctl report');
  return process.exit(cmd ? 2 : 0);
}

main();
