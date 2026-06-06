---
name: production-ready
description: Drive a whole project to a tested, green, production-ready state with no manual testing — discover apps, generate missing tests, run them, fix failures, and report readiness. Use when the user runs /testctl:production-ready, asks "make this production-ready", "get this tested", "is this ready to ship", or wants the full test-and-fix loop run for them.
---

# production-ready

Orchestrate the full loop toward a green, tested project. This skill does NOT re-derive
generation or fixing — it hands off to the `generate-tests` and `fix-failures` skills (which in
turn use `systematic-debugging` and `test-driven-development`). All changes are left uncommitted
for review.

## Inputs

`/testctl:production-ready [path-or-stack]`: a path/stack narrows the scope; empty = whole project.

## Steps

1. **Discover apps.** Run the engine: `node "<skill-base>/../../dist/testctl.cjs" run` (scoped
   to the arg if given); read `TESTCTL_JSON`. Note each app and whether it has tests / is green.
   Keep any "needs config" notices (Next.js without vercelUrl, Frappe without bench/site/apps)
   aside for the final report — they need the user, not generation.

2. **For each runnable app, loop up to 3 rounds:**
   a. If the app has no tests (no/empty test dir, or 0 passed + 0 failed) → invoke the
      `generate-tests` skill to add smoke + unit-logic tests for it.
   b. **Run** the app's tests.
   c. If there are failures → invoke the `fix-failures` skill (root-cause + minimal fix; it
      stops on risky fixes and never weakens tests).
   d. **Re-run.** If green → this app is done; break the loop. If `fix-failures` stopped on a
      risky fix, or it is still red after round 3 → record what remains and move on. Never loop
      past 3 rounds for one app.

3. **Readiness report.** For every app print one of:
   - ✅ **green** — tests present and passing (note if tests were generated this run)
   - ⚠️ **partial** — some green, some stopped-on-risk (list what needs a human + the proposed fix)
   - ⛔ **blocked** — needs config (Next.js vercelUrl / Frappe bench+site+apps) or an unresolved failure
   Summarize totals (apps green / partial / blocked, tests generated, failures fixed).

4. **Leave everything uncommitted.** Tell the user to review the `git diff` per app and commit.
   Do NOT commit anything.

## Rules

- Bounded: at most 3 rounds per app — never loop indefinitely.
- Inherit all sub-skill rails: never weaken/skip/delete tests, stop on risky fixes, Frappe only
  on an `allow_tests` site, never auto-commit.
- An app is "ready/green" only after its tests actually re-run green (evidence, not assumption).
- Report honestly: partial and blocked apps are surfaced clearly, not hidden.
