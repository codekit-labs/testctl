---
description: Generate tests that prove a Frappe/ERPNext app's hooks.py wiring fires — doc_events run, permission_query_conditions restricts (forbidden row absent), scheduler/override paths resolve — by reading the app's own hooks.py
argument-hint: "[path-or-stack]"
---

Prove Frappe/ERPNext hooks.py wiring using the hooks-guard workflow.

1. Determine scope from `$ARGUMENTS`: a path/stack narrows it to one Frappe app; empty → discover the
   configured Frappe app(s) that declare hooks and confirm the list. Frappe/ERPNext ONLY — if there is
   no Frappe app, say so and stop.

2. Discover the hooks — read each target app's `hooks.py` and confirm at runtime via
   `frappe.get_hooks("doc_events")` / `frappe.get_hooks("permission_query_conditions")` / etc. Never
   hardcode hook names or handler paths. Use `node "${CLAUDE_PLUGIN_ROOT}/dist/testctl.cjs" run
   --changed --quiet` (read `TESTCTL_JSON`) to scope to edited apps.

3. Follow the `hooks-guard` skill. For each declared hook write NEW tests in a `FrappeTestCase`
   (reuse existing masters, never heavy creates):
   - **doc_events:** trigger the real event (save/submit/cancel) on a lightweight doc of the wired
     doctype (including the `"*"` wildcard) and assert the handler's observable effect (a field set, a
     value computed, an exception on invalid input). It is NOT enough that the hooks dict contains the
     string — a renamed handler still shows a string; if only registration is checkable, ALSO assert the
     path resolves to an importable callable (`frappe.get_attr`).
   - **permission_query_conditions / has_permission:** seed BOTH a permitted and a forbidden record; as a
     limited-role user (`frappe.set_user`), assert `frappe.get_list(doctype)` does NOT contain the
     forbidden row (and does contain the permitted one). A permitted-only assertion is vacuous — an
     all-rows leak still shows the permitted rows. The forbidden-row-absent assertion is mandatory.
   - **scheduler_events:** assert each declared job path resolves to a real importable callable; invoke
     only when safe / externals mocked. Never trigger the live scheduler.
   - **override_whitelisted_methods / override_doctype_class:** assert the override is registered AND
     resolves (the overriding class/method is the one Frappe returns).

4. Run to green. A real wiring bug (a doc_event that doesn't fire, a permission filter that doesn't
   restrict, a dangling scheduler/override path) → report it (skip with a reason, naming the hook +
   handler path) for `/testctl:fix-failures`; never rewrite `hooks.py` or app code, never weaken an
   assertion to force green. Stub outbound calls (email/PDF/HTTP) via `mock-externals` when a handler or
   job calls out.

5. Frappe: only run against a site with `allow_tests` enabled.

6. Do NOT commit. Report the hooks covered (per family), which were proven by effect vs
   registration-checked-only, and any wiring bug surfaced. Tell the user to review the `git diff` and
   commit.
