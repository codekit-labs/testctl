import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeResult } from '../lib/result.mjs';
import { toJUnitXml, toSarif, toMarkdown } from '../lib/export.mjs';
import { toHtml } from '../lib/export.mjs';

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

test('toHtml is a self-contained page listing apps and failures, escaped', () => {
  const results = [
    makeResult({ stack: 'flutter', label: 'a', passed: 2, failed: 1, durationMs: 1000,
      failures: [{ test: 'adds <x>', file: null, line: null, message: 'Expected 2 & got 3' }] }),
    makeResult({ stack: 'electron', label: 'd', passed: 3, failed: 0 }),
  ];
  const html = toHtml(results);
  assert.match(html, /^<!doctype html>/i);
  assert.match(html, /flutter \(a\)/);
  assert.match(html, /electron \(d\)/);
  assert.match(html, /adds &lt;x&gt;/);            // test name escaped
  assert.match(html, /Expected 2 &amp; got 3/);    // message escaped
  assert.match(html, /<\/html>\s*$/);
});

test('toHtml green-only run has no failure rows', () => {
  const html = toHtml([makeResult({ stack: 'flutter', label: 'a', passed: 5, failed: 0 })]);
  assert.match(html, /^<!doctype html>/i);
  assert.equal(/<pre/.test(html), false);          // no failure <pre> blocks
});

test('toMarkdown has header row, one row per app, and failure section', () => {
  const results = [
    makeResult({ stack: 'flutter', label: 'a', passed: 2, failed: 1, durationMs: 1000,
      failures: [{ test: 'adds', file: null, line: null, message: 'Expected 2 got 3' }] }),
    makeResult({ stack: 'electron', label: 'd', passed: 3, failed: 0 }),
  ];
  const md = toMarkdown(results);
  assert.match(md, /^## testctl report/);
  assert.match(md, /\| App \| Passed \| Failed \| Skipped \| Cov \| Status \|/);
  assert.match(md, /flutter \(a\)/);
  assert.match(md, /electron \(d\)/);
  assert.match(md, /## Failures/);
  assert.match(md, /adds/);
  assert.match(md, /Expected 2 got 3/);
});

test('toMarkdown escapes pipe characters in names and messages', () => {
  const results = [
    makeResult({ stack: 'flutter', label: 'a|b', passed: 1, failed: 1,
      failures: [{ test: 'x|y', file: null, line: null, message: 'got a|b' }] }),
  ];
  const md = toMarkdown(results);
  assert.match(md, /a\\|b/);                       // label pipe escaped in table row
  assert.match(md, /x\\|y/);                       // test name pipe escaped in failure section
});

test('toMarkdown green-only run has no failures section', () => {
  const md = toMarkdown([makeResult({ stack: 'flutter', label: 'a', passed: 5, failed: 0 })]);
  assert.match(md, /^## testctl report/);
  assert.equal(/## Failures/.test(md), false);
});
