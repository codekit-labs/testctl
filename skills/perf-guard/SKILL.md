---
name: perf-guard
description: Generate tests that protect against performance regressions by asserting DETERMINISTIC resource-use invariants — chiefly no-N+1: the number of expensive calls (DB queries / outbound requests) an operation makes must NOT grow with input size. Deterministic by design, so unlike wall-clock budgets it never flakes. Discovers the project's OWN hot paths. Use when the user runs /testctl:perf-guard, or says "test for N+1", "catch slow queries", "performance regression test", "query count test", "is this endpoint slow", "perf test", or wants performance protected from regressions.
---

# perf-guard

The most common real performance bug is the N+1: a loop that issues one query (or HTTP call) per row,
so cost grows with data and a fast dev test hides a slow production page. This skill pins performance
as a **deterministic invariant** — it counts the expensive calls an operation makes and asserts the
count does NOT scale with input size. Because it counts calls (not wall-clock time), the tests are
exact and never flaky — which matters: testctl also ships `flaky-hunter`, and a timing-based perf test
would contradict it. Frappe/ERPNext and DB-backed Node stacks get DB-query counting; Flutter/Electron
get outbound-call counting. Additive; leaves changes for review. Read
`../generate-tests/stack-conventions.md` for per-stack patterns and the `data-factory` master-reuse rule.

## Inputs

`/testctl:perf-guard [path-or-stack]`: a path/stack narrows scope; empty → discover the hot paths and
confirm the list first.

## Steps

1. **Discover the hot paths.** Read the project's OWN code for operations whose cost can scale with
   data: list/report endpoints and whitelisted methods, controllers/services that loop over records or
   fetch related data per row, and code surfaced by
   `node "<skill-base>/../../dist/testctl.cjs" run --changed --quiet` / `context`. Confirm the target
   list before writing tests.

2. **Write a no-N+1 scaling test per hot path** in NEW files, reusing existing masters (never heavy
   creates — see `data-factory`; seed only the lightweight rows the scaling check needs). The pattern:
   a. **Instrument the expensive collaborator** for the stack (see below) to COUNT its calls.
   b. Seed `n1` records, run the operation, record `calls(n1)`.
   c. Seed `n2` records (`n2 > n1`, e.g. 5×), run again, record `calls(n2)`.
   d. **Assert the count does not scale:** `calls(n2) == calls(n1)` (constant), or within a fixed
      bound that does NOT depend on N. A count that grows with N is an N+1 — fail it.

   **What to count, per stack:**
   - **Frappe/ERPNext:** count `frappe.db.sql` / `frappe.db.get_value` (and similar) calls — wrap/patch
     them with a counter around the operation. The classic ERPNext N+1 fetches a linked doc per row.
   - **Next.js / Supabase / DB-backed Node:** count ORM/client queries via its query hook/event
     (e.g. Prisma `$on('query')`, or a spy on the DB client).
   - **Flutter / Electron:** count outbound HTTP / repository-method calls via an injected spy/mock
     counter (no real DB, but the same per-item call regression exists).

3. **Optional pins (only if asked or clearly valuable):**
   - **Bounded count budget:** assert an operation issues ≤ K queries/calls, where K is taken from the
     CURRENT observed count and written explicitly in the test (a hard pin, in addition to the scaling
     check).
   - **Wall-clock budget — opt-in only, and flag it.** Add a time assertion ONLY if the user asks; use
     a warm-up run + a generous margin, and a comment noting it is machine/CI-dependent and may flake.
     Never the default.

4. **Run to green.** If a test reveals a real regression (an N+1, an unbounded query count), do NOT
   optimize/rewrite app code here — report it (skip the assertion with a clear reason) for the user.
   Never weaken an assertion (e.g. raise K to whatever the current count happens to be) to force green.

5. **Frappe safety:** only run against a site with `allow_tests` enabled.

6. **Leave for review.** Do NOT commit. Report the hot paths covered, the call-count invariants
   asserted, and any regression surfaced. Tell the user to review `git diff` and commit.

## Rules

- Deterministic by default — assert COUNTS (queries/calls), never wall-clock time. Wall-clock is opt-in
  only and must be flagged as environment-sensitive; never add it silently.
- The no-N+1 scaling check (count over N vs larger-N) is the headline; a fixed count budget is an
  optional add-on, not a replacement.
- Reuse existing masters; never create heavyweight records that trigger framework setup cascades.
- **Verify the counter is real before trusting a green scaling test: confirm `calls(n1) > 0` (it
  actually fires), and that on a deliberately N+1-shaped call the count DOES scale. A constant count
  when you expect per-row work means you instrumented the wrong collaborator — the test is vacuous,
  not passing.**
- **Reset the counter and seeded state between the n1 and n2 runs** (`FrappeTestCase` rolls back
  automatically; for Node/Flutter/Electron spies, reset explicitly) so `calls(n2)` reflects only the
  n2 records.
- Additive only — new test files; never modify or "optimize" app code. A real regression is reported
  for the user, never silently fixed here, and an assertion is never weakened to force green.
- Frappe/ERPNext tests run only against an `allow_tests` site; never commit to the user's repos.
