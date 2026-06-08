export function normalizeSig(message) {
  const first = String(message || '').split('\n').find((l) => l.trim()) || '';
  return first.trim().replace(/\d+/g, '#').replace(/\s+/g, ' ').slice(0, 120) || '(no message)';
}

export function groupFailures(results) {
  const groups = new Map();
  for (const r of (results || []).filter((x) => x.present)) {
    const app = r.label && r.label !== r.stack ? `${r.stack} (${r.label})` : r.stack;
    for (const f of r.failures || []) {
      const sig = normalizeSig(f.message);
      const g = groups.get(sig) || { signature: sig, count: 0, apps: new Set(), sample: { test: f.test, app, message: f.message } };
      g.count += 1;
      g.apps.add(app);
      groups.set(sig, g);
    }
  }
  return [...groups.values()].map((g) => ({ ...g, apps: [...g.apps] })).sort((a, b) => b.count - a.count);
}

export function formatExplain(groups) {
  if (!groups.length) return 'No failures in the last run. 🎉';
  const total = groups.reduce((n, g) => n + g.count, 0);
  const apps = new Set(groups.flatMap((g) => g.apps)).size;
  const lines = [
    `${total} failure${total === 1 ? '' : 's'} across ${apps} app${apps === 1 ? '' : 's'} → ${groups.length} group${groups.length === 1 ? '' : 's'}`,
    '────────────────────────────────────────',
  ];
  for (const g of groups) {
    lines.push(`  ×${g.count}  ${g.signature}`);
    lines.push(`        apps: ${g.apps.join(', ')}  ·  e.g. ${g.sample.test}`);
  }
  return lines.join('\n');
}
