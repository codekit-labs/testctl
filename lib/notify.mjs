function appName(r) { return r.label && r.label !== r.stack ? `${r.stack} (${r.label})` : r.stack; }

export function notifyText(results) {
  const present = (results || []).filter((r) => r.present);
  const bad = present.filter((r) => !r.ok);
  const totals = present.reduce((a, r) => ({ p: a.p + (r.passed || 0), f: a.f + (r.failed || 0) }), { p: 0, f: 0 });
  return `testctl: ${bad.length} app(s) red · ${totals.f} failed / ${totals.p} passed${bad.length ? ' — ' + bad.map(appName).join(', ') : ''}`;
}

export function buildNotifyPayload(results, opts = {}) {
  const present = (results || []).filter((r) => r.present);
  const failed = present.filter((r) => !r.ok).map((r) => ({
    app: appName(r), failed: r.failed || 0, errored: !!r.errored, error: r.errored ? (r.error || null) : null,
  }));
  const totals = present.reduce((a, r) => ({
    passed: a.passed + (r.passed || 0), failed: a.failed + (r.failed || 0), skipped: a.skipped + (r.skipped || 0),
  }), { passed: 0, failed: 0, skipped: 0 });
  return { text: notifyText(results), project: opts.project || null, totals, failed };
}

// Impure: POST JSON; resolves { ok, status } or { ok:false, error }. Never throws.
export async function postWebhook(url, payload) {
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
    return { ok: res.ok, status: res.status };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
