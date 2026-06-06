import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLcov, parseJestCoverageSummary, parseCoverageXml } from '../lib/coverage.mjs';

test('parseLcov computes line coverage % across records', () => {
  const lcov = 'SF:a.dart\nLF:10\nLH:8\nend_of_record\nSF:b.dart\nLF:10\nLH:2\nend_of_record\n';
  assert.equal(parseLcov(lcov), 50);
});
test('parseLcov returns null when no lines found', () => {
  assert.equal(parseLcov('SF:a\nLF:0\nLH:0\nend_of_record\n'), null);
  assert.equal(parseLcov(''), null);
});
test('parseJestCoverageSummary reads total.lines.pct (rounded)', () => {
  assert.equal(parseJestCoverageSummary(JSON.stringify({ total: { lines: { pct: 63.7 } } })), 64);
});
test('parseJestCoverageSummary returns null on bad json or missing field', () => {
  assert.equal(parseJestCoverageSummary('not json'), null);
  assert.equal(parseJestCoverageSummary(JSON.stringify({ total: {} })), null);
});
test('parseCoverageXml reads Cobertura line-rate as a percent', () => {
  assert.equal(parseCoverageXml('<?xml version="1.0"?><coverage line-rate="0.83" version="1"></coverage>'), 83);
});
test('parseCoverageXml returns null when absent or unparseable', () => {
  assert.equal(parseCoverageXml('<coverage></coverage>'), null);
  assert.equal(parseCoverageXml('garbage'), null);
});
