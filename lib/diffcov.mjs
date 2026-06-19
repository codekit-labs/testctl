// Pure patch-coverage core. No git, no fs — fully unit-testable.
// parseLcovLines: lcov text -> Map<file, Map<lineNo, hits>>
// parseDiffRanges: unified-diff text -> Map<file, Set<newLineNo>>  (added/modified NEW-file lines)
// patchCoverage: (lcovLines, diffRanges) -> { overall, files[] }
// formatPatchCoverage: (report, gateMin) -> human block string

// Build per-line hit data grouped by the preceding SF: record.
export function parseLcovLines(text) {
  const out = new Map();
  if (!text || typeof text !== 'string') return out;
  let cur = null;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (line.startsWith('SF:')) {
      const file = line.slice(3).trim();
      if (!file) { cur = null; continue; }
      cur = out.get(file);
      if (!cur) { cur = new Map(); out.set(file, cur); }
    } else if (line.startsWith('DA:') && cur) {
      const body = line.slice(3);
      const comma = body.indexOf(',');
      if (comma < 0) continue;
      const ln = Number(body.slice(0, comma));
      const hits = Number(body.slice(comma + 1));
      if (Number.isFinite(ln) && Number.isFinite(hits)) cur.set(ln, hits);
    } else if (line === 'end_of_record') {
      cur = null;
    }
  }
  // Drop any SF: that produced zero DA records (keeps the map clean for empty/malformed input).
  for (const [f, m] of out) if (m.size === 0) out.delete(f);
  return out;
}

// Parse a unified git diff into the set of NEW-file line numbers that were added/modified per file.
export function parseDiffRanges(text) {
  const out = new Map();
  if (!text || typeof text !== 'string') return out;
  let file = null;
  let newLine = 0; // current line number in the NEW file as we walk a hunk
  for (const raw of text.split('\n')) {
    if (raw.startsWith('+++ ')) {
      // +++ b/path  OR  +++ /dev/null  (a deletion target)
      const p = raw.slice(4).trim();
      if (p === '/dev/null') { file = null; continue; }
      file = p.replace(/^b\//, '');
      if (!out.has(file)) out.set(file, new Set());
      continue;
    }
    if (raw.startsWith('@@')) {
      // @@ -a,b +c,d @@  — c is the start line in the NEW file
      const m = raw.match(/@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      newLine = m ? Number(m[1]) : 0;
      continue;
    }
    if (file == null || newLine === 0) continue;
    if (raw.startsWith('+++') || raw.startsWith('---')) continue; // header lines inside hunk region
    if (raw.startsWith('+')) {
      out.get(file).add(newLine);
      newLine += 1;
    } else if (raw.startsWith('-')) {
      // deleted line — does not advance the NEW-file counter, contributes nothing
    } else if (raw.startsWith(' ') || raw === '') {
      newLine += 1; // context line advances the new-file counter
    }
    // 'diff --git', 'index', 'new file', 'deleted file' lines fall through harmlessly
  }
  // Drop files that ended up with no added lines (pure deletions).
  for (const [f, s] of out) if (s.size === 0) out.delete(f);
  return out;
}

// Intersect changed lines with executable (DA) lines; only count lines present in lcov.
export function patchCoverage(lcovLines, diffRanges) {
  const files = [];
  let oc = 0, ot = 0;
  for (const [file, lines] of diffRanges) {
    const da = lcovLines.get(file);
    if (!da) continue; // file not instrumented at all
    let covered = 0, total = 0;
    const uncovered = [];
    for (const ln of [...lines].sort((a, b) => a - b)) {
      if (!da.has(ln)) continue; // changed line is not executable (comment/blank/import) — skip
      total += 1;
      if (da.get(ln) > 0) covered += 1;
      else uncovered.push(ln);
    }
    if (total === 0) continue; // no executable changed lines — omit so it doesn't dilute the metric
    files.push({ file, covered, total, pct: Math.round((100 * covered) / total), uncovered });
    oc += covered;
    ot += total;
  }
  return {
    overall: { covered: oc, total: ot, pct: ot === 0 ? null : Math.round((100 * oc) / ot) },
    files,
  };
}

// Human-readable block. gateMin != null adds a verdict footer.
export function formatPatchCoverage(report, gateMin = null) {
  const { overall, files } = report;
  if (overall.pct == null) {
    return 'Patch coverage: no measurable patch coverage (no executable changed lines or no line coverage).';
  }
  const lines = [];
  lines.push('Patch coverage (changed lines)');
  lines.push('──────────────────────────────');
  lines.push(`overall: ${overall.covered}/${overall.total} (${overall.pct}%)`);
  for (const f of files) {
    let l = `  ${f.file}: ${f.covered}/${f.total} (${f.pct}%)`;
    if (f.uncovered.length) l += ` — uncovered: ${f.uncovered.join(', ')}`;
    lines.push(l);
  }
  if (gateMin != null) {
    if (overall.pct < gateMin) lines.push(`gate: FAIL — patch coverage ${overall.pct}% is below min ${gateMin}%`);
    else lines.push(`gate: PASS — patch coverage ${overall.pct}% meets min ${gateMin}%`);
  }
  return lines.join('\n');
}
