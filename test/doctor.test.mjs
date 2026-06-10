import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMajor, formatDoctor } from '../lib/doctor.mjs';

test('parseMajor extracts the leading integer from version strings', () => {
  assert.equal(parseMajor('v26.0.0'), 26);
  assert.equal(parseMajor('Flutter 3.44.0 • channel stable'), 3);
  assert.equal(parseMajor('1.25.0'), 1);
  assert.equal(parseMajor('garbage'), null);
  assert.equal(parseMajor(''), null);
});

test('formatDoctor renders node ok, present + missing tools, and ready stacks', () => {
  const report = {
    node: { version: 'v26.0.0', major: 26, ok: true },
    tools: [
      { name: 'flutter', stack: 'Flutter', present: true, version: '3.44.0' },
      { name: 'bench', stack: 'Frappe', present: false, version: null },
    ],
    readyStacks: ['Flutter', 'Electron', 'Next.js'],
  };
  const out = formatDoctor(report);
  assert.match(out, /✓ node/);
  assert.match(out, /flutter/);
  assert.match(out, /⊘ bench/);
  assert.match(out, /Ready stacks: Flutter, Electron, Next\.js/);
});

test('formatDoctor flags Node below 20', () => {
  const out = formatDoctor({
    node: { version: 'v18.0.0', major: 18, ok: false },
    tools: [],
    readyStacks: ['Electron', 'Next.js'],
  });
  assert.match(out, /✗ node/);
});

test('formatDoctor shows the testctl version when present', () => {
  const report = { version: '9.9.9', node: { version: 'v20.0.0', major: 20, ok: true }, tools: [], readyStacks: ['Electron'] };
  const out = formatDoctor(report);
  assert.match(out, /testctl v9\.9\.9/);
});
test('formatDoctor omits the version line when version is null', () => {
  const report = { version: null, node: { version: 'v20.0.0', major: 20, ok: true }, tools: [], readyStacks: [] };
  assert.equal(/testctl v/.test(formatDoctor(report)), false);
});
