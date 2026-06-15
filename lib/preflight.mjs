// Frappe test-readiness preflight. PURE: decisions/rendering operate on already-gathered inputs
// (the file reads / python probe live in the CLI). Catches the known bootstrap blockers upfront.

// inputs: { configured=true, remote=false, devReqsOk, siteConfig, appsWithBeforeTests, apps }
export function frappePreflight(inputs = {}) {
  const { configured = true, remote = false } = inputs;
  if (!configured) {
    return { ok: true, blockers: 0, checks: [
      { id: 'configured', label: 'Frappe stack configured', ok: true, blocking: false,
        fix: 'No Frappe stack in testctl.yaml — nothing to preflight' },
    ] };
  }
  if (remote) {
    return { ok: true, blockers: 0, checks: [
      { id: 'remote', label: 'Local bench', ok: true, blocking: false,
        fix: 'Remote (ssh) bench — run `testctl preflight` on the bench itself' },
    ] };
  }
  const siteConfig = inputs.siteConfig || {};
  const appsWithBeforeTests = inputs.appsWithBeforeTests || [];
  const checks = [
    { id: 'devReqs', label: 'Dev/test requirements (xmlrunner, coverage)', ok: !!inputs.devReqsOk, blocking: true,
      fix: 'Run: bench setup requirements --dev   (one-time bench setup)' },
    { id: 'allowTests', label: 'allow_tests enabled on the site', ok: !!siteConfig.allow_tests, blocking: true,
      fix: 'Run: bench --site <site> set-config allow_tests true' },
    { id: 'encryptionKey', label: 'encryption_key present in site_config', ok: !!siteConfig.encryption_key, blocking: true,
      fix: 'Restore the original encryption_key in site_config.json (restored-site key mismatch)' },
    { id: 'beforeTests', label: 'before_tests hook present in an app', ok: appsWithBeforeTests.length > 0, blocking: false,
      fix: 'Run /testctl:frappe-bootstrap to generate a before_tests hook (if test masters miss fields/masters)' },
  ];
  const blockers = checks.filter((c) => c.blocking && !c.ok).length;
  return { ok: blockers === 0, blockers, checks };
}

// Render the report as a checklist string. opts.site substitutes the <site> placeholder in fixes.
export function formatPreflight(report, opts = {}) {
  const site = opts.site || '<site>';
  const lines = ['testctl preflight (Frappe)', '─────────────────────────'];
  for (const c of report.checks) {
    const mark = c.ok ? '✓' : (c.blocking ? '✗' : '⚠');
    lines.push(`  ${mark} ${c.label}`);
    if (!c.ok) lines.push(`      → ${c.fix.replace('<site>', site)}`);
  }
  lines.push(report.ok
    ? 'Ready to run tests: testctl run frappe'
    : `${report.blockers} blocker(s) — fix the ✗ items above, then: testctl run frappe`);
  return lines.join('\n');
}

// Pure: the doctor pointer line when a Frappe stack is configured, else null.
export function frappePointer(config) {
  const f = config && config.stacks ? config.stacks.frappe : null;
  const list = Array.isArray(f) ? f : (f ? [f] : []);
  return list.length ? 'A Frappe stack is configured — run `testctl preflight` to check test-readiness.' : null;
}
