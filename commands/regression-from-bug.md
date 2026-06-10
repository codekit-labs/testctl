---
description: Turn a bug report / stack trace into a failing test that reproduces it (red), then hand off the fix
argument-hint: "[bug description or stack trace]"
---

Capture a bug as a regression test using the regression-from-bug workflow.

1. Read the bug from `$ARGUMENTS` (a stack trace, an error, or a reproduction). If it's thin, ask
   the user for the exact input, the expected result, and the actual result.

2. Follow the `regression-from-bug` skill: pin down the entry point + triggering input + expected vs
   actual, read the implicated source, then write a NEW failing test that reproduces it — asserting
   the EXPECTED (correct) behaviour. Never modify existing tests.

3. Run the stack's test command and confirm the new test is RED for the reported reason (not a
   setup error). Refine the reproduction until it reliably fails.

4. Do NOT fix app code here — report the red regression test + the root-cause hypothesis and offer
   to run `/testctl:fix-failures` to make it green (or continue if the user asks).

5. Frappe: only run against a site with `allow_tests` enabled.

6. Do NOT commit. Print the test added, that it reproduces the bug, and the proposed cause. Tell the
   user to review the `git diff`.
