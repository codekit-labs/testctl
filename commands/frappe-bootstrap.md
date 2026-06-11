---
description: Fix a Frappe test run that won't bootstrap — generate a test-only before_tests hook that seeds mandatory fields AND creates missing test masters (_Test Company, _Test Holiday List, …).
argument-hint: "[app]"
---

Unblock Frappe test bootstrap using the frappe-bootstrap workflow.

1. Determine the app from `$ARGUMENTS`; if empty, read `testctl.yaml` `stacks.frappe.apps` and confirm
   which app's tests are blocked.

2. Confirm this is a Frappe app with a reachable bench/site (`testctl.yaml` `stacks.frappe`). If not,
   say so and stop — write nothing. Suggest `/testctl:init` if there is no config.

3. Discover the blocking mandatory fields: use the `Doctype: field` from the latest
   `node "${CLAUDE_PLUGIN_ROOT}/dist/testctl.cjs" run frappe --quiet` (read `TESTCTL_JSON.error`),
   then scan the bench for other mandatory Custom Fields on common auto-created test masters.

4. Follow the `frappe-bootstrap` skill: generate an idempotent, `frappe.flags.in_test`-guarded
   `before_tests` hook in the app (seed an existing value where possible; relax in-test only as a
   fallback), wire it in `hooks.py` (extend any existing hook, never overwrite), then re-run the
   Frappe stack until the bootstrap clears.

5. Leave all changes uncommitted; summarise the fields handled and the diff for review.
