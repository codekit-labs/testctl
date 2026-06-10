---
description: Find flaky tests by running a suite several times, diagnose the cause, and stabilize them (never hide flakiness behind retries)
argument-hint: "[path-or-stack] [runs]"
---

Hunt flaky tests using the flaky-hunter workflow.

1. Parse `$ARGUMENTS`: an optional path/stack narrows scope; an optional run count (default 5).
   `testctl report` history also hints which apps flip pass↔fail.

2. Follow the `flaky-hunter` skill: run the engine that many times —
   `node "${CLAUDE_PLUGIN_ROOT}/dist/testctl.cjs" run --quiet [stack]` — and read the
   `TESTCTL_JSON` line each time, collecting the `failures[]` digest.

3. Isolate the tests that appear in failures on SOME runs but not all (intermittent = flaky;
   always-failing = a real failure for `/testctl:fix-failures`). Note each flip rate.

4. Diagnose the cause (timing/sleep, order-dependence/shared state, non-determinism like
   now()/random/locale, leaked resources) and STABILIZE the test — await the real condition, seed
   the clock/RNG, add setup/teardown, sort before asserting, mock external calls. Never weaken,
   skip, or wrap in `--retry` to mask it. Re-run several times to confirm stability.

5. Frappe: only run against a site with `allow_tests` enabled.

6. Do NOT commit. Report each flaky test, its cause, the fix, and post-fix stability. Tell the user
   to review the `git diff` and commit.
