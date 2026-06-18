// Pure helpers for `testctl bisect`. No git, no I/O here — the orchestration that shells
// real git lives in bin/cli.mjs (cmdBisect) and is proven by a guarded /tmp smoke, not a unit test.

// Parse `git bisect run` stdout for the canonical verdict line and return the sha, or null.
// git prints `<sha> is the first bad commit`; the sha is normally the full 40 hex chars,
// but we accept 7-40 to stay tolerant.
export function parseFirstBadCommit(gitBisectOutput) {
  if (typeof gitBisectOutput !== 'string' || gitBisectOutput.length === 0) return null;
  const m = gitBisectOutput.match(/\b([0-9a-f]{7,40}) is the first bad commit\b/);
  return m ? m[1] : null;
}

// Build the shell command `git bisect run` executes at each checked-out commit.
// cliPath = this engine's own script path (process.argv[1]); target = optional stack-or-path
// positional passed through to `testctl run`; test = optional failure-name substring criterion.
export function buildBisectCriterion({ cliPath, target, test }) {
  const tgt = target ? ` ${target}` : '';
  const runArgs = `run${tgt} --quiet`;
  if (!test) {
    // plain criterion: git reads the engine's own exit code (non-zero = bad)
    return `node "${cliPath}"${' ' + runArgs}`.replace('  ', ' ');
  }
  // --test criterion: run the engine, parse its TESTCTL_JSON line, exit bad iff a failing
  // test name contains the substring. Build the inline program by JSON-escaping every literal
  // so quoting/edge chars are safe inside the single-quoted `node -e '...'` shell argument.
  const targetArg = target ? `,${JSON.stringify(target)}` : '';
  const program =
    'const{spawnSync}=require("node:child_process");' +
    `const r=spawnSync("node",[${JSON.stringify(cliPath)},"run"${targetArg},"--quiet"],{encoding:"utf8"});` +
    'const out=(r.stdout||"")+(r.stderr||"");' +
    'const line=out.split("\\n").find(l=>l.startsWith("TESTCTL_JSON "));' +
    'let hit=false;' +
    'if(line){try{' +
    'const data=JSON.parse(line.slice("TESTCTL_JSON ".length));' +
    `const needle=${JSON.stringify(test)};` +
    'for(const res of (data.results||[])){for(const f of (res.failures||[])){' +
    'if(typeof f.test==="string"&&f.test.indexOf(needle)!==-1){hit=true;}}}' +
    '}catch(e){}}' +
    'process.exit(hit?1:0);';
  return `node -e ${JSON.stringify(program)}`;
}

// Human success block for a found first-bad commit.
export function formatBisectResult({ firstBad, subject, criterionLabel }) {
  return [
    'testctl bisect — first bad commit',
    '─────────────────────────────────',
    `${firstBad}  ${subject || '(no subject)'}`,
    `criterion: ${criterionLabel}`,
    '',
    'Next:',
    '  • /testctl:regression-from-bug — capture this regression as a permanent failing test',
    '  • /testctl:fix-failures        — drive it back to green',
  ].join('\n');
}
