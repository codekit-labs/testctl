---
description: Turn a plain-English behaviour into a real runnable test ("test that X with Y gives Z"), run it green, leave for review
argument-hint: "[plain-English behaviour]"
---

Author a test from a description using the test-this workflow.

1. Read the behaviour from `$ARGUMENTS`. If the input or expected result is ambiguous, ask one
   focused question before writing.

2. Follow the `test-this` skill: parse the scenario (unit under test, given input/state, expected
   result); locate the code with `node "${CLAUDE_PLUGIN_ROOT}/dist/testctl.cjs" context` and a quick
   read; reuse existing factories/masters.

3. Write ONE focused, well-named test (NEW file, never overwriting) that encodes exactly the
   described case — arrange the given, act, assert the expected — and run it green (fix the
   generated test, not the app).

4. If the app disagrees with the described expectation, that's a bug: report it and offer
   `/testctl:fix-failures`; never weaken the assertion to force green.

5. Frappe: only run against a site with `allow_tests` enabled.

6. Do NOT commit. Print the test added and its result; tell the user to review the `git diff`.
