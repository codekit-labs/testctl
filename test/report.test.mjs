import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeResult } from '../lib/result.mjs';
import { formatReport, computeExitCode } from '../lib/report.mjs';

test('computeExitCode is 0 when all present stacks pass', () => {
  const results = [
    makeResult({ stack: 'frappe', passed: 5, failed: 0 }),
    makeResult({ stack: 'flutter', present: false }),
  ];
  assert.equal(computeExitCode(results), 0);
});

test('computeExitCode is 1 when any stack has failures', () => {
  const results = [
    makeResult({ stack: 'frappe', passed: 5, failed: 0 }),
    makeResult({ stack: 'flutter', passed: 2, failed: 1 }),
  ];
  assert.equal(computeExitCode(results), 1);
});

test('computeExitCode is 1 when any stack errored', () => {
  const results = [makeResult({ stack: 'electron', errored: true, error: 'jest missing' })];
  assert.equal(computeExitCode(results), 1);
});

test('formatReport lists present stacks and notes absent ones', () => {
  const results = [
    makeResult({ stack: 'frappe', passed: 42, failed: 0, skipped: 1, durationMs: 18200 }),
    makeResult({ stack: 'flutter', present: false }),
    makeResult({ stack: 'electron', passed: 15, failed: 0, durationMs: 6100 }),
  ];
  const out = formatReport(results);
  assert.match(out, /Frappe/);
  assert.match(out, /Electron/);
  assert.match(out, /42/);
  assert.match(out, /Flutter/);
  assert.match(out, /not present/i);
});

test('formatReport shows an errored stack with its message', () => {
  const results = [makeResult({ stack: 'flutter', errored: true, error: 'flutter not found on PATH' })];
  const out = formatReport(results);
  assert.match(out, /flutter not found on PATH/);
});

test('formatReport renders Next.js and Supabase labels', () => {
  const results = [
    makeResult({ stack: 'nextjs', passed: 3, failed: 0, durationMs: 1200 }),
    makeResult({ stack: 'supabase', passed: 14, failed: 1, durationMs: 8000 }),
  ];
  const out = formatReport(results);
  assert.match(out, /Next\.js/);
  assert.match(out, /Supabase/);
  assert.match(out, /14/);
});
