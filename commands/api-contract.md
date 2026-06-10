---
description: Generate API contract tests — status codes, response shape, error envelope, auth, pagination — from the project's own endpoints
argument-hint: "[path-or-stack]"
---

Protect the API contract using the api-contract workflow.

1. Determine scope from `$ARGUMENTS`: a path/stack narrows it; empty → discover apps that expose an
   API and confirm the list.

2. Discover apps: `node "${CLAUDE_PLUGIN_ROOT}/dist/testctl.cjs" run --quiet` and read
   `TESTCTL_JSON`. For each target, read the project's OWN endpoints + expected contracts — Frappe
   `@frappe.whitelist()` methods + REST + the `exc_type`/`_server_messages` error envelope; Next.js
   API route handlers; REST controllers + DTOs.

3. Follow the `api-contract` skill: write NEW contract tests (reusing existing masters) per key
   endpoint — success status + required response fields/types, error envelope on bad input (right
   4xx + the project's error shape, not a 200-with-error or raw 500), auth-required rejection,
   pagination/list shape, and method/Content-Type handling. Assert the contract, not the full
   payload.

4. Run to green. A real contract violation (wrong status, missing field, leaked 500, wrong error
   shape) is reported (skip with a reason) for `/testctl:fix-failures`; never weaken a contract
   assertion. For a deployed Next.js URL, prefer `/testctl:test-all` (the live HTTP smoke).

5. Frappe: only run against a site with `allow_tests` enabled.

6. Do NOT commit. Report the endpoints covered, the contracts asserted, and any violation found.
   Tell the user to review the `git diff` and commit.
