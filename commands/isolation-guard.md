---
description: Generate tests that prove test isolation — no state leak, order independence, no shared mutable state — so the suite stays deterministic and parallel-safe, by checking the project's own tests
argument-hint: "[path-or-stack]"
---

Prove test isolation using the isolation-guard workflow.

1. Determine scope from `$ARGUMENTS`: a path/stack narrows it; empty → discover the apps that have tests
   (passed + failed > 0) and confirm the list.

2. Discover the suites: `node "${CLAUDE_PLUGIN_ROOT}/dist/testctl.cjs" run --quiet` (or `--changed` to
   scope to edited apps) and read `TESTCTL_JSON`; read each app's test files for state leaks and
   order-dependence.

3. Follow the `isolation-guard` skill. For each app in scope write NEW checks (reuse existing masters,
   never heavy creates):
   - **No state leak:** snapshot the **identity set** of rows/files the test creates, scoped by a unique
     marker (name prefix, UUID, temp-dir path) BEFORE and AFTER, and assert the marker-scoped set is
     empty after. Do NOT use a bare global row/file count — it masks net-zero create-and-delete and
     races under a parallel runner. Frappe: `FrappeTestCase` rolls back automatically — REPORT (file +
     line) tests that create rows in a plain `unittest.TestCase` (no rollback) or call
     `frappe.db.commit()` (defeats rollback), and assert no marker-scoped rows persist after the
     module's tests. This persistence assertion must run OUTSIDE the `FrappeTestCase` rollback boundary
     (a separate connection or plain `unittest.TestCase` wrapper) — otherwise the rollback self-clears
     the rows and the check is a vacuous green.
   - **Order independence:** run the suite, then re-run it under a CHANGED order using the runner's own
     control (vitest `--sequence.shuffle`, jest seeded/`--shard`, `pytest-randomly`, Flutter test order)
     and assert identical pass/fail. **Verify the new permutation actually differs from the original
     before trusting a green** — reverse is a no-op for a 1-test module, and a shuffle can reproduce
     the original seed. If the order did not change, re-shuffle or pick a known-different permutation.
     A suite with fewer than 2 order-sensitive tests cannot prove order-independence — skip with a
     reason. A test that flips between orders (or passes alone but fails in-suite) → REPORT it (file +
     line), naming the cause where discoverable.

4. Run to green. A real violation (a leaking test, an order-dependent test, a Frappe
   write-without-rollback) → REPORT it (skip with a reason) for the user; never auto-rewrite the test,
   never add teardown silently, never weaken an assertion to force green.

5. Frappe: only run against a site with `allow_tests` enabled.

6. Do NOT commit. Report the suites covered, the isolation invariants asserted (leak snapshot, reordered
   re-run), and every violation surfaced (with file + line). Tell the user to review the `git diff` and
   commit.
