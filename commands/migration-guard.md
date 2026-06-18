---
description: Generate tests protecting Frappe data patches from corrupting data — idempotency, no-crash, intended transformation, no collateral loss — by calling execute() directly in a FrappeTestCase
argument-hint: "[path-or-stack]"
---

Guard Frappe data-patch safety using the migration-guard workflow.

1. Determine scope from `$ARGUMENTS`: a path/stack narrows it; empty → the patches in the diff plus
   recent / not-yet-applied patches — confirm the list first (do NOT re-test every historical patch).

2. Discover patches: read each target app's `patches.txt`, resolve each entry to its
   `<app>/patches/.../<name>.py` module, and read its `execute()` to infer the DocType(s) touched and
   the intent. Use `node "${CLAUDE_PLUGIN_ROOT}/dist/testctl.cjs" run --changed --quiet` (read
   `TESTCTL_JSON`) to find changed patches.

3. Follow the `migration-guard` skill: for each patch write a NEW `FrappeTestCase` (reusing existing
   masters, never heavy creates) that seeds representative pre-state, calls the patch's `execute()`
   directly (import `<app>.patches.<path>.<name>` — NEVER `bench migrate`), asserts the invariants
   (idempotency by calling execute() twice; no-crash on empty/null/already-migrated rows; the intended
   transformation when clear, else report it; no collateral data loss), and rolls back via the test.

4. Run to green. A real unsafe patch (not idempotent / crashes / loses data) → report it (skip with a
   reason) for `/testctl:fix-failures`; never rewrite the patch or weaken an assertion to force green.

5. Frappe: only run against a site with `allow_tests` enabled.

6. Do NOT commit. Report the patches covered, invariants asserted vs reported-ambiguous, and any unsafe
   patch surfaced. Tell the user to review the `git diff` and commit.
