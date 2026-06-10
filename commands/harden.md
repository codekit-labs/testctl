---
description: Add adversarial edge-case tests (nulls, boundaries, error paths, unicode) to apps that already have happy-path tests
argument-hint: "[path-or-stack]"
---

Harden the current project's tests using the harden workflow.

1. Determine the target from `$ARGUMENTS`: a path → that app; a stack name → apps of that stack;
   empty → discover apps that already have tests and confirm the list with the user first.

2. Discover apps and which have tests: `node "${CLAUDE_PLUGIN_ROOT}/dist/testctl.cjs" run --quiet`
   and read the `TESTCTL_JSON` line (a harden target has passed + failed > 0; apps with no tests
   should go through `/testctl:generate-tests` first).

3. Follow the `harden` skill: read each app's source AND existing tests, find the happy-path-only
   gaps, and write NEW edge-case test files (empty/null, boundaries, large/unicode input, error
   paths, domain edges) — never overwriting existing tests. Run the stack's command and fix the
   GENERATED tests until green.

4. If an edge case reveals a real bug, do NOT fix app code — `skip` that one test with a clear
   reason and report the bug for `/testctl:fix-failures`.

5. Frappe: only run against an `allow_tests` site; otherwise generate and leave a note.

6. Do NOT commit. Print per app: files added, edge cases covered, any real bug surfaced. Tell the
   user to review the `git diff` and commit.
