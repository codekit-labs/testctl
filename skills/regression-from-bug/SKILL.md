---
name: regression-from-bug
description: Turn a bug report, stack trace, or failing scenario into a test that reproduces it FIRST (red), then hand off the fix — across Flutter, Electron, Next.js, Frappe, and Supabase. Use when the user runs /testctl:regression-from-bug, pastes a bug/traceback, or says "write a regression test for this bug", "reproduce this in a test", "this broke in prod — add a test", or wants a permanent guard for a defect.
---

# regression-from-bug

A bug isn't fixed until a test would have caught it. This skill captures a defect as a **failing
test first** (red), confirms it fails for the *right* reason, then hands the fix to `fix-failures` —
proper TDD for bug-fixing. Additive; leaves changes for review. Read
`../generate-tests/stack-conventions.md` for per-stack patterns.

## Inputs

`/testctl:regression-from-bug [description]`: the bug — a paste of the error/stack trace, a
reproduction ("when X with Y, Z happens instead of W"), or a failing-scenario description. If the
input is thin, ask the user for: the exact input, the expected result, and the actual result.

## Steps

1. **Understand the defect.** From the report, pin down: the entry point (function/endpoint/widget),
   the triggering input, the expected behaviour, and the wrong actual behaviour. Read the implicated
   source to confirm where it goes wrong.

2. **Write the failing test.** In a NEW, clearly-named test (e.g. `*_regression_test.dart`,
   `*.regression.test.ts`, or a `TestRegression…` Frappe case), encode the exact reproduction:
   the same input → assert the **expected** (correct) behaviour. NEVER modify existing tests.

3. **Confirm it's red for the right reason.** Run the stack's command — the new test MUST fail, and
   the failure must match the reported bug (the actual wrong value/error), not a setup/typo error.
   If it passes, the reproduction is wrong — refine the input until it reliably reproduces.

4. **Hand off the fix.** Do NOT fix app code in this skill — that's the `fix-failures` phase. Report
   the now-red regression test and the root-cause hypothesis, and offer to run `fix-failures` to
   make it green. (If the user explicitly asks for the fix too, follow `fix-failures` next.)

5. **Frappe safety:** only run against a site with `allow_tests` enabled; otherwise write the test
   and leave a note.

6. **Leave for review.** Do NOT commit. Print: the test added, that it reproduces the bug (red), and
   the proposed root cause. Tell the user to review `git diff`, then fix (or run `fix-failures`).

## Rules

- Red first — a regression test must FAIL before any fix, proving it actually catches the bug.
- It must fail for the *reported* reason, not an unrelated setup error.
- Additive only; never weaken or edit existing tests.
- Fixing the app is the `fix-failures` phase, not this one (unless the user asks to continue).
- Never commit to the user's repos.
