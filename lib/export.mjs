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
