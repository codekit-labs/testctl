import { test } from 'node:test';
import assert from 'node:assert/strict';
import { frappePreflight, formatPreflight, frappePointer } from '../lib/preflight.mjs';

test('frappePreflight: all hard checks pass → ok, 0 blockers', () => {
  const r = frappePreflight({
    configured: true, remote: false, devReqsOk: true,
    siteConfig: { allow_tests: 1, encryption_key: 'abc' },
    appsWithBeforeTests: ['jms'], apps: ['jms'],
  });
  assert.equal(r.ok, true);
  assert.equal(r.blockers, 0);
  assert.equal(r.checks.find((c) => c.id === 'allowTests').ok, true);
});

test('frappePreflight: each missing hard input → that check fails and report not ok', () => {
  const base = { configured: true, remote: false, devReqsOk: true, siteConfig: { allow_tests: 1, encryption_key: 'abc' }, appsWithBeforeTests: ['a'], apps: ['a'] };
  const noDev = frappePreflight({ ...base, devReqsOk: false });
  assert.equal(noDev.checks.find((c) => c.id === 'devReqs').ok, false);
  assert.equal(noDev.ok, false);
  const noAllow = frappePreflight({ ...base, siteConfig: { encryption_key: 'abc' } });
  assert.equal(noAllow.checks.find((c) => c.id === 'allowTests').ok, false);
  assert.equal(noAllow.ok, false);
  const noKey = frappePreflight({ ...base, siteConfig: { allow_tests: 1 } });
  assert.equal(noKey.checks.find((c) => c.id === 'encryptionKey').ok, false);
  assert.equal(noKey.ok, false);
});

test('frappePreflight: missing before_tests is a NON-blocking warning (report still ok)', () => {
  const r = frappePreflight({ configured: true, remote: false, devReqsOk: true, siteConfig: { allow_tests: 1, encryption_key: 'abc' }, appsWithBeforeTests: [], apps: ['a'] });
  const bt = r.checks.find((c) => c.id === 'beforeTests');
  assert.equal(bt.ok, false);
  assert.equal(bt.blocking, false);
  assert.equal(r.ok, true);
  assert.equal(r.blockers, 0);
});

test('frappePreflight: not configured → single info check, ok', () => {
  const r = frappePreflight({ configured: false });
  assert.equal(r.ok, true);
  assert.equal(r.checks.length, 1);
  assert.equal(r.checks[0].blocking, false);
});

test('frappePreflight: remote bench → single info check, ok', () => {
  const r = frappePreflight({ configured: true, remote: true });
  assert.equal(r.ok, true);
  assert.match(r.checks[0].fix, /remote/i);
});

test('formatPreflight: shows ✗ + fix for a hard fail, substitutes the site', () => {
  const r = frappePreflight({ configured: true, remote: false, devReqsOk: true, siteConfig: { encryption_key: 'abc' }, appsWithBeforeTests: ['a'], apps: ['a'] });
  const out = formatPreflight(r, { site: 'demo.local' });
  assert.match(out, /✗ allow_tests/);
  assert.match(out, /set-config allow_tests true/);
  assert.match(out, /demo\.local/);
  assert.match(out, /blocker/i);
});

test('formatPreflight: all-green shows the ready line', () => {
  const r = frappePreflight({ configured: true, remote: false, devReqsOk: true, siteConfig: { allow_tests: 1, encryption_key: 'abc' }, appsWithBeforeTests: ['a'], apps: ['a'] });
  assert.match(formatPreflight(r, { site: 's' }), /Ready to run tests/);
});

test('formatPreflight: not-configured prints an info line, not a ready/blocker line', () => {
  const out = formatPreflight(frappePreflight({ configured: false }));
  assert.match(out, /ℹ No Frappe stack configured/);
  assert.match(out, /testctl init/);
  assert.doesNotMatch(out, /Ready to run tests/);
  assert.doesNotMatch(out, /blocker/i);
  assert.doesNotMatch(out, /✓ Frappe stack configured/); // the old misleading line is gone
});

test('formatPreflight: remote bench prints an info line, no ready/blocker line', () => {
  const out = formatPreflight(frappePreflight({ configured: true, remote: true }));
  assert.match(out, /ℹ Remote \(ssh\) bench/);
  assert.doesNotMatch(out, /Ready to run tests/);
});

test('frappePointer: present only when a Frappe stack is configured', () => {
  assert.equal(frappePointer({ stacks: {} }), null);
  assert.match(frappePointer({ stacks: { frappe: { site: 's' } } }), /testctl preflight/);
  assert.match(frappePointer({ stacks: { frappe: [{ site: 's' }] } }), /testctl preflight/);
});
