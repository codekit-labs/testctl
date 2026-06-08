// Shared helpers for runner wrappers.

// A run that exited non-zero but produced no test results at all (compile error,
// crashed runner, empty suite) must NOT be reported as a green 0/0/0 — that would
// defeat the CI exit code. Returns true when a run should be flagged as errored.
// A null/undefined status (e.g. killed by signal) with no tests also counts.
export function ranButProducedNothing(status, counts) {
  const total = counts.passed + counts.failed + counts.skipped;
  return status !== 0 && total === 0;
}

export function capFailures(failures, { maxItems = 20, maxLen = 800 } = {}) {
  const trimmed = failures.slice(0, maxItems).map((f) => ({
    ...f,
    message: typeof f.message === 'string' && f.message.length > maxLen
      ? f.message.slice(0, maxLen) + ' …[truncated]'
      : f.message,
  }));
  if (failures.length > maxItems) {
    trimmed.push({ test: `(+${failures.length - maxItems} more failures)`, file: null, line: null, message: '' });
  }
  return trimmed;
}
