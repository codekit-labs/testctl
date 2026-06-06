import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeResult } from '../result.mjs';

// Pure: decide whether a single smoke check passed, given its config and the response.
export function evaluateCheck(check, response) {
  const path = check.path;
  const expectStatus = check.expectStatus ?? 200;
  if (response.error) {
    return { path, ok: false, reason: `fetch failed: ${response.error}` };
  }
  if (response.status !== expectStatus) {
    return { path, ok: false, reason: `expected status ${expectStatus}, got ${response.status}` };
  }
  if (check.expectText && !(response.body || '').includes(check.expectText)) {
    return { path, ok: false, reason: `body missing expected text "${check.expectText}"` };
  }
  return { path, ok: true, reason: 'ok' };
}

// Async: smoke-test the live Vercel deployment by fetching each configured path.
export async function runNextjs(cfg) {
  const start = Date.now();
  const logDir = mkdtempSync(join(tmpdir(), 'testctl-nextjs-'));
  const logPath = join(logDir, 'nextjs.log');

  if (!cfg.vercelUrl) {
    writeFileSync(logPath, 'No vercelUrl configured.\n');
    return makeResult({ stack: 'nextjs', errored: true, error: 'set nextjs.vercelUrl in testctl.yaml', rawLogPath: logPath });
  }

  const checks = Array.isArray(cfg.checks) && cfg.checks.length ? cfg.checks : [{ path: '/', expectStatus: 200 }];
  const timeoutMs = cfg.timeoutMs ?? 15000;
  const base = cfg.vercelUrl.replace(/\/$/, '');
  let passed = 0, failed = 0;
  let logBuf = `Vercel smoke test: ${base}\n`;

  for (const check of checks) {
    const url = base + check.path;
    let response;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: controller.signal, redirect: 'manual' });
      const body = await res.text();
      response = { status: res.status, body };
    } catch (e) {
      response = { error: e.name === 'AbortError' ? `timeout after ${timeoutMs}ms` : e.message };
    } finally {
      clearTimeout(timer);
    }
    const result = evaluateCheck(check, response);
    if (result.ok) passed += 1; else failed += 1;
    logBuf += `${result.ok ? 'PASS' : 'FAIL'} ${url} — ${result.reason}\n`;
  }

  writeFileSync(logPath, logBuf);
  return makeResult({
    stack: 'nextjs',
    passed,
    failed,
    skipped: 0,
    durationMs: Date.now() - start,
    rawLogPath: logPath,
  });
}
