const LABELS = { frappe: 'Frappe', flutter: 'Flutter', electron: 'Electron', nextjs: 'Next.js', supabase: 'Supabase' };

function fmtTime(ms) {
  return `${(ms / 1000).toFixed(1)}s`;
}

function displayName(r) {
  const base = LABELS[r.stack] || r.stack;
  return r.label && r.label !== r.stack ? `${base} (${r.label})` : base;
}

export function computeExitCode(results) {
  return results.some((r) => r.present && !r.ok) ? 1 : 0;
}

export function formatReport(results) {
  const present = results.filter((r) => r.present);
  const lines = ['Test results', '────────────'];

  for (const r of present) {
    const name = displayName(r);
    if (r.cached) {
      lines.push(`  ✓ ${displayName(r)}  cached`);
      continue;
    }
    if (r.errored) {
      lines.push(`  ✗ ${name}  ERROR: ${r.error}`);
      continue;
    }
    if (r.note && r.passed + r.failed + r.skipped === 0) {
      lines.push(`  ⚠ ${name}  ${r.note}`);
      continue;
    }
    const row = [
      '  ',
      name.padEnd(26),
      `passed ${String(r.passed).padStart(4)}`,
      `failed ${String(r.failed).padStart(4)}`,
      `skipped ${String(r.skipped).padStart(4)}`,
      fmtTime(r.durationMs).padStart(8),
      `cov ${r.coverage != null ? r.coverage + '%' : '—'}`,
    ].join('  ');
    lines.push(r.note ? `${row}  ⚠ ${r.note}` : row);
  }
  return lines.join('\n');
}
