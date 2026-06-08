import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeResult } from '../lib/result.mjs';
import { toJUnitXml, toSarif } from '../lib/export.mjs';

test('toJUnitXml aggregates totals and emits a failure testcase per digest entry', () => {
  const results = [
    makeResult({ stack: 'flutter', label: 'a', passed: 2, failed: 1, skipped: 0, durationMs: 4000,
      failures: [{ test: 'adds', file: 'm_test.dart', line: 12, message: 'Expected 2 got 3 <&>' }] }),
    makeResult({ stack: 'electron', label: 'd', passed: 3, failed: 0 }),
  ];
  const xml = toJUnitXml(results);
  assert.match(xml, /^<\?xml/);
  assert.match(xml, /<testsuites tests="6" failures="1" errors="0"/);
  assert.match(xml, /<testsuite name="flutter \(a\)" tests="3" failures="1"/);
  assert.match(xml, /<testcase name="adds"/);
  assert.match(xml, /Expected 2 got 3 &lt;&amp;&gt;/);            // escaped
});

test('toJUnitXml renders errored as <error> and cached as skipped', () => {
  const xml = toJUnitXml([
    makeResult({ stack: 'frappe', errored: true, error: 'bench "boom"' }),
    makeResult({ stack: 'electron', label: 'd', present: true, cached: true }),
  ]);
  assert.match(xml, /errors="1"/);
  assert.match(xml, /<error message="bench &quot;boom&quot;"/);
  assert.match(xml, /<skipped\/>/);
});

test('toSarif is 2.1.0 with one result per failure; location only when file present', () => {
  const s = toSarif([
    makeResult({ stack: 'flutter', label: 'a', failed: 2, failures: [
      { test: 't1', file: 'x.dart', line: 9, message: 'boom' },
      { test: 't2', file: null, line: null, message: 'bang' },
    ] }),
  ]);
  assert.equal(s.version, '2.1.0');
  assert.equal(s.runs[0].tool.driver.name, 'testctl');
  assert.equal(s.runs[0].results.length, 2);
  assert.equal(s.runs[0].results[0].level, 'error');
  assert.equal(s.runs[0].results[0].locations[0].physicalLocation.artifactLocation.uri, 'x.dart');
  assert.equal(s.runs[0].results[0].locations[0].physicalLocation.region.startLine, 9);
  assert.equal(s.runs[0].results[1].locations, undefined);          // no file → no location
  JSON.parse(JSON.stringify(s));                                     // round-trips
});

test('toSarif emits an error result for an errored app', () => {
  const s = toSarif([makeResult({ stack: 'frappe', errored: true, error: 'no junit' })]);
  assert.equal(s.runs[0].results.length, 1);
  assert.match(s.runs[0].results[0].message.text, /no junit/);
});
