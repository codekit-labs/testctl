function xmlEscape(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function suiteName(r) {
  return r.label && r.label !== r.stack ? `${r.stack} (${r.label})` : r.stack;
}

// Pure: JUnit XML over present results.
export function toJUnitXml(results) {
  const present = results.filter((r) => r.present);
  let T = 0, F = 0, E = 0, S = 0;
  const suites = [];
  for (const r of present) {
    const name = suiteName(r);
    const time = ((r.durationMs || 0) / 1000).toFixed(3);
    if (r.cached) {
      S += 1;
      suites.push(`  <testsuite name="${xmlEscape(name)}" tests="1" failures="0" errors="0" skipped="1">\n    <testcase name="cached" classname="${xmlEscape(name)}"><skipped/></testcase>\n  </testsuite>`);
      continue;
    }
    if (r.errored) {
      E += 1; T += 1;
      const msg = r.error || 'errored';
      suites.push(`  <testsuite name="${xmlEscape(name)}" tests="1" failures="0" errors="1" skipped="0" time="${time}">\n    <testcase name="${xmlEscape(name)}" classname="${xmlEscape(name)}"><error message="${xmlEscape(msg)}">${xmlEscape(msg)}</error></testcase>\n  </testsuite>`);
      continue;
    }
    const tests = (r.passed || 0) + (r.failed || 0) + (r.skipped || 0);
    T += tests; F += (r.failed || 0); S += (r.skipped || 0);
    const cases = (r.failures || []).map((f) => {
      const first = String(f.message || '').split('\n')[0].slice(0, 300);
      return `    <testcase name="${xmlEscape(f.test)}" classname="${xmlEscape(name)}"><failure message="${xmlEscape(first)}">${xmlEscape(f.message)}</failure></testcase>`;
    });
    suites.push(`  <testsuite name="${xmlEscape(name)}" tests="${tests}" failures="${r.failed || 0}" errors="0" skipped="${r.skipped || 0}" time="${time}">${cases.length ? '\n' + cases.join('\n') + '\n  ' : ''}</testsuite>`);
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<testsuites tests="${T}" failures="${F}" errors="${E}" skipped="${S}">\n${suites.join('\n')}\n</testsuites>\n`;
}

// Pure: SARIF 2.1.0 object (caller JSON.stringifies).
export function toSarif(results) {
  const out = [];
  for (const r of results.filter((x) => x.present)) {
    const app = suiteName(r);
    if (r.errored) {
      out.push({ ruleId: r.stack, level: 'error', message: { text: `${app}: ${r.error || 'errored'}` } });
      continue;
    }
    for (const f of r.failures || []) {
      const res = { ruleId: r.stack, level: 'error', message: { text: `${app}: ${f.test}\n${f.message}` } };
      if (f.file) {
        res.locations = [{
          physicalLocation: {
            artifactLocation: { uri: f.file },
            ...(f.line ? { region: { startLine: f.line } } : {}),
          },
        }];
      }
      out.push(res);
    }
  }
  return {
    version: '2.1.0',
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    runs: [{ tool: { driver: { name: 'testctl', informationUri: 'https://github.com/codekit-labs/testctl', rules: [] } }, results: out }],
  };
}

// Pure: a Markdown results table + failures section (pipe-safe).
export function toMarkdown(results) {
  const present = (results || []).filter((r) => r.present);
  const escapePipe = (s) => String(s == null ? '' : s).replace(/\|/g, '\\|');
  const status = (r) => r.cached ? '✓ cached' : r.errored ? '✗ error' : r.flaky ? '⚑ flaky' : r.failed > 0 ? '✗ fail' : '✓ pass';
  const rows = present.map((r) => {
    const name = escapePipe(suiteName(r));
    const cov = r.coverage != null ? r.coverage + '%' : '—';
    return `| ${name} | ${r.passed || 0} | ${r.failed || 0} | ${r.skipped || 0} | ${cov} | ${status(r)} |`;
  });
  const table = [
    '| App | Passed | Failed | Skipped | Cov | Status |',
    '|-----|--------|--------|---------|-----|--------|',
    ...rows,
  ].join('\n');
  const failSections = present.filter((r) => (r.failures || []).length).map((r) => {
    const name = suiteName(r);
    const items = r.failures.map((f) => `**${escapePipe(f.test)}**\n\`\`\`\n${f.message}\n\`\`\``).join('\n\n');
    return `### ${name}\n\n${items}`;
  });
  const failBlock = failSections.length ? `\n\n## Failures\n\n${failSections.join('\n\n')}` : '';
  return `## testctl report\n\n${table}${failBlock}\n`;
}

// Pure: a single self-contained HTML results page (no external assets).
export function toHtml(results) {
  const present = (results || []).filter((r) => r.present);
  const t = present.reduce((a, r) => ({
    passed: a.passed + (r.passed || 0),
    failed: a.failed + (r.failed || 0),
    skipped: a.skipped + (r.skipped || 0),
  }), { passed: 0, failed: 0, skipped: 0 });
  const status = (r) => r.cached ? '✓ cached' : r.errored ? '✗ error' : r.flaky ? '⚑ flaky' : r.failed > 0 ? '✗ fail' : '✓ pass';
  const rows = present.map((r) => {
    const n = xmlEscape(suiteName(r));
    const cov = r.coverage != null ? r.coverage + '%' : '—';
    return `<tr><td>${n}</td><td>${r.passed || 0}</td><td>${r.failed || 0}</td><td>${r.skipped || 0}</td><td>${cov}</td><td>${status(r)}</td></tr>`;
  }).join('\n');
  const failBlocks = present.filter((r) => (r.failures || []).length).map((r) => {
    const n = xmlEscape(suiteName(r));
    const items = r.failures.map((f) => `<div class="f"><strong>${xmlEscape(f.test)}</strong><pre>${xmlEscape(f.message)}</pre></div>`).join('\n');
    return `<section><h3>${n}</h3>${items}</section>`;
  }).join('\n');
  const failHtml = failBlocks ? `<h2>Failures</h2>${failBlocks}` : '';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>testctl report</title>
<style>
  :root{--green:#14492e;--gold:#c9a227;--cream:#f7f3e8;--ink:#1c2620}
  body{margin:0;font:15px/1.5 system-ui,sans-serif;background:var(--cream);color:var(--ink)}
  header{background:var(--green);color:var(--cream);padding:20px 24px}
  header h1{margin:0 0 4px;font-size:20px}
  .totals{color:var(--gold);font-weight:600}
  main{padding:24px;max-width:900px}
  table{width:100%;border-collapse:collapse;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.08)}
  th,td{padding:8px 12px;text-align:left;border-bottom:1px solid #e7e1cf}
  th{background:var(--green);color:var(--cream);font-weight:600}
  h2{color:var(--green);border-bottom:2px solid var(--gold);padding-bottom:4px}
  section h3{color:var(--green);margin:16px 0 4px}
  .f pre{background:#2b2b2b;color:#eee;padding:10px;border-radius:4px;overflow:auto;white-space:pre-wrap}
</style></head>
<body>
<header><h1>testctl report</h1><div class="totals">${present.length} app(s) · ${t.passed} passed · ${t.failed} failed · ${t.skipped} skipped</div></header>
<main>
<table><thead><tr><th>App</th><th>Passed</th><th>Failed</th><th>Skipped</th><th>Cov</th><th>Status</th></tr></thead>
<tbody>
${rows}
</tbody></table>
${failHtml}
</main></body></html>
`;
}
