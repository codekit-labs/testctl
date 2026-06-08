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

1. **Detect the coverage gate.** A gate is configured if `testctl.yaml` has a top-level
   `coverageMin: N`, or the user passed `--min-coverage=N` to this command. If a gate exists,
   capture `target = N` and turn coverage collection ON for all runs below. If no gate exists,
   skip every coverage step that follows — behave exactly as before.

2. **Discover apps.** Run the engine: `node "<skill-base>/../../dist/testctl.cjs" run --quiet`
   (scoped to the arg if given; add `--coverage` when a gate exists) and read `TESTCTL_JSON`.
   Note each app, whether it has tests / is green, and its `coverage` (an integer % or null).
   Keep any "needs config" notices (Next.js without vercelUrl, Frappe without bench/site/apps)
   aside for the final report — they need the user, not generation.

3. **For each runnable app, loop up to 3 rounds:**
   a. **Decide if it needs generation.** Generate when EITHER:
      - it has no tests (no/empty test dir, or 0 passed + 0 failed), OR
      - a gate exists AND its `coverage` is non-null AND `coverage < target`
        (apps whose coverage is null — Next.js, Supabase, or unavailable — are never
        coverage-triggered).
      If it needs generation → invoke the `generate-tests` skill **by the app's path**. When the
      trigger is low coverage (the app already has tests), instruct generate-tests to focus on
      **currently-uncovered logic** — functions/branches not yet exercised — to raise coverage
      toward `target`. generate-tests is additive (new files, never overwrites), so each round
      adds tests for the remaining gaps.
   b. **Run** the app's tests (with `--coverage` when a gate exists).
   c. If there are failures → invoke the `fix-failures` skill (root-cause + minimal fix; it
      stops on risky fixes and never weakens tests).
   d. **Re-run** (with `--coverage` when a gate exists). The app is done — break the loop — when
      it is green AND (no gate, OR `coverage >= target`). If `fix-failures` stopped on a risky
      fix, or it is still red, or it is still below `target`, after round 3 → record what remains
      and move on. Never loop past 3 rounds for one app.

4. **Readiness report.** For every app print one of:
   - ✅ **green** — tests present and passing, and (if a gate exists) `coverage >= target`. Note
     if tests were generated this run, and any "coverage raised X% → Y%".
   - ⚠️ **partial** — green but `coverage < target` after 3 rounds (state the numbers, e.g.
     "coverage 55% < target 70% after 3 rounds"), OR some green / some stopped-on-risk (list what
     needs a human + the proposed fix).
   - ⛔ **blocked** — needs config (Next.js vercelUrl / Frappe bench+site+apps) or an unresolved
     failure.
   Summarize totals (apps green / partial / blocked, tests generated, failures fixed, and apps
   whose coverage was raised).

5. **Leave everything uncommitted.** Tell the user to review the `git diff` per app and commit.
   Do NOT commit anything.

## Rules

- Bounded: at most 3 rounds per app — never loop indefinitely (this single cap covers both
  failure-fixing and coverage-raising).
- Coverage raising is opt-in: it happens ONLY when a gate (`coverageMin` / `--min-coverage`) is
  configured AND an app is measurably below it. With no gate, behaviour is identical to before —
  only zero-test apps are generated, and runs do not collect coverage.
- Inherit all sub-skill rails: never weaken/skip/delete tests, stop on risky fixes, Frappe only
  on an `allow_tests` site, never auto-commit.
- An app is "ready/green" only after its tests actually re-run green (evidence, not assumption),
  and — when a gate is set — only after its measured coverage reaches the target.
- Report honestly: an app that is green but still under the coverage target is ⚠️ partial, never
  ✅. Partial and blocked apps are surfaced clearly, not hidden.
