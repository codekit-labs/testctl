// Uniform result shape returned by every runner. The single seam that keeps
// report.mjs and the skill stack-agnostic.
export function makeResult({
  stack,
  present = true,
  passed = 0,
  failed = 0,
  skipped = 0,
  durationMs = 0,
  rawLogPath = null,
  errored = false,
  error = null,
}) {
  const ok = !errored && failed === 0;
  return { stack, present, passed, failed, skipped, durationMs, rawLogPath, errored, error, ok };
}
