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

import { buildSshArgs, buildRemoteBenchCommand, sshInvocation } from '../../lib/runners/frappe.mjs';

test('buildSshArgs: StrictHostKeyChecking + ConnectTimeout + key + port + host + command', () => {
  assert.deepEqual(
    buildSshArgs({ host: 'u@h', key: 'k', port: 2222 }, 'cmd'),
    ['-o', 'StrictHostKeyChecking=accept-new', '-o', 'ConnectTimeout=10', '-i', 'k', '-p', '2222', 'u@h', 'cmd'],
  );
});

test('buildSshArgs: minimal (host + command only)', () => {
  assert.deepEqual(
    buildSshArgs({ host: 'u@h' }, 'cmd'),
    ['-o', 'StrictHostKeyChecking=accept-new', '-o', 'ConnectTimeout=10', 'u@h', 'cmd'],
  );
});

test('buildRemoteBenchCommand builds the bench run-tests string', () => {
  assert.equal(
    buildRemoteBenchCommand('/home/frappe/erp-bench', 'demo.site', 'erptrue_app', '/tmp/x.xml'),
    'cd /home/frappe/erp-bench && bench --site demo.site run-tests --app erptrue_app --junit-xml-output /tmp/x.xml',
  );
});

test('sshInvocation key mode → ssh with BatchMode and empty childEnv', () => {
  const inv = sshInvocation({ host: 'u@h', key: 'k' }, 'cmd', {});
  assert.equal(inv.command, 'ssh');
  assert.equal(inv.args[0], '-o');
  assert.equal(inv.args[1], 'BatchMode=yes');
  assert.deepEqual(inv.childEnv, {});
});

test('sshInvocation passwordEnv mode → sshpass -e ssh, SSHPASS in childEnv, no BatchMode', () => {
  const inv = sshInvocation({ host: 'u@h', passwordEnv: 'PW' }, 'cmd', { PW: 'secret' });
  assert.equal(inv.command, 'sshpass');
  assert.deepEqual(inv.args.slice(0, 2), ['-e', 'ssh']);
  assert.ok(!inv.args.includes('BatchMode=yes'));
  assert.equal(inv.childEnv.SSHPASS, 'secret');
});

test('sshInvocation inline password mode', () => {
  const inv = sshInvocation({ host: 'u@h', password: 'pw' }, 'cmd', {});
  assert.equal(inv.command, 'sshpass');
  assert.equal(inv.childEnv.SSHPASS, 'pw');
});

test('sshInvocation errors when the passwordEnv var is unset', () => {
  const inv = sshInvocation({ host: 'u@h', passwordEnv: 'MISSING' }, 'cmd', {});
  assert.ok(inv.error);
});
