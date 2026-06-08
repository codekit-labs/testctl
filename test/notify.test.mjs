import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeResult } from '../lib/result.mjs';
import { notifyText, buildNotifyPayload } from '../lib/notify.mjs';

test('buildNotifyPayload includes only failing apps + totals', () => {
  const results = [
    makeResult({ stack: 'flutter', label: 'a', passed: 2, failed: 1 }),
    makeResult({ stack: 'electron', label: 'd', passed: 3, failed: 0 }),
    makeResult({ stack: 'frappe', errored: true, error: 'boom' }),
  ];
  const p = buildNotifyPayload(results, { project: 'proj' });
  assert.equal(p.project, 'proj');
  assert.equal(p.totals.failed, 1);
  assert.equal(p.failed.length, 2);                       // flutter (fail) + frappe (errored)
  const frappe = p.failed.find((f) => f.app === 'frappe');
  assert.equal(frappe.errored, true);
  assert.equal(frappe.error, 'boom');
  assert.match(p.text, /red/);
});

test('notifyText / green run has no failed apps', () => {
  const p = buildNotifyPayload([makeResult({ stack: 'flutter', label: 'a', passed: 5, failed: 0 })]);
  assert.equal(p.failed.length, 0);
  assert.match(notifyText([makeResult({ stack: 'flutter', label: 'a', passed: 5, failed: 0 })]), /0 app/);
});
