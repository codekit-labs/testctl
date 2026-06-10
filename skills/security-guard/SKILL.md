---
name: security-guard
description: Generate DEFENSIVE security tests for your own app — asserting it resists injection (SQL/command), XSS, broken access control / IDOR, secrets exposure, SSRF, unsafe deserialization, mass assignment, and that it enforces input-size / rate limits (DoS resilience) — by discovering the project's OWN entry points. Across Frappe/ERPNext, Next.js/REST APIs, Electron, Supabase. Use when the user runs /testctl:security-guard, or says "security tests", "test for vulnerabilities", "OWASP tests", "test SQL injection / XSS / auth bypass", "harden against attacks", or wants security regressions caught in CI.
---

# security-guard

Defensive security testing for **your own code**: write tests that feed hostile-but-safe inputs to
the app's own functions/endpoints and assert it **handles them safely** — rejects, sanitizes,
denies, or limits. This catches a vulnerability before it ships and pins it so a refactor can't
reintroduce it. It is strictly defensive — it tests the project's own surface, never attacks anyone
else, and a real hole is **reported as a security finding**, not exploited. Additive. Read
`../generate-tests/stack-conventions.md`; complements `permissions-guard` and `mock-externals`.

## Inputs

`/testctl:security-guard [path-or-stack]`: a path/stack narrows scope; empty → discover apps with an
attack surface (APIs, forms, file/URL handling, raw queries) and confirm the list.

## Steps

1. **Map the attack surface (the project's own).** Find where untrusted input enters: API
   handlers / whitelisted methods, form/DocType inputs, raw `frappe.db.sql`/SQL string-building,
   command/shell calls, HTML rendering of user data, file uploads, server-side fetch of user URLs,
   deserialization (`pickle`/`eval`/`JSON` of untrusted data).

2. **Write tests asserting safe handling** (NEW files; reuse existing masters; never edit app code):
   - **Injection** — feed `'; DROP TABLE`, `${}`/`{{}}`, `; rm -rf`, etc. to the real entry point and
     assert it is parameterized/escaped/rejected — NOT executed. (Especially raw `frappe.db.sql`
     with interpolated input.)
   - **XSS** — user-controlled text rendered to HTML is escaped (`<script>` comes back inert).
   - **Broken access control / IDOR** — a user can't read/modify another party's record by changing
     an id; unauthenticated → denied. (Coordinate with `permissions-guard`.)
   - **Secrets exposure** — no hardcoded credentials/keys/tokens in the code; secrets are not logged
     or returned in API responses/errors.
   - **SSRF** — server-side fetch of a user-supplied URL is restricted (no internal/metadata hosts).
   - **Unsafe deserialization / eval** — `eval`/`pickle`/template-eval is never run on untrusted
     input.
   - **Mass assignment** — an endpoint ignores extra privileged fields a client tries to set.
   - **DoS resilience (defensive)** — expensive endpoints enforce **input-size / pagination caps and
     rate limits**: a huge or deeply-nested payload is rejected fast, not allowed to hang or exhaust
     memory. (This tests YOUR app's own limits — it never floods or attacks any service.)

3. **Run to green.** A test that exposes a real vulnerability (input *is* executed, access *isn't*
   denied, a secret *is* returned, no size limit) is a **security finding** — report it prominently
   (skip with a clear reason) for `fix-failures`. Never weaken a security assertion to force green.

4. **Frappe safety:** only run against a site with `allow_tests` enabled; pair with `mock-externals`
   so nothing reaches a real service.

5. **Leave for review.** Do NOT commit. Report the vulnerability classes covered, the entry points
   tested, and any finding (clearly flagged with severity). Tell the user to review `git diff` and
   commit.

## Rules

- DEFENSIVE only — tests assert the *project's own* code resists attacks; never build tooling to
  attack third parties, never include real DoS/flooding, never exfiltrate.
- Use hostile-but-safe payloads against the app's real entry points; assert safe handling.
- A real vulnerability is a SECURITY FINDING — reported (and handed to `fix-failures`), never
  exploited or hidden by weakening the test.
- Reuse existing masters; pair with `mock-externals`. Verify green for the right reason. Never
  auto-commit.
