---
name: flaky-hunter
description: Find flaky tests by running a suite several times, identify which tests pass sometimes and fail others, diagnose the cause (timing, order-dependence, shared state, network), and stabilize them — across Flutter, Electron, Next.js, Frappe, and Supabase. Use when the user runs /testctl:flaky-hunter, or says "find flaky tests", "this test is flaky", "tests pass sometimes", "why is CI intermittently red", or wants flakiness diagnosed and fixed.
---

# flaky-hunter

Flaky tests erode trust and waste CI. This skill runs a suite repeatedly, isolates the tests that
flip pass↔fail, diagnoses *why*, and fixes the test to be deterministic — it never hides flakiness
behind a blind retry. Leaves changes for review.

## Inputs

`/testctl:flaky-hunter [path-or-stack] [runs]`: a path/stack narrows scope; `runs` is how many times
to repeat (default 5). The `testctl report` command also surfaces apps that have flipped pass↔fail
across history — a good starting hint.

## Steps

1. **Run it N times.** Invoke the engine `runs` times:
   `node "<skill-base>/../../dist/testctl.cjs" run --quiet [stack]`, and read the `TESTCTL_JSON`
   line each time. Collect the `failures[]` digest (test names) from every run.

2. **Isolate the flaky tests.** A test that appears in `failures[]` on **some** runs but not all is
   flaky (consistently-failing = a real failure for `fix-failures`; consistently-passing = fine).
   List the intermittent ones with their flip rate (e.g. "failed 2/5 runs").

3. **Diagnose the cause** (read each flaky test + its target):
   - **Timing** — fixed `sleep`/short timeouts, racing async, animation/`pumpAndSettle` gaps.
   - **Order-dependence / shared state** — relies on another test's side effects, module-level or DB
     state not reset; confirm by running the test alone vs. in the suite.
   - **Non-determinism** — `now()`/random/uuid/locale/timezone, unordered collections asserted in
     order, network/external calls.
   - **Resource** — ports, files, DB rows left by a missing teardown.

4. **Stabilize the test** (the real fix): await the actual condition instead of sleeping, seed
   randomness/clock, isolate state with proper setup/teardown, sort before asserting, mock the
   external call. NEVER "fix" a flaky test by weakening its assertion, `skip`-ping it, or just
   wrapping it in retries to mask the problem. Re-run several times to confirm it's now stable.

5. **Frappe safety:** only run against a site with `allow_tests` enabled.

6. **Leave for review.** Do NOT commit. Report each flaky test, its diagnosed cause, the fix, and
   the post-fix stability (e.g. "5/5 green now"). Tell the user to review `git diff` and commit.

## Rules

- Detect by evidence — multiple runs, compared — not by guessing.
- Fix the *cause* (determinism); never weaken/skip a test or hide flakiness behind `--retry`.
- A consistently-failing test is a real failure → `fix-failures`, not flakiness.
- Verify stability by re-running several times before claiming fixed. Never auto-commit.
