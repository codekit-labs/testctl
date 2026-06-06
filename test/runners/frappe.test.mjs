import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFrappeJUnit } from '../../lib/runners/frappe.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const xml = readFileSync(join(here, '../fixtures/frappe-junit.xml'), 'utf8');

test('parseFrappeJUnit counts passed/failed/skipped across testsuites', () => {
  const r = parseFrappeJUnit(xml);
  // tests=5, failures=1, skipped=1 -> passed = 5 - 1 - 0 - 1 = 3
  assert.equal(r.failed, 1);
  assert.equal(r.skipped, 1);
  assert.equal(r.passed, 3);
});

test('parseFrappeJUnit handles a single testsuite (not wrapped in testsuites)', () => {
  const single = '<testsuite tests="2" failures="0" errors="1" skipped="0"></testsuite>';
  const r = parseFrappeJUnit(single);
  assert.equal(r.failed, 1); // errors count as failed
  assert.equal(r.passed, 1);
  assert.equal(r.skipped, 0);
});
