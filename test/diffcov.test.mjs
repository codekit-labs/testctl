import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseLcovLines,
  parseDiffRanges,
  patchCoverage,
  formatPatchCoverage,
} from '../lib/diffcov.mjs';

// ---- sample lcov: two files, per-line DA records ----
const SAMPLE_LCOV = `TN:
SF:/repo/src/a.js
DA:1,5
DA:2,0
DA:3,1
DA:10,0
LF:4
LH:2
end_of_record
SF:/repo/src/b.js
DA:1,0
DA:2,2
LF:2
LH:1
end_of_record
`;

test('parseLcovLines builds file -> (line -> hits) map', () => {
  const m = parseLcovLines(SAMPLE_LCOV);
  assert.equal(m.size, 2);
  const a = m.get('/repo/src/a.js');
  assert.ok(a instanceof Map);
  assert.equal(a.get(1), 5);
  assert.equal(a.get(2), 0);
  assert.equal(a.get(3), 1);
  assert.equal(a.get(10), 0);
  const b = m.get('/repo/src/b.js');
  assert.equal(b.get(1), 0);
  assert.equal(b.get(2), 2);
});

test('parseLcovLines on empty / malformed input returns empty map (no throw)', () => {
  assert.equal(parseLcovLines('').size, 0);
  assert.equal(parseLcovLines('garbage\nDA:nope\nSF:\n').size, 0);
  assert.equal(parseLcovLines(undefined).size, 0);
});

// ---- sample unified diff: one modified file (two hunks), one added file, one pure deletion ----
const SAMPLE_DIFF = `diff --git a/src/a.js b/src/a.js
index 111..222 100644
--- a/src/a.js
+++ b/src/a.js
@@ -1,3 +1,4 @@
 line1
+line2added
 line3
 line4
@@ -8,2 +9,3 @@
 ctx
+line10added
 ctx2
diff --git a/src/added.js b/src/added.js
new file mode 100644
index 000..333
--- /dev/null
+++ b/src/added.js
@@ -0,0 +1,2 @@
+brand1
+brand2
diff --git a/src/gone.js b/src/gone.js
deleted file mode 100644
index 444..000
--- a/src/gone.js
+++ /dev/null
@@ -1,2 +0,0 @@
-old1
-old2
`;

test('parseDiffRanges marks NEW-file added line numbers per file', () => {
  const r = parseDiffRanges(SAMPLE_DIFF);
  const a = r.get('src/a.js');
  assert.ok(a instanceof Set);
  // hunk1 @@ +1,4 : +line2added is new line 2; hunk2 @@ +9,3 : +line10added is new line 10
  assert.deepEqual([...a].sort((x, y) => x - y), [2, 10]);
  const added = r.get('src/added.js');
  assert.deepEqual([...added].sort((x, y) => x - y), [1, 2]);
});

test('parseDiffRanges: a pure-deletion file contributes no added lines', () => {
  const r = parseDiffRanges(SAMPLE_DIFF);
  const gone = r.get('src/gone.js');
  // either absent or an empty set — no NEW lines were added
  assert.ok(gone === undefined || gone.size === 0);
});

test('parseDiffRanges on empty input returns empty map (no throw)', () => {
  assert.equal(parseDiffRanges('').size, 0);
  assert.equal(parseDiffRanges(undefined).size, 0);
});

// ---- patchCoverage: intersect changed lines with lcov DA lines ----
test('patchCoverage counts only executable changed lines and lists uncovered', () => {
  const lcov = new Map([
    ['/repo/src/a.js', new Map([[1, 5], [2, 0], [3, 1], [10, 0]])],
  ]);
  // map keys must match lcov keys; the wrapper resolves diff paths to lcov paths.
  const ranges = new Map([
    ['/repo/src/a.js', new Set([2, 3, 5, 10])], // line 5 is NOT in DA → not executable, ignored
  ]);
  const rep = patchCoverage(lcov, ranges);
  assert.equal(rep.files.length, 1);
  const f = rep.files[0];
  assert.equal(f.file, '/repo/src/a.js');
  // executable changed lines = {2,3,10}; covered (hits>0) = {3} ; uncovered = [2,10]
  assert.equal(f.total, 3);
  assert.equal(f.covered, 1);
  assert.equal(f.pct, 33);
  assert.deepEqual(f.uncovered, [2, 10]);
  assert.equal(rep.overall.covered, 1);
  assert.equal(rep.overall.total, 3);
  assert.equal(rep.overall.pct, 33);
});

test('patchCoverage omits files with no executable changed lines', () => {
  const lcov = new Map([['/repo/src/a.js', new Map([[1, 5]])]]);
  const ranges = new Map([
    ['/repo/src/a.js', new Set([1])],
    ['/repo/src/c.js', new Set([4, 5])], // not in lcov at all → omitted
  ]);
  const rep = patchCoverage(lcov, ranges);
  assert.equal(rep.files.length, 1);
  assert.equal(rep.files[0].file, '/repo/src/a.js');
});

test('patchCoverage with no measurable lines → overall pct null', () => {
  const lcov = new Map([['/repo/src/a.js', new Map([[1, 5]])]]);
  const ranges = new Map([['/repo/src/a.js', new Set([99])]]); // 99 not executable
  const rep = patchCoverage(lcov, ranges);
  assert.equal(rep.files.length, 0);
  assert.equal(rep.overall.total, 0);
  assert.equal(rep.overall.pct, null);
});

test('patchCoverage on empty inputs → null pct, no throw', () => {
  const rep = patchCoverage(new Map(), new Map());
  assert.equal(rep.overall.pct, null);
  assert.equal(rep.files.length, 0);
});

// ---- formatPatchCoverage ----
test('formatPatchCoverage shows overall, per-file, uncovered — no gate', () => {
  const rep = {
    overall: { covered: 1, total: 3, pct: 33 },
    files: [{ file: '/repo/src/a.js', covered: 1, total: 3, pct: 33, uncovered: [2, 10] }],
  };
  const out = formatPatchCoverage(rep, null);
  assert.match(out, /Patch coverage/i);
  assert.match(out, /33%/);
  assert.match(out, /1\/3/);
  assert.match(out, /a\.js/);
  assert.match(out, /2, 10/);
  assert.doesNotMatch(out, /gate/i);
});

test('formatPatchCoverage with gate shows pass/fail verdict', () => {
  const rep = { overall: { covered: 1, total: 3, pct: 33 }, files: [{ file: 'a.js', covered: 1, total: 3, pct: 33, uncovered: [2] }] };
  const fail = formatPatchCoverage(rep, 80);
  assert.match(fail, /gate/i);
  assert.match(fail, /80/);
  assert.match(fail, /FAIL|below/i);
  const pass = formatPatchCoverage({ overall: { covered: 3, total: 3, pct: 100 }, files: [] }, 80);
  assert.match(pass, /PASS|meets|ok/i);
});

test('formatPatchCoverage with nothing measurable → graceful line', () => {
  const out = formatPatchCoverage({ overall: { covered: 0, total: 0, pct: null }, files: [] }, null);
  assert.match(out, /no measurable patch coverage/i);
});
