---
description: Generate DEFENSIVE security tests for your own app — injection, XSS, access control, secrets, SSRF, deserialization, mass assignment, DoS-resilience — from its own entry points
argument-hint: "[path-or-stack]"
---

Guard against vulnerabilities using the security-guard workflow (defensive — tests YOUR own app).

1. Determine scope from `$ARGUMENTS`: a path/stack narrows it; empty → discover apps with an attack
   surface (APIs, forms, raw queries, file/URL handling) and confirm the list.

2. Discover apps: `node "${CLAUDE_PLUGIN_ROOT}/dist/testctl.cjs" run --quiet` and read
   `TESTCTL_JSON`. Follow the `security-guard` skill: map where untrusted input enters the project's
   OWN code (API handlers / whitelisted methods, raw `frappe.db.sql`, command calls, HTML rendering,
   uploads, server-side fetch, deserialization).

3. Write NEW tests (reuse masters, never edit app code) that feed hostile-but-safe inputs to the
   real entry points and assert SAFE handling: injection parameterized/rejected, XSS escaped, access
   control / IDOR denied, no secrets in code/logs/responses, SSRF blocked, no eval/pickle on
   untrusted input, mass-assignment ignored, and input-size/pagination/rate limits enforced
   (DoS resilience — testing your own limits, never flooding anything).

4. Run to green. A real vulnerability is a SECURITY FINDING — report it (skip with a reason) for
   `/testctl:fix-failures`; never weaken a security assertion. Pair with `/testctl:mock-externals` so
   tests reach no real service.

5. Frappe: only run against a site with `allow_tests` enabled.

6. Do NOT commit. Report the vulnerability classes covered, entry points tested, and any finding
   (with severity). Tell the user to review the `git diff` and commit.
