---
name: generate-tests
description: Generate runnable smoke + unit-logic tests for an app that has few or no tests, across Flutter, Electron, Next.js, Frappe, and Supabase. Use when the user runs /testctl:generate-tests, or says "write tests for", "add tests", "generate test cases", or wants a test safety net for an untested app.
---

# generate-tests

Write real, runnable tests for an app that lacks them, run them to green, and leave them for
the user to review. Read `stack-conventions.md` (next to this file) for per-stack patterns and
run commands.

## Inputs

`/testctl:generate-tests [path-or-stack]`:
- a **path** → generate for that one app
- a **stack** (`flutter`/`electron`/`nextjs`/`frappe`/`supabase`) → generate for apps of that stack
- **nothing** → find apps that need tests (below) and confirm the list with the user before proceeding

## Steps

1. **Find targets.** Run the engine to discover apps:
   `node "<skill-base>/../../dist/testctl.cjs" run --quiet` (read the `TESTCTL_JSON` line). For each
   discovered app, an app "needs tests" if it has no test directory, an empty one, or the run
   reported 0 passed + 0 failed. Build the target list (respecting any path/stack argument).
   If nothing needs tests, say so and stop.

2. **For each target app, understand it.** Read the key source for its stack: the entry
   widget/screen, pure functions, models, services/providers, API route handlers, DB
   schema/functions. Keep it focused — you don't need every file.

3. **Write tests** into the app's conventional location (see `stack-conventions.md`).
   - Add NEW, clearly-named files (e.g. `testctl_smoke_test.dart`, `testctl_unit.test.ts`).
   - **NEVER overwrite or modify existing test files.**
   - Cover: one or two **smoke** tests (builds/renders/responds) + **unit-logic** tests for
     the pure functions/business logic you found. Do not attempt brittle full-UI coverage.

4. **Run** the stack's command (see the conventions doc) and **iterate until the generated
   tests pass.** Fix the GENERATED TESTS on failure — not the app.
   - If a generated test reveals a real bug in the app, do NOT fix app code (that's the
     fix-failures phase). Mark that one test `skip` with a clear reason and report the bug.
   - Never leave a red generated suite behind.

5. **Frappe safety:** only run generated Frappe tests against a site with `allow_tests`
   enabled. If none is configured, generate the tests and DO NOT run them — leave a note:
   "run on a test site with allow_tests; not production."

6. **Leave for review.** Do NOT commit. Print a summary per app: files added, number of tests,
   and the green run result. Tell the user to review `git diff` in that app and commit when happy.

## Rules

- Additive only — never modify or delete existing tests.
- Verify green before claiming done (except Frappe-without-test-site, which is generate-only).
- Never commit to the user's repos.
- Never fix the app's own logic in this skill — report real bugs for the fix-failures phase.
- Match the project's existing style and dependencies; don't add heavy test deps without saying so.
