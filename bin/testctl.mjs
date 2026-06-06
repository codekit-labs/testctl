#!/usr/bin/env node
import { writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig } from '../lib/config.mjs';
import { detectStacks } from '../lib/detect.mjs';
import { makeResult } from '../lib/result.mjs';
import { formatReport, computeExitCode } from '../lib/report.mjs';
import { runFrappe } from '../lib/runners/frappe.mjs';
import { runFlutter } from '../lib/runners/flutter.mjs';
import { runElectron } from '../lib/runners/electron.mjs';
import { runNextjs } from '../lib/runners/nextjs.mjs';
import { runSupabase } from '../lib/runners/supabase.mjs';

const STACKS = ['frappe', 'flutter', 'electron', 'nextjs', 'supabase'];

const TEMPLATE = `stacks:
  # frappe:
  #   benchPath: /path/to/frappe-bench
  #   site: test
  #   apps: [your_app]
  # flutter:
  #   path: ./mobile
  # electron:
  #   path: ./desktop
  # nextjs:
  #   vercelUrl: https://your-app.vercel.app
  #   checks:
  #     - { path: /, expectStatus: 200 }
  # supabase:
  #   path: ./
`;

function cmdInit(projectDir) {
  const path = join(projectDir, 'testctl.yaml');
  if (existsSync(path)) {
    console.log('testctl.yaml already exists — leaving it untouched.');
    return 0;
  }
  writeFileSync(path, TEMPLATE);
  console.log(`Created ${path}. Edit it to point at your stacks.`);
  return 0;
}

async function runStack(stack, detected, config) {
  if (stack === 'frappe') {
    const cfg = config.stacks.frappe || detected.frappe.config || {};
    return runFrappe(cfg);
  }
  if (stack === 'flutter') {
    return runFlutter(config.stacks.flutter || { path: detected.flutter.path });
  }
  if (stack === 'electron') {
    return runElectron(config.stacks.electron || { path: detected.electron.path });
  }
  if (stack === 'nextjs') {
    return runNextjs(config.stacks.nextjs || detected.nextjs.config || {});
  }
  if (stack === 'supabase') {
    return runSupabase(config.stacks.supabase || detected.supabase.config || { path: detected.supabase.path });
  }
  return makeResult({ stack, errored: true, error: `unknown stack ${stack}` });
}

async function cmdRun(projectDir, only) {
  const config = loadConfig(projectDir);
  const detected = detectStacks(projectDir, config);

  const targets = only ? [only] : STACKS;
  console.log('Detecting stacks...');
  for (const s of STACKS) {
    console.log(`  ${detected[s].present ? '✓' : '⊘'} ${s}${detected[s].present ? '' : ' (not present)'}`);
  }

  const results = [];
  for (const stack of targets) {
    if (!detected[stack].present) {
      results.push(makeResult({ stack, present: false }));
      continue;
    }
    console.log(`\n▶ Running ${stack}...`);
    results.push(await runStack(stack, detected, config));
  }

  // Ensure every stack appears in the report when running all.
  if (!only) {
    for (const s of STACKS) {
      if (!results.find((r) => r.stack === s)) results.push(makeResult({ stack: s, present: false }));
    }
  }

  console.log('\n' + formatReport(results));
  const code = computeExitCode(results);
  console.log(`\nExit code: ${code}`);

  // Emit machine-readable JSON for the skill on the last line, prefixed for easy extraction.
  const failedLogs = results.filter((r) => r.present && !r.ok).map((r) => ({ stack: r.stack, rawLogPath: r.rawLogPath, error: r.error }));
  console.log('TESTCTL_JSON ' + JSON.stringify({ results, failedLogs }));
  return code;
}

async function main() {
  const [, , cmd, arg] = process.argv;
  const projectDir = process.cwd();
  if (cmd === 'init') return process.exit(cmdInit(projectDir));
  if (cmd === 'run') {
    const only = arg && STACKS.includes(arg) ? arg : null;
    if (arg && !only) {
      console.error(`Unknown stack "${arg}". Valid: ${STACKS.join(', ')}`);
      return process.exit(2);
    }
    return process.exit(await cmdRun(projectDir, only));
  }
  console.log('Usage:\n  testctl init\n  testctl run [frappe|flutter|electron|nextjs|supabase]');
  return process.exit(cmd ? 2 : 0);
}

main();
