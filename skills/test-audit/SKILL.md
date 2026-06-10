---
name: test-audit
description: Review an app's existing tests for quality and flag "green but worthless" suites — assertions that don't assert, tests that can't fail, over-mocking, missing teardown, brittle sleeps/selectors, order-dependence, and silently-skipped tests. Use when the user runs /testctl:test-audit, or says "review my tests", "are these tests any good", "audit the test suite", "find weak tests", or suspects tests that pass without checking anything.
---

# test-audit

A passing suite isn't always a real one. `test-audit` reads existing tests and reports the ones that
look green but protect nothing — then fixes the safe cases. It does NOT generate new coverage (use
`generate-tests`/`coverage-boost` for that); it judges what's already there.

## Inputs

`/testctl:test-audit [path-or-stack]`: a path/stack narrows scope; empty → audit every app that has
tests (confirm the list first).

## Steps

1. **Find suites.** Run `node "<skill-base>/../../dist/testctl.cjs" run --quiet`, read `TESTCTL_JSON`;
   audit apps that have tests (passed + failed > 0). Read each app's test files.

2. **Flag the smells** (cite file:line for each):
   - **No real assertion** — a test with no `expect`/`assert`/matcher; a body that only constructs
     objects or logs; an empty/`pass` stub (e.g. `class TestX(FrappeTestCase): pass`).
   - **Can't fail** — asserts a literal/constant (`expect(true).toBe(true)`), or asserts the mock's
     own return value (testing the mock, not the unit).
   - **Over-mocking** — the unit under test is itself mocked/stubbed, so nothing real runs.
   - **Brittle** — fixed `sleep`/timeouts, index/pixel-based selectors, hard-coded dates/IDs,
     reliance on test execution order or shared mutable state.
   - **Hidden gaps** — `skip`/`xit`/`@skip`/`todo` left silently; commented-out assertions;
     try/catch that swallows the failure.
   - **No teardown** — created records/files/DB rows never cleaned up (esp. Frappe/Supabase).

3. **Report** — a ranked summary: per app, the issues by severity (🔴 can't-catch-bugs / 🟡 brittle
   / 🟢 minor), each with file:line and a one-line "why it's a problem".

4. **Fix the safe ones** (optional, only when unambiguous): add the missing assertion that matches
   the test's obvious intent; replace a tautology with a real check; remove a mock of the unit under
   test; add teardown. NEVER weaken a test, and NEVER change one whose intent is ambiguous — report
   those for the user to decide. Re-run to confirm still green.

5. **Frappe safety:** only run against an `allow_tests` site.

6. **Leave for review.** Do NOT commit. Print the audit report + what was fixed vs left for the
   user. Tell them to review `git diff` and commit.

## Rules

- Judge, don't pad — this skill improves existing tests; it doesn't add new coverage.
- NEVER weaken, skip, or delete a test to "clean up"; strengthen or report instead.
- Only auto-fix unambiguous cases; ambiguous/intent-unclear ones are reported, not edited.
- A strengthened test must still pass for the right reason (and now be *able* to fail). Verify green.
- Never commit to the user's repos.
