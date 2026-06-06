import { spawnSync } from 'node:child_process';

// Pure: extract the leading integer from a version string.
export function parseMajor(versionString) {
  if (!versionString) return null;
  const m = String(versionString).match(/\d+/);
  return m ? Number(m[0]) : null;
}

// Side-effecty: is a CLI tool present? Probe with `<tool> --version`.
function checkTool(name) {
  try {
    const proc = spawnSync(name, ['--version'], { encoding: 'utf8' });
    if (proc.error || proc.status !== 0) return { present: false, version: null };
    const version = ((proc.stdout || proc.stderr || '').split('\n')[0] || '').trim();
    return { present: true, version };
  } catch {
    return { present: false, version: null };
  }
}

// Side-effecty: build the readiness report.
export function runDoctor() {
  const major = parseMajor(process.version);
  const node = { version: process.version, major, ok: (major ?? 0) >= 20 };
  const specs = [
    { name: 'flutter', stack: 'Flutter' },
    { name: 'bench', stack: 'Frappe' },
    { name: 'supabase', stack: 'Supabase' },
  ];
  const tools = specs.map((s) => ({ name: s.name, stack: s.stack, ...checkTool(s.name) }));
  const readyStacks = tools.filter((t) => t.present).map((t) => t.stack).concat(['Electron', 'Next.js']);
  return { node, tools, readyStacks };
}

// Pure: render the report as a checklist string.
export function formatDoctor(report) {
  const n = report.node;
  const lines = ['testctl doctor', '──────────────'];
  lines.push(`  ${n.ok ? '✓' : '✗'} ${'node'.padEnd(10)} ${n.version}   (>= 20${n.ok ? '' : ' REQUIRED'})`);
  for (const t of report.tools) {
    if (t.present) lines.push(`  ✓ ${t.name.padEnd(10)} ${t.version || ''}   → ${t.stack}`);
    else lines.push(`  ⊘ ${t.name.padEnd(10)} not found → ${t.stack} unavailable here`);
  }
  lines.push("  ℹ Electron / Next.js use the project's own jest/vitest via npx");
  lines.push(`Ready stacks: ${report.readyStacks.join(', ')}`);
  return lines.join('\n');
}
