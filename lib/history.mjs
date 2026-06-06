import { existsSync, mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';

// Pure: build one history record from a results array + a caller-supplied timestamp.
export function historyEntry(results, timestamp) {
  const apps = results
    .filter((r) => r.present)
    .map((r) => ({
      stack: r.stack,
      label: r.label || r.stack,
      passed: r.passed,
      failed: r.failed,
      skipped: r.skipped,
      ok: r.ok,
      errored: r.errored,
      coverage: r.coverage ?? null,
    }));
  const totals = apps.reduce(
    (t, a) => ({
      passed: t.passed + a.passed,
      failed: t.failed + a.failed,
      skipped: t.skipped + a.skipped,
      apps: t.apps + 1,
    }),
    { passed: 0, failed: 0, skipped: 0, apps: 0 },
  );
  return { ts: timestamp, apps, totals };
}

// Pure: summarize JSONL history text into run/pass-rate/flaky stats per app.
export function summarize(text) {
  const entries = [];
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    try {
      entries.push(JSON.parse(t));
    } catch {
      // skip non-JSON / corrupt lines
    }
  }
  const acc = {};
  for (const e of entries) {
    for (const a of e.apps || []) {
      const key = `${a.stack} (${a.label})`;
      const s = acc[key] || { runs: 0, okRuns: 0, lastOk: null, lastCoverage: null };
      s.runs += 1;
      if (a.ok) s.okRuns += 1;
      s.lastOk = a.ok;
      if (a.coverage != null) s.lastCoverage = a.coverage;
      acc[key] = s;
    }
  }
  const perApp = {};
  for (const [key, s] of Object.entries(acc)) {
    perApp[key] = {
      runs: s.runs,
      lastOk: s.lastOk,
      passRate: s.runs ? Math.round((s.okRuns / s.runs) * 100) : 0,
      flaky: s.okRuns > 0 && s.okRuns < s.runs,
      lastCoverage: s.lastCoverage,
    };
  }
  return {
    totalRuns: entries.length,
    lastRun: entries.length ? entries[entries.length - 1] : null,
    perApp,
  };
}

// Pure: render a summary as a readable multi-line string.
export function formatHistoryReport(summary) {
  if (summary.totalRuns === 0) return 'No run history yet — run `testctl run` first.';
  const last = summary.lastRun ? summary.lastRun.ts : 'n/a';
  const lines = [
    `testctl run history — ${summary.totalRuns} run${summary.totalRuns === 1 ? '' : 's'} (last: ${last})`,
    '────────────────────────────────────────────',
    `  ${'App'.padEnd(34)} ${'Runs'.padStart(4)}  ${'Pass%'.padStart(5)}  ${'Cov'.padStart(4)}  Flaky`,
  ];
  for (const [key, s] of Object.entries(summary.perApp)) {
    const cov = s.lastCoverage != null ? `${s.lastCoverage}%` : '—';
    lines.push(`  ${key.padEnd(34)} ${String(s.runs).padStart(4)}  ${String(s.passRate).padStart(4)}%  ${cov.padStart(4)}  ${s.flaky ? 'yes' : 'no'}`);
  }
  return lines.join('\n');
}

// Side-effect (best-effort): append an entry to <dir>/.testctl/history.jsonl and self-ignore the folder.
export function appendHistory(projectDir, entry) {
  try {
    const tdir = join(projectDir, '.testctl');
    if (!existsSync(tdir)) mkdirSync(tdir, { recursive: true });
    const gi = join(tdir, '.gitignore');
    if (!existsSync(gi)) writeFileSync(gi, '*\n');
    appendFileSync(join(tdir, 'history.jsonl'), JSON.stringify(entry) + '\n');
  } catch {
    // best-effort: never break a run because history could not be written
  }
}
