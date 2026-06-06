import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { discoverTargets } from './discover.mjs';
import { hasFrappeMarker } from './detect.mjs';

const NON_SITE = new Set([
  'apps.txt', 'apps.json', 'assets', 'common_site_config.json', 'currentsite.txt', '.DS_Store',
]);

// Pure: build testctl.yaml text from a detection summary.
export function buildInitYaml(detection) {
  const lines = [];
  const auto = detection.auto || {};
  const autoParts = [];
  if (auto.flutter) autoParts.push(`${auto.flutter} Flutter app(s)`);
  if (auto.electron) autoParts.push(`${auto.electron} Electron app(s)`);
  if (auto.supabase) autoParts.push(`${auto.supabase} Supabase project(s)`);
  if (autoParts.length) lines.push(`# Auto-detected (no config needed): ${autoParts.join(', ')}.`);

  const blocks = [];
  if (detection.frappe) {
    const f = detection.frappe;
    const sitesHint = f.sites && f.sites.length ? f.sites.join(', ') : '(none found — set your test site)';
    blocks.push(
      [
        '  frappe:',
        `    benchPath: ${f.benchPath || '<FILL-ME>'}`,
        `    apps: [${(f.apps || []).join(', ')}]`,
        `    site: <FILL-ME>   # sites in this bench: ${sitesHint}   | then: bench --site <site> set-config allow_tests 1`,
      ].join('\n'),
    );
  }
  if (detection.nextjs) {
    blocks.push(['  nextjs:', '    vercelUrl: <FILL-ME>   # e.g. https://your-app.vercel.app'].join('\n'));
  }

  if (blocks.length) {
    lines.push('stacks:');
    lines.push(blocks.join('\n'));
  } else {
    lines.push('# All detected stacks auto-discover — `testctl run` works as-is, no config needed.');
    lines.push('stacks: {}');
  }
  return lines.join('\n') + '\n';
}

// Find the Frappe app name (basename of the dir containing hooks.py) under dir, shallow.
function findFrappeApp(dir, depth = 0) {
  if (depth > 3) return null;
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return null;
  }
  if (entries.some((e) => e.isFile() && e.name === 'hooks.py')) {
    return dir.split('/').filter(Boolean).pop();
  }
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const found = findFrappeApp(join(dir, e.name), depth + 1);
    if (found) return found;
  }
  return null;
}

function listSites(bench) {
  try {
    return readdirSync(join(bench, 'sites'))
      .filter((n) => !NON_SITE.has(n) && !n.startsWith('.'))
      .filter((n) => {
        try {
          return statSync(join(bench, 'sites', n)).isDirectory();
        } catch {
          return false;
        }
      });
  } catch {
    return [];
  }
}

// Side-effecty: scan the project + home dir to build a detection summary for buildInitYaml.
export function scanProject(cwd, homeDir) {
  const targets = discoverTargets(cwd, {});
  const auto = { flutter: 0, electron: 0, supabase: 0 };
  let nextjs = 0;
  for (const t of targets) {
    if (t.stack === 'flutter') auto.flutter += 1;
    else if (t.stack === 'electron') auto.electron += 1;
    else if (t.stack === 'supabase') auto.supabase += 1;
    else if (t.stack === 'nextjs') nextjs += 1;
  }

  let frappe = null;
  if (hasFrappeMarker(cwd)) {
    const app = findFrappeApp(cwd) || '<FILL-ME>';
    let benchPath = null;
    let sites = [];
    try {
      const benches = readdirSync(homeDir, { withFileTypes: true })
        .filter((e) => e.isDirectory() && e.name.startsWith('frappe-bench'))
        .map((e) => join(homeDir, e.name));
      for (const b of benches) {
        if (existsSync(join(b, 'apps', app))) {
          benchPath = b;
          sites = listSites(b);
          break;
        }
      }
    } catch {
      // no home access — leave benchPath null (renders as <FILL-ME>)
    }
    frappe = { benchPath, apps: [app], sites };
  }

  return { auto, frappe, nextjs };
}
