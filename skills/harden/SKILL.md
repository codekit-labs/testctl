---
name: harden
description: Add adversarial edge-case tests to an app that already has happy-path tests — nulls, empty/large inputs, boundaries, unicode, and error paths — across Flutter, Electron, Next.js, Frappe, and Supabase. Use when the user runs /testctl:harden, or says "add edge cases", "harden the tests", "test the error paths", "make my tests meaner", or wants tougher tests for code that's only happy-path tested.
---

# harden

Make an existing suite meaner. `generate-tests` writes the smoke + basic-logic safety net; `harden`
adds the **nasty** cases that catch real bugs. Additive only — new files, existing tests untouched.
Read `../generate-tests/stack-conventions.md` for per-stack patterns and run commands.

## Inputs

`/testctl:harden [path-or-stack]`: a path → that one app; a stack → apps of that stack; empty →
discover apps that already have tests and confirm the list with the user before proceeding.

## Steps

1. **Find targets.** Run the engine: `node "<skill-base>/../../dist/testctl.cjs" run --quiet` and
   read the `TESTCTL_JSON` line. An app is a harden target if it **has tests** (passed + failed >
   0) — apps with no tests should go through `generate-tests` first. Respect any path/stack arg.

2. **Understand what's already covered (token-cheap first).** Run
   `node "<skill-base>/../../dist/testctl.cjs" context` — its `TESTCTL_CONTEXT` line gives each
   app's **untested functions/classes (name + file:line)**, so you open only those. Then read that
   source AND its existing tests to find the **happy-path-only** gaps — branches, validations, and
   error handling the current tests never exercise. Don't re-test what's already covered.

3. **Write edge-case tests** into NEW, clearly-named files (e.g. `*_edge_test.dart`,
   `*.edge.test.ts`). NEVER modify or overwrite existing tests. Cover the cases that actually break
   code:
   - **Empty / null / missing** — empty strings, empty lists, null/None, absent keys, zero.
   - **Boundaries** — min/max, off-by-one, first/last, exactly-at-limit and one past it.
   - **Large / weird input** — very long strings, big numbers, unicode/RTL, whitespace, special chars.
   - **Error paths** — invalid input throws/returns the right error; permission denied; not-found;
     duplicate; timeout. Assert the *specific* failure, not just "it throws".
   - **Domain edges** (per the user's stack) — multi-company / multi-currency, zero-tax vs taxed,
     negative amounts, rounding, RTL/Arabic text.

4. **Run to green, fixing the GENERATED TESTS only.** If an edge case reveals a real bug in the
   app, do NOT fix app code (that's the `fix-failures` phase): mark that one test `skip` with a
   clear reason and report the bug. Never leave a red suite behind.

5. **Frappe safety:** only run against a site with `allow_tests` enabled — otherwise write the
   tests and leave a note, never touch production.

6. **Leave for review.** Do NOT commit. Print per app: files added, edge cases covered, any real
   bug surfaced (with the skipped test). Tell the user to review `git diff` and commit.

## Rules

- Additive only — never modify or delete existing tests.
- Assert the *specific* expected behaviour of each edge, not a vague "doesn't crash".
- A real bug found is REPORTED (test skipped with reason), not patched here — hand it to `fix-failures`.
- Verify green before claiming done (except Frappe-without-test-site, which is generate-only).
- Never commit to the user's repos; match the project's existing test style and deps.
