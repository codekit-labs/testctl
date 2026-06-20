---
name: isolation-guard
description: Generate tests that PROVE test isolation — that tests don't leak state, don't depend on run order, and don't share mutable state — so the suite stays deterministic and parallel-safe. Two deterministic checks: a before/after external-state snapshot asserts a test leaves no leftover rows/files/globals it created, and an order-independence re-run asserts the suite gives the same result under a shuffled/reversed order. Across Frappe (FrappeTestCase rollback), Web/Electron/Next.js (jest/vitest), and Flutter. Use when the user runs /testctl:isolation-guard, or says "test isolation", "tests leak state", "order-dependent tests", "tests pass alone but fail together", "teardown guard", "shared state between tests", "parallel-safe tests", or wants the suite proven deterministic and order-independent.
---

# isolation-guard

A green suite can still be a broken one: tests **leak state** (a row, a temp file, a module global left
behind), **depend on run order** (test B passes only because test A ran first), or **share mutable
state** — so the suite is deterministic only by accident of ordering, and breaks under a parallel runner,
a shuffle, or a different machine. "Passes alone but fails together" (or the reverse) is the signature.
This skill pins isolation as a **deterministic, proactive invariant**: it adds checks that PROVE tests
don't leak and don't depend on order, and **reports** (file + line) the violators rather than rewriting
them. It writes a runnable check where the invariant is cleanly testable and reports where it can only
be a static observation. It never auto-rewrites a test, never adds teardown silently, and never weakens
an assertion to pass. Additive; leaves changes for review. Read
`../generate-tests/stack-conventions.md` for per-stack patterns and the `data-factory` master-reuse rule.

This is distinct from two siblings. **`test-audit`** STATICALLY lints existing tests and flags smells
(missing teardown, reliance on order) by reading them — a report pass, no proof. **`flaky-hunter`** RUNS
a suite several times to find intermittently-red tests and stabilizes them. `isolation-guard` is the
deterministic guard in between: it doesn't lint statically and doesn't chase intermittency by
repetition — it adds CHECKS that PROVE isolation (a before/after state snapshot, an order-independence
re-run) and reports the violator for the user to fix.

## Inputs

`/testctl:isolation-guard [path-or-stack]`: a path/stack narrows scope; empty → discover the apps that
have tests (passed + failed > 0) and confirm the list first.

## Steps

1. **Discover the suites in scope.** Run `node "<skill-base>/../../dist/testctl.cjs" run --quiet [stack]`
   (or `--changed` to scope to edited apps) and read the `TESTCTL_JSON` line; target apps that actually
   have tests. Read each app's test files for the two isolation risks below. Confirm the target list
   before writing checks.

2. **No state leak — before/after snapshot** (in NEW files, reusing existing masters; never heavy
   creates — see `data-factory`). Snapshot the external state a representative test touches BEFORE it
   runs and again AFTER, and assert AFTER == BEFORE (it cleaned up everything it created). State to
   snapshot: **DB row counts** for the doctypes/tables the test writes, **temp files** it creates, and
   **global/module-level** state it mutates.
   - **Frappe/ERPNext:** inside `FrappeTestCase` the transaction rolls back, so leaks there are largely
     automatic. The guard's real job is to **REPORT** (file + line): (a) tests that create records but do
     NOT subclass `FrappeTestCase` (a plain `unittest.TestCase` does NOT roll back), and (b) tests that
     call `frappe.db.commit()` (which defeats the rollback and persists rows). Then write a runnable
     check asserting **no `_Test`/created rows persist** (row count returns to baseline) after the
     module's tests run.
   - **Web / Electron / Next.js (jest/vitest):** assert `afterEach` cleanup actually fires; snapshot the
     temp-file set and module-level globals before/after a test and assert no leftover. REPORT a leaked
     module global or temp file that survives the test.
   - **Flutter:** assert `setUp`/`tearDown` reset shared state; REPORT shared mutable `static`s carried
     between tests and leaked `SharedPreferences`/temp files.

3. **Order independence — reordered re-run** (the headline runnable proof). Run the suite, then run it
   again under a **changed order** using the runner's OWN ordering control, and assert identical pass/fail
   results. Changing the order is essential — a re-run in the same order proves nothing.
   - **Web (vitest):** `--sequence.shuffle` (optionally a fixed `--sequence.seed`) to randomize order;
     **jest:** seeded order / `--shard` to vary execution. Compare the two result sets.
   - **Frappe:** re-run the module's tests reversed/shuffled and compare; a flip means a test relies on
     another's residual rows or shared module state.
   - **pytest-based code:** `pytest-randomly` to shuffle (`-p no:randomly` to pin a baseline); **Flutter:**
     re-run under a changed test order.
   A test that passes alone but fails in-suite (or the reverse), or one that flips between the two
   orders, is an isolation violation — **REPORT** it (file + line), naming the cause (a leaked global, a
   shared fixture, a sibling's DB row) where discoverable. Do not auto-fix it.

4. **Run to green.** A real violation (a leaking test, an order-dependent test, a Frappe
   write-without-rollback or a `frappe.db.commit()` that defeats the rollback) is **reported** for the
   user — never auto-rewritten, never made to pass by weakening an assertion or adding teardown into
   someone else's test silently.

5. **Frappe safety:** only run against a site with `allow_tests` enabled.

6. **Leave for review.** Do NOT commit. Report the suites covered, the isolation invariants asserted
   (leak snapshot, reordered re-run), and every violation surfaced (with file + line). Tell the user to
   review `git diff` and commit.

## Rules

- Prove isolation deterministically — a before/after state snapshot (no leftover rows/files/globals) and
  an order-independence re-run (same result under reversed/shuffled order). This is NOT a static lint
  (that's `test-audit`) and NOT a run-N-times intermittency hunt (that's `flaky-hunter`).
- The order-independence proof must actually CHANGE the order (reverse/shuffle via the runner's own
  ordering control) and compare results. A re-run in the SAME order is a vacuous green — it proves
  nothing.
- Report real violations (a leaking test, an order-dependent test, a Frappe write-without-rollback or a
  `frappe.db.commit()` that defeats rollback) **for the user** with file + line — never auto-rewrite the
  test, never add teardown into someone else's test silently, never weaken an assertion to force green.
- **Frappe:** `FrappeTestCase` gives transactional rollback for free; a plain `unittest.TestCase` that
  writes, or any `frappe.db.commit()`, defeats it — flag both, and assert no `_Test`/created rows persist
  after the module's tests.
- Reuse existing masters (Frappe); never create heavyweight records that trigger framework setup
  cascades.
- Additive only — new test files / a focused isolation check; never modify existing tests or app code.
- Frappe/ERPNext tests run only against an `allow_tests` site; never commit to the user's repos.
