---
description: Diagnose and fix failing tests (app code or a genuinely-wrong test), re-run to green, leave uncommitted for review
argument-hint: "[path-or-stack]"
---

Fix the failing tests in the current project using the fix-failures workflow.

1. Scope from `$ARGUMENTS` (a path or stack narrows it; empty = whole project).

2. Find real failures by running the bundled engine:
   `node "${CLAUDE_PLUGIN_ROOT}/dist/testctl.cjs" run` and reading the `TESTCTL_JSON` line.
   Use only `failedLogs` entries — ignore "needs config" notices and not-present stacks.

3. Follow the `fix-failures` skill: for each failure, one at a time, root-cause it (use the
   systematic-debugging skill), then fix the app code (or correct a genuinely-wrong test —
   never weaken a test to pass). Re-run that test until green (test-driven-development). Stop
   and report any fix that is ambiguous, architectural, or behavior-changing.

4. Re-run the full suite to confirm no regressions.

5. Do NOT commit. Print, per failure: root cause → file changed → ✅ green or ⏸ stopped-on-risk.
   Tell the user to review the `git diff` and commit.

Frappe: only run tests against a site with `allow_tests` enabled — never production data.
