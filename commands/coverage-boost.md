---
description: Raise line coverage by writing tests for the SPECIFIC uncovered functions/branches from the coverage report (Flutter/Electron/Frappe)
argument-hint: "[path-or-stack] [target%]"
---

Boost the current project's coverage using the coverage-boost workflow.

1. Parse `$ARGUMENTS`: an optional path/stack narrows scope; an optional target percent (default:
   the project's `coverageMin`, else 80).

2. Measure: `node "${CLAUDE_PLUGIN_ROOT}/dist/testctl.cjs" run --coverage --quiet` and read
   `TESTCTL_JSON` — each app's `coverage` is its current %. Pick apps below the target. (Next.js /
   Supabase report no line coverage — skip with a note.)

3. Follow the `coverage-boost` skill: for each below-target app, open the coverage artifact
   (`coverage/lcov.info` for Flutter, `coverage/coverage-*.json` for jest, cobertura xml for
   Frappe), find the exact uncovered functions/branches, and write NEW tests aimed at those — never
   overwriting existing tests.

4. Re-run with `--coverage` and iterate, bounded to 3 rounds per app, until the target is met or a
   round adds nothing.

5. Frappe: only run against an `allow_tests` site.

6. Do NOT commit. Report per app `coverage X% → Y%`, files added, and any gap left (with the
   reason). Tell the user to review the `git diff` and commit.
