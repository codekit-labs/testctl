---
description: Generate runnable smoke + unit-logic tests for untested apps (Flutter/Electron/Next.js/Frappe/Supabase) and run them to green
argument-hint: "[path-or-stack]"
---

Generate tests for the current project using the generate-tests workflow.

1. Determine the target from `$ARGUMENTS`: a path → that app; a stack name
   (`flutter`/`electron`/`nextjs`/`frappe`/`supabase`) → apps of that stack; empty → discover
   apps that need tests and confirm the list with the user first.

2. To discover apps and see which lack tests, run the bundled engine:
   `node "${CLAUDE_PLUGIN_ROOT}/dist/testctl.cjs" run` and read the `TESTCTL_JSON` line (an
   app needs tests if it has no/empty test dir or reports 0 passed + 0 failed).

3. Follow the `generate-tests` skill: read each target app's source, write NEW smoke +
   unit-logic test files in the stack's conventional location (never overwriting existing
   tests), then run the stack's test command and fix the generated tests until they pass.

4. Frappe: only run generated tests against a site with `allow_tests` enabled — otherwise
   generate and leave a note, never touch production.

5. Do NOT commit. Print a per-app summary (files added, test count, green result) and tell the
   user to review the `git diff` and commit.
