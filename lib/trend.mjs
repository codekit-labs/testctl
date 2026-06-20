// Pure trend analysis over testctl's run history (.testctl/history.jsonl).
// Read-only derivation: no I/O, no new data captured. Mirrors the tolerant per-line
// JSONL parse used by `summarize` in lib/history.mjs (separate module by design).

// Parse JSONL history text into an ordered array of entries, skipping blank/corrupt lines.
function parseEntries(text) {
  const entries = [];
  for (const lineText of String(text == null ? '' : text).split('\n')) {
    const t = lineText.trim();
    if (!t) continue;
    try {
      entries.push(JSON.parse(t));
    } catch {
      // skip non-JSON / corrupt lines, exactly like summarize()
    }
  }
  return entries;
}

function passRate(oks) {
  if (oks.length === 0) return 0;
  const ok = oks.filter(Boolean).length;
  return Math.round((ok / oks.length) * 100);
}

function dirOf(delta) {
  if (delta > 0) return 'up';
  if (delta < 0) return 'down';
  return 'flat';
}

// computeTrend(historyText, { window = 10 }) → { window, totalRuns, apps, regressedKeys, improvedKeys }
// Per app key `${stack} (${label})`: series (present runs only, ordered), sparkline (✓/✗/·),
// second-half vs first-half pass rate + direction, first-vs-last non-null coverage + direction,
// regressed (green earlier in window → latest not ok), improved (red earlier → latest ok).
export function computeTrend(historyText, { window = 10 } = {}) {
  const all = parseEntries(historyText);
  const w = Math.max(2, Math.floor(Number(window)) || 10);
  const entries = all.slice(-w);

  // collect ordered per-app series over the window (only runs where the app was present)
  const order = [];
  const acc = {};
  for (const e of entries) {
    for (const a of e.apps || []) {
      const key = `${a.stack} (${a.label})`;
      if (!acc[key]) {
        acc[key] = { stack: a.stack, label: a.label, series: [] };
        order.push(key);
      }
      acc[key].series.push({ ok: !!a.ok, errored: !!a.errored, coverage: a.coverage ?? null });
    }
  }

  const apps = {};
  const regressedKeys = [];
  const improvedKeys = [];
  for (const key of order) {
    const series = acc[key].series.map((s) => ({ ok: s.ok, coverage: s.coverage }));
    const raw = acc[key].series;
    const runs = raw.length;

    const sparkline = raw.map((s) => (s.ok ? '✓' : s.errored ? '·' : '✗')).join('');

    // pass direction: second half vs first half of the present series
    const mid = Math.floor(runs / 2);
    const firstHalf = raw.slice(0, mid).map((s) => s.ok);
    const secondHalf = raw.slice(mid).map((s) => s.ok);
    const passRatePrev = passRate(firstHalf);
    const passRateNow = passRate(secondHalf);
    const passDir = dirOf(passRateNow - passRatePrev);

    // coverage direction: first vs last non-null coverage in the window
    const covVals = raw.map((s) => s.coverage).filter((c) => c != null);
    const coverageFirst = covVals.length ? covVals[0] : null;
    const coverageNow = covVals.length ? covVals[covVals.length - 1] : null;
    const coverageDelta =
      coverageFirst != null && coverageNow != null ? Math.round(coverageNow - coverageFirst) : null;
    const coverageDir = coverageDelta == null ? 'flat' : dirOf(coverageDelta);

    // regressed / improved: was the app ever the OPPOSITE earlier in the window vs the latest run?
    const latestOk = raw[runs - 1].ok;
    const earlierOks = raw.slice(0, runs - 1).map((s) => s.ok);
    const regressed = latestOk === false && earlierOks.some((ok) => ok === true);
    const improved = latestOk === true && earlierOks.some((ok) => ok === false);
    if (regressed) regressedKeys.push(key);
    if (improved) improvedKeys.push(key);

    apps[key] = {
      stack: acc[key].stack,
      label: acc[key].label,
      runs,
      series,
      sparkline,
      passRatePrev,
      passRateNow,
      passDir,
      coverageFirst,
      coverageNow,
      coverageDelta,
      coverageDir,
      regressed,
      improved,
    };
  }

  return { window: w, totalRuns: entries.length, apps, regressedKeys, improvedKeys };
}

const ARROW = { up: '↑', down: '↓', flat: '→' };

// formatTrend(trend) → readable multi-line block. Empty history → the standard message.
export function formatTrend(trend) {
  if (!trend || trend.totalRuns === 0) {
    return 'No run history yet — run `testctl run` first.';
  }
  const lines = [
    `testctl trend — last ${trend.totalRuns} run${trend.totalRuns === 1 ? '' : 's'} (window ${trend.window})`,
    '────────────────────────────────────────────',
    `  ${'App'.padEnd(28)} ${'Trend'.padEnd(12)} ${'Pass'.padStart(5)}  ${'Coverage'.padEnd(12)}  Status`,
  ];
  for (const [key, a] of Object.entries(trend.apps)) {
    const spark = a.sparkline.padEnd(12);
    const pass = `${ARROW[a.passDir]}${String(a.passRateNow).padStart(3)}%`;
    let cov;
    if (a.coverageNow == null) {
      cov = '—';
    } else if (a.coverageDelta != null && a.coverageDelta !== 0) {
      const sign = a.coverageDelta > 0 ? '+' : '';
      cov = `${ARROW[a.coverageDir]}${a.coverageNow}% (${sign}${a.coverageDelta})`;
    } else {
      cov = `${ARROW[a.coverageDir]}${a.coverageNow}%`;
    }
    const status = a.regressed ? 'REGRESSED' : a.improved ? 'improved' : 'steady';
    lines.push(`  ${key.padEnd(28)} ${spark} ${pass}  ${cov.padEnd(12)}  ${status}`);
  }
  lines.push('────────────────────────────────────────────');
  if (trend.regressedKeys.length) {
    lines.push(`⚠ ${trend.regressedKeys.length} app(s) newly failing: ${trend.regressedKeys.join(', ')}`);
  } else if (trend.improvedKeys.length) {
    lines.push(`✓ ${trend.improvedKeys.length} app(s) improving: ${trend.improvedKeys.join(', ')}`);
  } else {
    lines.push('✓ all steady — no newly failing apps in the window.');
  }
  return lines.join('\n');
}
