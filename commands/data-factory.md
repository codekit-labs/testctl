---
description: Generate reusable test-data builders/factories (Frappe factories reuse existing masters, never create heavy ones)
argument-hint: "[path-or-stack]"
---

Build test-data factories using the data-factory workflow.

1. Determine scope from `$ARGUMENTS`: a path/stack narrows it; empty → discover apps and confirm
   which to build factories for.

2. Discover apps: `node "${CLAUDE_PLUGIN_ROOT}/dist/testctl.cjs" run --quiet` and read
   `TESTCTL_JSON`. Read each target app's models/DocTypes/schema and existing tests to find the
   entities tests keep hand-building.

3. Follow the `data-factory` skill: write reusable factory helpers in the stack's test-support
   location (NEW file) — valid defaults, every field overridable, composable. For Frappe/Supabase,
   factories must DISCOVER and reuse existing masters (Company/Customer/Item/Account) and only
   create the light target docs; skip cleanly if a master is missing — never create heavyweight
   records that trigger framework setup cascades.

4. Add a smoke test that calls each factory, and refactor one existing test to use a factory to
   prove the win. Run to green.

5. Frappe: only run against a site with `allow_tests` enabled.

6. Do NOT commit. Report the factories added, the masters they reuse, and any test simplified. Tell
   the user to review the `git diff` and commit.
