---
description: Review existing tests for quality — assertions that don't assert, can't-fail tests, over-mocking, brittleness, missing teardown — report and safely fix
argument-hint: "[path-or-stack]"
---

Audit the current project's existing tests using the test-audit workflow.

1. Determine scope from `$ARGUMENTS`: a path/stack narrows it; empty → every app that has tests
   (confirm the list first).

2. Discover apps with tests: `node "${CLAUDE_PLUGIN_ROOT}/dist/testctl.cjs" run --quiet` and read
   `TESTCTL_JSON` (audit apps with passed + failed > 0). Read each app's test files.

3. Follow the `test-audit` skill: flag the smells with file:line — no real assertion / empty stub,
   can't-fail tautologies, mocking the unit under test, brittle sleeps/selectors/order-dependence,
   silently-skipped tests, missing teardown. Produce a ranked report by severity.

4. Optionally fix the UNAMBIGUOUS cases (add the missing assertion, replace a tautology, drop a
   self-mock, add teardown) — never weakening a test, never editing one whose intent is unclear
   (report those). Re-run to confirm still green.

5. Frappe: only run against an `allow_tests` site.

6. Do NOT commit. Print the audit report + what was fixed vs left for the user. Tell them to review
   the `git diff` and commit.
