---
description: Drive a project to green — discover apps, generate missing tests, run, fix failures, and report readiness (changes left uncommitted)
argument-hint: "[path-or-stack]"
---

Drive the current project toward production-ready using the production-ready workflow.

1. Scope from `$ARGUMENTS` (a path or stack narrows it; empty = whole project).

2. Discover apps by running the bundled engine:
   `node "${CLAUDE_PLUGIN_ROOT}/dist/testctl.cjs" run` and reading the `TESTCTL_JSON` line.

3. Follow the `production-ready` skill: for each runnable app, loop up to 3 rounds — generate
   tests if missing (generate-tests skill), run them, fix failures (fix-failures skill), re-run.
   Stop a given app at green, at a stop-on-risk, or after 3 rounds.

4. Print a readiness report: per app ✅ green / ⚠️ partial / ⛔ blocked (needs config or
   unresolved), plus totals (tests generated, failures fixed, what needs a human).

5. Do NOT commit. Tell the user to review the `git diff` per app and commit.

Inherits all safety rails: never weaken tests, stop on risky fixes, Frappe only on an
`allow_tests` site, never auto-commit.
