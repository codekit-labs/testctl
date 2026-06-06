import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCheck } from '../../lib/runners/nextjs.mjs';

test('evaluateCheck passes when status matches default 200', () => {
  const r = evaluateCheck({ path: '/' }, { status: 200, body: 'hello' });
  assert.equal(r.ok, true);
  assert.equal(r.path, '/');
});

test('evaluateCheck fails on status mismatch', () => {
  const r = evaluateCheck({ path: '/x', expectStatus: 200 }, { status: 404, body: '' });
  assert.equal(r.ok, false);
  assert.match(r.reason, /expected status 200, got 404/);
});

test('evaluateCheck honors a non-200 expectStatus', () => {
  const r = evaluateCheck({ path: '/missing', expectStatus: 404 }, { status: 404, body: '' });
  assert.equal(r.ok, true);
});

test('evaluateCheck passes when body contains expectText', () => {
  const r = evaluateCheck({ path: '/', expectText: 'Welcome' }, { status: 200, body: '<h1>Welcome</h1>' });
  assert.equal(r.ok, true);
});

test('evaluateCheck fails when body misses expectText', () => {
  const r = evaluateCheck({ path: '/', expectText: 'Welcome' }, { status: 200, body: 'nope' });
  assert.equal(r.ok, false);
  assert.match(r.reason, /missing expected text/);
});

test('evaluateCheck fails on a fetch error', () => {
  const r = evaluateCheck({ path: '/' }, { error: 'timeout after 15000ms' });
  assert.equal(r.ok, false);
  assert.match(r.reason, /timeout after 15000ms/);
});
