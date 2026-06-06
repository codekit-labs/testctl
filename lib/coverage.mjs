import { XMLParser } from 'fast-xml-parser';

export function parseLcov(text) {
  let lf = 0, lh = 0;
  for (const line of text.split('\n')) {
    if (line.startsWith('LF:')) lf += Number(line.slice(3)) || 0;
    else if (line.startsWith('LH:')) lh += Number(line.slice(3)) || 0;
  }
  if (lf <= 0) return null;
  return Math.round((lh / lf) * 100);
}

export function parseJestCoverageSummary(jsonText) {
  let data;
  try {
    data = JSON.parse(jsonText);
  } catch {
    return null;
  }
  const pct = data && data.total && data.total.lines ? data.total.lines.pct : undefined;
  return typeof pct === 'number' ? Math.round(pct) : null;
}

export function parseCoverageXml(xml) {
  try {
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
    const doc = parser.parse(xml);
    const rate = doc && doc.coverage ? doc.coverage['@_line-rate'] : undefined;
    if (rate === undefined || rate === null || rate === '') return null;
    const n = Number(rate);
    return Number.isNaN(n) ? null : Math.round(n * 100);
  } catch {
    return null;
  }
}

export function applyCoverageGate(results, min) {
  if (min == null) return results;
  for (const r of results) {
    if (r.present && !r.errored && r.coverage != null && r.coverage < min) {
      r.ok = false;
      r.note = `coverage ${r.coverage}% < min ${min}%`;
    }
  }
  return results;
}
