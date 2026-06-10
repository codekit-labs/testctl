---
description: Generate tests protecting access control (deny unauthorized, enforce roles, isolate records) from the project's own auth model — any stack
argument-hint: "[path-or-stack]"
---

Guard access control using the permissions-guard workflow.

1. Determine scope from `$ARGUMENTS`: a path/stack narrows it; empty → discover apps with an
   auth/permission layer and confirm the list.

2. Discover apps: `node "${CLAUDE_PLUGIN_ROOT}/dist/testctl.cjs" run --quiet` and read
   `TESTCTL_JSON`. For each target, read the project's OWN permission model — Frappe DocType/Role
   permissions + `frappe.session.user` + `has_permission`/`if_owner`; Next.js/API auth middleware
   and route guards; Supabase RLS policies. Never hardcode a role list.

3. Follow the `permissions-guard` skill: write NEW boundary tests (reusing existing users/roles) —
   unauthenticated → denied (assert the specific denial), role boundaries (allowed vs disallowed
   actions), record-level isolation (user A can't touch user B's records), no privilege escalation.

4. Run to green. A real access hole (something that should be denied isn't) is a SECURITY finding —
   report it loudly for `/testctl:fix-failures`; never weaken a permission assertion to force green.

5. Frappe: only run against a site with `allow_tests` enabled; use `frappe.set_user(...)` to assert
   as different roles and reset after.

6. Do NOT commit. Report the boundaries/roles covered and any access hole found. Tell the user to
   review the `git diff` and commit.
