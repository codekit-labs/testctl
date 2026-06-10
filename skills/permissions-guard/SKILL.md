---
name: permissions-guard
description: Generate tests that protect access control — unauthorized users are denied, role boundaries hold, and users can't read/modify records they shouldn't — by discovering the project's OWN auth/permission model. Works for any stack (Frappe DocType permissions, Next.js/API auth guards, Supabase RLS, Electron). Use when the user runs /testctl:permissions-guard, or says "test permissions", "guard access control", "make sure roles are enforced", "test auth/authorization", "check RLS", or wants security boundaries protected from regressions.
---

# permissions-guard

A permission bug is a data breach waiting to happen — and it's invisible in a green suite that only
tests the happy, logged-in admin. This skill writes tests that assert the **access boundaries** hold,
derived from the project's *own* auth/permission model — never hardcoded — so it's universal.
Additive; leaves changes for review. Read `../generate-tests/stack-conventions.md` and the
`data-factory` master-reuse rule.

## Inputs

`/testctl:permissions-guard [path-or-stack]`: a path/stack narrows scope; empty → discover apps with
an auth/permission layer and confirm the list.

## Steps

1. **Discover the permission model — don't hardcode roles.** Read how the project decides who can do
   what:
   - **Frappe/ERPNext:** DocType permissions + Role Permissions, `frappe.session.user`,
     `has_permission`/`frappe.has_permission`, `if_owner`, custom `permission_query_conditions` and
     server-script permission checks.
   - **Next.js / REST API:** auth middleware, route guards, session/JWT checks, role gates.
   - **Supabase:** Row-Level Security policies (per table, per operation).
   - **Generic:** the authorization layer and its roles/scopes.

2. **Write boundary tests** (NEW files; reuse existing users/roles, never create heavy masters):
   - **Unauthenticated → denied** — an anonymous/guest request to a protected resource is rejected
     (not silently allowed); assert the *specific* denial (403 / `PermissionError` / empty RLS set).
   - **Role boundaries** — a low-privilege role CAN do its allowed actions and CANNOT do the
     disallowed ones (create/read/update/delete as the config dictates).
   - **Record-level isolation** — user A cannot read or modify user B's owner-scoped records
     (the classic IDOR / cross-tenant leak).
   - **No privilege escalation** — a user can't grant themselves a role or bypass via a side route.

3. **Run to green.** If a test exposes a real hole (something that *should* be denied isn't), do NOT
   patch app code here — report it prominently (it's a security finding) for `fix-failures`. Never
   weaken a permission assertion to make the suite pass.

4. **Frappe safety:** only run against a site with `allow_tests` enabled; use `frappe.set_user(...)`
   to assert as different roles, and reset after.

5. **Leave for review.** Do NOT commit. Report the boundaries covered, the roles tested, and any
   access hole surfaced (clearly flagged). Tell the user to review `git diff` and commit.

## Rules

- Test the *negative* path — "this is correctly denied" — not just that admin can do everything.
- Derive roles/policies from the project's config; never hardcode a role list.
- A real access hole is a security finding — reported loudly, never patched-around or weakened away.
- Reuse existing users/roles; never create heavyweight masters. Verify green for the right reason.
- Never auto-commit.
