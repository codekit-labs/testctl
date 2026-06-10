import { test } from 'node:test';
import assert from 'node:assert/strict';
import { langOf, isTestFile, extractSymbols, untestedSymbols } from '../lib/symbols.mjs';

test('langOf maps extensions', () => {
  assert.equal(langOf('a/b.py'), 'py');
  assert.equal(langOf('lib/main.dart'), 'dart');
  assert.equal(langOf('src/x.ts'), 'js');
  assert.equal(langOf('src/x.tsx'), 'js');
  assert.equal(langOf('README.md'), null);
});

test('isTestFile recognises conventions', () => {
  assert.equal(isTestFile('test/foo_test.dart'), true);
  assert.equal(isTestFile('jms/doctype/job/test_job.py'), true);
  assert.equal(isTestFile('src/math.test.ts'), true);
  assert.equal(isTestFile('src/math.spec.js'), true);
  assert.equal(isTestFile('lib/math.dart'), false);
});

test('extractSymbols: python defs and classes, skips private', () => {
  const py = 'def add(a, b):\n    return a + b\n\nclass Job:\n    def _hidden(self):\n        pass\n    def get_total(self):\n        return 1\n';
  const s = extractSymbols(py, 'py');
  const names = s.map((x) => x.name);
  assert.deepEqual(names.sort(), ['Job', 'add', 'get_total']);
  assert.equal(s.find((x) => x.name === 'add').kind, 'function');
  assert.equal(s.find((x) => x.name === 'Job').kind, 'class');
});

test('extractSymbols: js functions, arrows, classes', () => {
  const js = 'export function adds(a){return a}\nconst sub = (a) => a-1\nexport class Money {}\nif (x) {}\n';
  const names = extractSymbols(js, 'js').map((x) => x.name).sort();
  assert.deepEqual(names, ['Money', 'adds', 'sub']);
});

test('extractSymbols: dart classes and functions', () => {
  const dart = 'class Cart {}\nint total(int a) {\n  return a;\n}\nvoid main() {}\n';
  const names = extractSymbols(dart, 'dart').map((x) => x.name).sort();
  assert.ok(names.includes('Cart'));
  assert.ok(names.includes('total'));
  assert.ok(names.includes('main'));
});

test('untestedSymbols filters by name reference in test text', () => {
  const syms = [{ name: 'add', line: 1, kind: 'function' }, { name: 'subtract', line: 2, kind: 'function' }];
  const testText = 'test("add works", () => { expect(add(1,1)).toBe(2); });';
  const out = untestedSymbols(syms, testText);
  assert.deepEqual(out.map((s) => s.name), ['subtract']);
});
