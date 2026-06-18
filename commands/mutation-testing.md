---
description: Prove the tests catch bugs — apply surgical mutations to high-value code, find mutations that survive (no test fails), then write killing tests
argument-hint: "[path-or-stack]"
---

Run mutation testing on the current project using the mutation-testing workflow.

1. Determine scope from `$ARGUMENTS`: a path/stack narrows it; empty → confirm the target list first,
   then focus on high-consequence logic (money/tax/permissions/date, `--changed` code, thinly-tested
   symbols from `context`).

2. Establish a green baseline: `node "${CLAUDE_PLUGIN_ROOT}/dist/testctl.cjs" run $ARGUMENTS --quiet`
   and read `TESTCTL_JSON`. If anything fails → stop and point at `/testctl:fix-failures`. If the
   target has no tests → point at `/testctl:generate-tests`.

3. Follow the `mutation-testing` skill: for each target site, apply ONE mutation from the catalog
   (comparison/boolean/arithmetic/return/remove-a-guard), re-run the scoped suite, classify
   killed-vs-survived, and REVERT immediately. Cap ~8–15 sites and state what you sampled.

4. Report survivors ranked by severity (file:line, original → mutated, why no test caught it). For each
   survivor write a killing test (harden style); confirm it FAILS on the mutation and PASSES on the
   original, then revert the mutation.

5. Frappe: only run against an `allow_tests` site.

6. Safety: mutate one site at a time and always revert with `git checkout -- <file>` (or `git stash`)
   — not from memory. If a run errors or is interrupted, restore the original first before anything
   else. The working tree must end with only new test files, never a mutated source line. Do NOT
   commit. Print the report + tests written; tell the user to review `git diff` and commit.
