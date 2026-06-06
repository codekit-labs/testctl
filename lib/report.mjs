const LABELS = { frappe: 'Frappe', flutter: 'Flutter', electron: 'Electron', nextjs: 'Next.js', supabase: 'Supabase' };

function fmtTime(ms) {
  return `${(ms / 1000).toFixed(1)}s`;
}

export function computeExitCode(results) {
  return results.some((r) => r.present && !r.ok) ? 1 : 0;
}

export function formatReport(results) {
  const present = results.filter((r) => r.present);
  const absent = results.filter((r) => !r.present);
  const lines = [];

  const rows = present.map((r) => {
    if (r.errored) {
      return `  ${LABELS[r.stack].padEnd(8)} ERROR: ${r.error}`;
    }
    return [
      '  ',
      LABELS[r.stack].padEnd(8),
      `passed ${String(r.passed).padStart(4)}`,
      `failed ${String(r.failed).padStart(4)}`,
      `skipped ${String(r.skipped).padStart(4)}`,
      fmtTime(r.durationMs).padStart(8),
    ].join('  ');
  });

  lines.push('Test results');
  lines.push('────────────');
  lines.push(...rows);
  for (const r of absent) {
    lines.push(`  (${LABELS[r.stack]}: not present)`);
  }
  return lines.join('\n');
}
