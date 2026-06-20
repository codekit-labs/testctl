// Pure response builders for the testctl MCP server. NO SDK import, NO transport, NO fs/network here —
// these turn engine data (a runProject result, a stored last-run record, a context apps[] array) into
// the structured objects the three MCP tools return. Unit-tested in test/mcp.test.mjs.
import { formatDigest } from './lastrun.mjs';
import { actionFor, formatContext } from './context.mjs';

// Project a makeResult-shaped result to the documented run fields.
function pickResult(r) {
  return {
    stack: r.stack,
    label: r.label || r.stack,
    passed: r.passed || 0,
    failed: r.failed || 0,
    skipped: r.skipped || 0,
    ok: !!r.ok,
    coverage: r.coverage ?? null,
  };
}

// Flatten every result's failures[] into a flat list, stamping the owning stack.
function flattenFailures(results) {
  const out = [];
  for (const r of results || []) {
    for (const f of r.failures || []) {
      out.push({
        stack: r.stack,
        test: f.test || 'unknown',
        file: f.file || null,
        message: f.message || '',
      });
    }
  }
  return out;
}

// testctl_run — from a runProject() result.
export function buildRunResponse(core) {
  const results = (core && core.results) || [];
  return {
    results: results.map(pickResult),
    failures: flattenFailures(results),
    exitCode: core && typeof core.exitCode === 'number' ? core.exitCode : 0,
    patchCoverage: core && core.patchCoverage != null ? core.patchCoverage : null,
  };
}

// testctl_digest — from a stored lastRunRecord (or null).
export function buildDigestResponse(record) {
  const has = !!(record && Array.isArray(record.results) && record.results.length > 0);
  return {
    hasRun: has,
    timestamp: has ? (record.timestamp || null) : null,
    results: has ? record.results.map(pickResult) : [],
    failures: has ? flattenFailures(record.results) : [],
    text: formatDigest(record),
  };
}

// testctl_context — from a buildContextApps() apps[] array.
export function buildContextResponse(apps) {
  const list = apps || [];
  return {
    apps: list.map((a) => ({ ...a, action: actionFor(a) })),
    text: formatContext(list),
  };
}
