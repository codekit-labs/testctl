// Pure helpers for `testctl context` — the per-app "what should a skill do here" digest.

// Pure: the single recommended action for an app, from its state.
export function actionFor(app) {
  if (!app.hasTests) return 'generate';     // no tests → generate-tests
  if (app.status === 'red') return 'fix';   // failing → fix-failures
  if (app.belowGate) return 'boost';        // green but under the coverage gate → coverage-boost
  if ((app.untestedCount || 0) > 0) return 'harden'; // green, but untested symbols remain → harden
  return 'ok';
}

// Pure: a compact human summary of the context (the machine reads TESTCTL_CONTEXT json instead).
export function formatContext(apps) {
  if (!apps.length) return 'No testable apps found.';
  const lines = ['testctl context', '──────────────'];
  for (const a of apps) {
    const name = a.label && a.label !== a.stack ? `${a.stack} (${a.label})` : a.stack;
    const status = !a.hasTests ? 'no-tests' : a.status;
    const cov = a.coverage != null ? `${a.coverage}%` : '—';
    lines.push(`  [${actionFor(a)}] ${name.padEnd(24)} tests:${String(a.tests ?? 0).padStart(4)}  ${String(status).padEnd(8)} cov:${cov.padStart(4)}  untested:${a.untestedCount || 0}`);
  }
  lines.push('Actions: generate (no tests) · fix (red) · boost (below gate) · harden (untested symbols) · ok');
  return lines.join('\n');
}
