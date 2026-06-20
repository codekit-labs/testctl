import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRunResponse, buildDigestResponse, buildContextResponse } from '../lib/mcp.mjs';

// ─── helpers ───────────────────────────────────────────────────────────────
const makeR = (over) => ({
  stack: 'web', label: 'react', passed: 5, failed: 0, skipped: 1,
  ok: true, coverage: 80, failures: [], ...over,
});

const makeRecord = (results, timestamp = '2026-01-01T00:00:00.000Z') => ({ results, timestamp });

// ─── buildRunResponse ───────────────────────────────────────────────────────

test('buildRunResponse: empty results → ok shape', () => {
  const out = buildRunResponse({ results: [], exitCode: 0, patchCoverage: null });
  assert.deepEqual(out.results, []);
  assert.deepEqual(out.failures, []);
  assert.equal(out.exitCode, 0);
  assert.equal(out.patchCoverage, null);
});

test('buildRunResponse: projects result fields correctly', () => {
  const out = buildRunResponse({
    results: [makeR({ passed: 3, failed: 1, skipped: 0, ok: false, coverage: 72 })],
    exitCode: 1,
    patchCoverage: null,
  });
  assert.equal(out.results.length, 1);
  const r = out.results[0];
  assert.equal(r.stack, 'web');
  assert.equal(r.label, 'react');
  assert.equal(r.passed, 3);
  assert.equal(r.failed, 1);
  assert.equal(r.skipped, 0);
  assert.equal(r.ok, false);
  assert.equal(r.coverage, 72);
  assert.equal(out.exitCode, 1);
});

test('buildRunResponse: flattens failures with stack stamp', () => {
  const out = buildRunResponse({
    results: [
      makeR({
        stack: 'frappe', label: 'myapp',
        failures: [
          { test: 'TestOrder.test_totals', file: 'test_order.py', line: 42, message: 'AssertionError' },
          { test: 'TestOrder.test_vat', file: 'test_order.py', line: 80, message: 'VAT mismatch' },
        ],
        failed: 2, ok: false,
      }),
    ],
    exitCode: 1,
    patchCoverage: null,
  });
  assert.equal(out.failures.length, 2);
  assert.equal(out.failures[0].stack, 'frappe');
  assert.equal(out.failures[0].test, 'TestOrder.test_totals');
  assert.equal(out.failures[0].file, 'test_order.py');
  assert.equal(out.failures[0].message, 'AssertionError');
  assert.equal(out.failures[1].test, 'TestOrder.test_vat');
});

test('buildRunResponse: patchCoverage passed through when present', () => {
  const pc = { overall: { pct: 75, covered: 15, changed: 20 }, files: [] };
  const out = buildRunResponse({ results: [], exitCode: 0, patchCoverage: pc });
  assert.deepEqual(out.patchCoverage, pc);
});

test('buildRunResponse: null core → safe defaults', () => {
  const out = buildRunResponse(null);
  assert.deepEqual(out.results, []);
  assert.deepEqual(out.failures, []);
  assert.equal(out.exitCode, 0);
  assert.equal(out.patchCoverage, null);
});

test('buildRunResponse: result with no label falls back to stack', () => {
  const out = buildRunResponse({
    results: [{ stack: 'flutter', passed: 2, failed: 0, skipped: 0, ok: true, failures: [] }],
    exitCode: 0,
    patchCoverage: null,
  });
  assert.equal(out.results[0].label, 'flutter');
});

// ─── buildDigestResponse ────────────────────────────────────────────────────

test('buildDigestResponse: null record → hasRun false + sentinel text', () => {
  const out = buildDigestResponse(null);
  assert.equal(out.hasRun, false);
  assert.equal(out.timestamp, null);
  assert.deepEqual(out.results, []);
  assert.deepEqual(out.failures, []);
  assert.match(out.text, /No run recorded/);
});

test('buildDigestResponse: empty results → hasRun false', () => {
  const out = buildDigestResponse(makeRecord([]));
  assert.equal(out.hasRun, false);
  assert.match(out.text, /No run recorded/);
});

test('buildDigestResponse: green run → hasRun true, no failures', () => {
  const out = buildDigestResponse(makeRecord([makeR()]));
  assert.equal(out.hasRun, true);
  assert.equal(out.timestamp, '2026-01-01T00:00:00.000Z');
  assert.equal(out.results.length, 1);
  assert.deepEqual(out.failures, []);
  assert.match(out.text, /green/i);
});

test('buildDigestResponse: failing run → failures flattened with stack', () => {
  const out = buildDigestResponse(makeRecord([
    makeR({
      stack: 'frappe', label: 'orders', failed: 1, ok: false,
      failures: [{ test: 'TestOrder.test_bad', file: 'f.py', line: null, message: 'boom' }],
    }),
  ]));
  assert.equal(out.hasRun, true);
  assert.equal(out.failures.length, 1);
  assert.equal(out.failures[0].stack, 'frappe');
  assert.equal(out.failures[0].test, 'TestOrder.test_bad');
  assert.equal(out.failures[0].message, 'boom');
});

test('buildDigestResponse: text is a non-empty human string', () => {
  const out = buildDigestResponse(makeRecord([makeR()]));
  assert.ok(typeof out.text === 'string' && out.text.length > 0);
});

// ─── buildContextResponse ───────────────────────────────────────────────────

test('buildContextResponse: empty apps', () => {
  const out = buildContextResponse([]);
  assert.deepEqual(out.apps, []);
  assert.match(out.text, /No testable apps found/);
});

test('buildContextResponse: stamps action on each app', () => {
  const apps = [
    { stack: 'web', label: 'react', hasTests: false, status: 'unknown', belowGate: false, untestedCount: 0, tests: 0, coverage: null, failures: [] },
    { stack: 'flutter', label: 'flutter', hasTests: true, status: 'green', belowGate: false, untestedCount: 5, tests: 10, coverage: 85, failures: [] },
  ];
  const out = buildContextResponse(apps);
  assert.equal(out.apps.length, 2);
  assert.equal(out.apps[0].action, 'generate');   // no tests
  assert.equal(out.apps[1].action, 'harden');      // green but untested symbols
});

test('buildContextResponse: text contains app info', () => {
  const apps = [
    { stack: 'web', label: 'react', hasTests: true, status: 'red', belowGate: false, untestedCount: 0, tests: 3, coverage: null, failures: [] },
  ];
  const out = buildContextResponse(apps);
  assert.match(out.text, /web/);
  assert.ok(typeof out.text === 'string');
});

test('buildContextResponse: null apps → safe empty', () => {
  const out = buildContextResponse(null);
  assert.deepEqual(out.apps, []);
  assert.match(out.text, /No testable apps found/);
});

// ─── MCP server smoke test (requires dist/testctl-mcp.cjs to be built) ──────

import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const _here = dirname(fileURLToPath(import.meta.url));
const _bundle = join(_here, '..', 'dist', 'testctl-mcp.cjs');

test('mcp server: tools/list returns the 3 tools and testctl_digest returns the no-run sentinel',
  { skip: existsSync(_bundle) ? false : 'dist/testctl-mcp.cjs not built' },
  async () => {
    const proj = mkdtempSync(join(tmpdir(), 'testctl-mcp-'));
    const child = spawn(process.execPath, [_bundle], {
      cwd: proj, env: { ...process.env, TESTCTL_PROJECT_DIR: proj },
      stdio: ['pipe', 'pipe', 'inherit'],
    });
    const killTimer = setTimeout(() => child.kill('SIGKILL'), 8000);
    try {
      const send = (msg) => child.stdin.write(JSON.stringify(msg) + '\n');
      const responses = new Map();
      let buf = '';
      const waitFor = (id) => new Promise((resolve, reject) => {
        const to = setTimeout(() => reject(new Error('timeout waiting for id ' + id)), 6000);
        const onData = (d) => {
          buf += d.toString();
          let nl;
          while ((nl = buf.indexOf('\n')) >= 0) {
            const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
            if (!line) continue;
            let m; try { m = JSON.parse(line); } catch { continue; }
            if (m.id != null) responses.set(m.id, m);
          }
          if (responses.has(id)) { clearTimeout(to); child.stdout.off('data', onData); resolve(responses.get(id)); }
        };
        child.stdout.on('data', onData);
      });

      send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {
        protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'smoke', version: '0' } } });
      await waitFor(1);
      send({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} });

      send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
      const list = await waitFor(2);
      const names = (list.result.tools || []).map((t) => t.name).sort();
      assert.deepEqual(names, ['testctl_context', 'testctl_digest', 'testctl_run']);

      send({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'testctl_digest', arguments: {} } });
      const call = await waitFor(3);
      const payload = JSON.parse(call.result.content[0].text);
      assert.equal(payload.hasRun, false);
      assert.match(payload.text, /No run recorded yet/);
    } finally {
      clearTimeout(killTimer);
      child.kill('SIGKILL');
    }
  });
