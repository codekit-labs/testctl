---
name: api-contract
description: Generate contract tests for an app's HTTP/REST API — correct status codes, response shape/required fields, the error envelope on bad input, auth-required rejection, and pagination — by discovering the project's OWN endpoints. Works for Frappe whitelisted methods, Next.js API routes, and REST controllers. Use when the user runs /testctl:api-contract, or says "test the API", "API contract tests", "test the endpoints", "validate response shape", or wants the API surface protected from breaking changes.
---

# api-contract

An API is a promise to its callers; a silent shape or status change breaks every client. This skill
writes **contract tests** that pin what each endpoint returns — derived from the project's *own*
routes — so a refactor can't quietly change the contract. Additive; leaves changes for review. Read
`../generate-tests/stack-conventions.md` and the `data-factory` master-reuse rule. (Next.js gets a
live HTTP smoke via `testctl run`; this skill adds deeper per-endpoint contract tests in the app's
own framework.)

## Inputs

`/testctl:api-contract [path-or-stack]`: a path/stack narrows scope; empty → discover apps that
expose an API and confirm the list.

## Steps

1. **Discover the API surface.** Read the project's own endpoints and their expected contracts:
   - **Frappe/ERPNext:** `@frappe.whitelist()` methods and REST resource endpoints; the standard
     response/error envelope (`message`, and on error `exc_type` / `exception` / `_server_messages`).
   - **Next.js:** API route handlers (`app/api/**/route.ts` or `pages/api/**`), their methods and
     response JSON.
   - **REST controllers:** the route table, request/response DTOs, status codes.

2. **Write contract tests** (NEW files; reuse existing masters) for each key endpoint:
   - **Success** — the happy request returns the right status (200/201) and a body with the
     required fields and types (assert the shape, not the full payload).
   - **Error envelope** — a bad/invalid request returns the right 4xx and the project's standard
     error shape (Frappe `exc_type`/`_server_messages`; or the documented error body), not a 200
     with a hidden error or a raw 500 stack.
   - **Auth required** — a protected endpoint rejects an unauthenticated/unauthorized caller (ties
     in with `permissions-guard`).
   - **Pagination / list shape** — list endpoints return the agreed envelope (items + count/cursor)
     and respect limit/offset.
   - **Method/Content-Type** — wrong method → 405; JSON endpoints declare/accept `application/json`.

3. **Run to green.** A real contract violation (wrong status, missing field, leaked 500, wrong error
   shape) is REPORTED (skip with a clear reason) for `fix-failures` — never weaken a contract
   assertion to force green.

4. **Frappe safety:** only run against a site with `allow_tests` enabled; for live HTTP checks of a
   deployed Next.js URL, prefer `testctl run` (the Next.js smoke runner).

5. **Leave for review.** Do NOT commit. Report the endpoints covered, the contracts asserted, and any
   violation surfaced. Tell the user to review `git diff` and commit.

## Rules

- Assert the contract (status + shape + error envelope), not the entire payload — robust to additive
  changes, strict on breaking ones.
- Derive endpoints and the error envelope from the project; don't assume a generic shape.
- A real contract violation is reported, not patched here and never hidden by weakening the assertion.
- Reuse existing masters; never create heavyweight records. Verify green for the right reason. Never
  auto-commit.
