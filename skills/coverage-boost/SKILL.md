---
name: coverage-boost
description: Raise an app's line coverage by writing tests aimed at the SPECIFIC uncovered functions/branches, reading the coverage report to target exact gaps — across Flutter, Electron, Frappe (Next.js/Supabase have no line coverage). Use when the user runs /testctl:coverage-boost, or says "increase coverage", "cover the untested code", "get coverage to 80", or wants coverage raised to a target.
---

# coverage-boost

Surgical coverage raising. Where `production-ready` tops up apps generally, `coverage-boost` reads
the **coverage report** to find the exact uncovered functions/lines and writes tests for *those*
until a target is met. Additive only; bounded. Read `../generate-tests/stack-conventions.md` for
per-stack patterns.

## Inputs

`/testctl:coverage-boost [path-or-stack] [target%]`: a path/stack narrows scope; an optional target
percent (default: the project's `coverageMin`, else 80). Coverage is line-based — Flutter (lcov),
Electron (jest json-summary), Frappe (cobertura). Next.js/Supabase report no line coverage and are
skipped with a note.

## Steps

1. **Measure.** Run with coverage: `node "<skill-base>/../../dist/testctl.cjs" run --coverage --quiet`
   and read `TESTCTL_JSON` — each app's `coverage` is its current %. Pick the apps below `target`
   (respect any path/stack arg). If all are at/above target, say so and stop.

2. **Find the exact gaps.** For each below-target app, open the coverage artifact the run produced
   and identify the **specific** uncovered functions/lines/branches:
   - Flutter → `coverage/lcov.info` (DA/LF/LH per file; find files with low LH/LF and the
     uncovered line numbers).
   - Electron/jest → `coverage/coverage-summary.json` + `coverage-final.json` (per-file uncovered
     statements/branches).
   - Frappe → the cobertura xml (uncovered lines per class).
   Map those lines back to the source — which functions/branches are never hit.

3. **Write targeted tests.** In NEW files (never overwriting), write unit-logic tests that exercise
   exactly those uncovered functions and branches — both sides of each untested `if`, each error
   path, each switch case. Prefer pure-logic units; don't chase unreachable/dead code or
   framework-generated lines.

4. **Re-measure and iterate (bounded ≤3 rounds).** Re-run with `--coverage`; if still below target
   and the last round added coverage, repeat step 2–3 on the remaining gaps. Stop when the target is
   met, or after 3 rounds, or when a round adds nothing (report what's left and why — often
   integration-only or untestable lines).

5. **Frappe safety:** only run against an `allow_tests` site; otherwise generate and note.

6. **Leave for review.** Do NOT commit. Report per app: `coverage X% → Y%`, files added, and any
   gap intentionally left (with the reason). Tell the user to review `git diff` and commit.

## Rules

- Target the *measured* gaps from the coverage report — don't write tests blindly.
- Additive only; never weaken, skip, or delete an existing test to move the number.
- A test that reveals a real bug is reported (skipped with reason), not used to inflate coverage.
- Bounded to 3 rounds per app — never thrash chasing the last unreachable lines.
- Verify the new tests pass and coverage actually rose before claiming done. Never auto-commit.
