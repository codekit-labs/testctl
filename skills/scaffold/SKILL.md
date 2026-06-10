---
name: scaffold
description: Set up the testing harness for an app that has none — jest/vitest config, a Flutter test/ setup, a Frappe test module + allow_tests note, a Supabase pgTAP dir — plus a first passing test, so `testctl run` works and real tests can follow. Use when the user runs /testctl:scaffold, or says "set up testing", "there are no tests", "add a test harness", "how do I start testing this", or wants the zero-to-one testing setup done.
---

# scaffold

The hardest part of testing is *starting* — wiring the runner, config, and folders before you can
write a single test. This skill does the zero-to-one setup for an app that has none: the harness +
one passing test, so `testctl run` discovers it green, then hands off to `generate-tests` for real
coverage. Additive; never overwrites. Read `../generate-tests/stack-conventions.md`.

## Inputs

`/testctl:scaffold [path-or-stack]`: a path/stack narrows scope; empty → discover apps that have NO
tests (via `node "<skill-base>/../../dist/testctl.cjs" context`) and confirm the list.

## Steps

1. **Confirm it's un-set-up.** Use `testctl context` — target apps with no tests / no test harness.
   If the harness already exists, say so and suggest `generate-tests` instead.

2. **Scaffold the stack's harness** (match what's installed; don't add heavy deps without saying so):
   - **Electron/Next.js:** ensure a test runner (jest or vitest) + a minimal config and a `test`
     script in `package.json`; create a `__tests__/` (or `*.test.ts`) location.
   - **Flutter:** ensure `flutter_test` in dev-dependencies and a `test/` directory.
   - **Frappe:** ensure the doctype's `test_<name>.py` module exists; note that tests need a site
     with `allow_tests` enabled (and `unittest-xml-reporting` for JUnit) — don't run against prod.
   - **Supabase:** create the `supabase/tests/` pgTAP directory.

3. **Add ONE passing smoke test** — the simplest real test for the stack (it builds/imports/responds)
   — so the harness is proven, not just present.

4. **Prove it's wired.** Run `node "<skill-base>/../../dist/testctl.cjs" run [stack]` and confirm the
   app now reports a passing test (it's discovered + green).

5. **Hand off.** Point the user to `/testctl:generate-tests` (or `test-this`) to add real coverage now
   that the harness exists.

6. **Frappe safety:** only run against an `allow_tests` site; otherwise scaffold and leave a note.

7. **Leave for review.** Do NOT commit. Report what was scaffolded (config, dirs, the smoke test) and
   the green run. Tell the user to review `git diff` and commit.

## Rules

- Additive and idempotent — never overwrite existing config/tests; skip what's already set up.
- Prove the harness with a real passing smoke test, not just files.
- Don't add heavy/native test dependencies without telling the user; match the project's stack.
- Frappe only against an `allow_tests` site. Verify green. Never auto-commit.
