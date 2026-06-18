---
name: migration-guard
description: Generate tests that protect Frappe/ERPNext data patches from corrupting data — assert idempotency (running execute() twice is safe), no-crash on real/edge data, the patch's intended transformation, and no collateral data loss — by reading the project's OWN patches (patches.txt + the patch modules) and calling execute() directly in a FrappeTestCase (never a destructive bench migrate). Use when the user runs /testctl:migration-guard, or says "test my patches", "is this migration safe", "patch idempotency", "will this migration corrupt data", "test before bench migrate", "data patch test", or wants Frappe migrations protected from regressions.
---

# migration-guard

Frappe data patches run once against the live database during `bench migrate` — and a bad one
silently corrupts or loses production data: it isn't idempotent (a retry double-applies), it crashes
on real-world rows, or it transforms the wrong records. This skill writes tests that pin patch
**safety**, derived from the project's OWN patches — and it does so WITHOUT ever running a destructive
`bench migrate`: it calls each patch's `execute()` directly inside a `FrappeTestCase`, so every change
rolls back. Frappe-only. Additive; leaves changes for review. Read `../generate-tests/stack-conventions.md`
for Frappe test patterns and the `data-factory` skill's master-reuse rule.

## Inputs

`/testctl:migration-guard [path-or-stack]`: a path/stack narrows scope; empty → the patches touched in
the diff (`run --changed`) plus recent / not-yet-applied patches — confirm the list first. It does NOT
re-test every historical patch (most are long applied and obsolete).

## Steps

1. **Discover the patches — read, don't guess.** For each target Frappe app, parse `<app>/patches.txt`,
   resolve each entry to its module file (`<app>/patches/.../<name>.py`), and read its `execute()` to
   infer the DocType(s) it touches and what it intends to change. Default targets = patches in the diff
   (`node "<skill-base>/../../dist/testctl.cjs" run --changed --quiet`, read `TESTCTL_JSON`) plus
   recent / unapplied ones (not in `Patch Log`); confirm the list.

2. **Write a safety test per patch** in NEW files, inside a `FrappeTestCase`, reusing existing masters
   (never heavy creates — see `data-factory`). The pattern for each patch:
   a. **Seed representative pre-migration data** — records in the state the patch expects to transform
      (include an edge row: a null/missing optional field, an already-migrated row).
   b. **Call `execute()` directly** — import the patch module (`<app>.patches.<path>.<name>`) and call
      `execute()`. Do NOT shell out to `bench migrate`.
   c. **Assert the invariants** (below).
   d. **Call `execute()` again** and assert idempotency — the second run neither errors nor
      double-applies.

   **Invariants:**
   - **Idempotency (universal — always assert):** a second `execute()` is a no-op and never raises
     (doesn't re-increment, re-insert, or re-transform already-migrated rows).
   - **No-crash on realistic + edge data (universal — always assert):** survives empty tables,
     null/missing optional fields, and already-migrated rows without raising.
   - **Intended transformation (assert when clear; REPORT when ambiguous):** assert what the patch
     should achieve — e.g. every row with the old value now has the new value; a new field is
     backfilled for all rows. **If the intent is ambiguous from reading the patch, report it for the
     user to confirm — never assert a guessed transformation** (a wrong guess is a false failure).
   - **No collateral loss:** records/links the patch should NOT touch are unchanged (counts preserved);
     no orphaned links introduced; a field the patch makes mandatory is backfilled (no nulls left).

3. **Run to green.** If a test reveals a real bug in the patch (not idempotent, crashes, loses data),
   do NOT rewrite the patch here — report it (skip the assertion with a clear reason) for
   `/testctl:fix-failures`. Never weaken an assertion to force green.

4. **Frappe safety:** only run against a site with `allow_tests` enabled.

5. **Leave for review.** Do NOT commit. Report the patches covered, which invariants were asserted vs
   reported-as-ambiguous, and any unsafe patch surfaced. Tell the user to review `git diff` and commit.

## Rules

- NEVER run `bench migrate`. Always call the patch's `execute()` directly inside a `FrappeTestCase` so
  the database change rolls back at teardown.
- **The rollback guarantee requires `FrappeTestCase` specifically** (it wraps each test in a transaction
  rolled back at teardown) — not a plain `unittest.TestCase`. If the patch's `execute()` calls
  `frappe.db.commit()` (some long-running ERPNext patches do), the rollback is defeated and seeded test
  rows persist on the site — detect this, warn the user, and prefer a disposable/throwaway test site for
  such patches.
- Idempotency and no-crash are universal and always asserted. The intended transformation is asserted
  ONLY when the patch's intent is clear from its code — otherwise it is reported, not guessed.
- Reuse existing masters; never create heavyweight records that trigger framework setup cascades.
- Additive only — new test files; never modify a patch or other app code. A real unsafe patch is
  reported and handed to `fix-failures`, never rewritten or weakened-around here.
- Frappe/ERPNext only; run only against an `allow_tests` site; never commit to the user's repos.
