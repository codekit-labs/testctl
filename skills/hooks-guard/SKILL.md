---
name: hooks-guard
description: Generate tests that PROVE a Frappe/ERPNext app's hooks.py wiring actually fires — that each declared doc_event handler runs, each permission_query_conditions / has_permission filter actually restricts (the forbidden row is absent, not just permitted rows present), each scheduler_events job path resolves to a real callable, and each override_whitelisted_methods / override_doctype_class is in effect. hooks.py wires behavior by magic string paths, so a renamed or mistyped handler breaks the feature in production with NO error — this catches that. Frappe/ERPNext only. Reads the app's OWN hooks.py, asserts the observable effect (anti-vacuous-green), reports real wiring bugs without rewriting hooks.py. Use when the user runs /testctl:hooks-guard, or says "test my hooks", "hooks.py", "doc_events not firing", "permission_query_conditions", "scheduler hook test", "test doc events", "is my override wired", or "Frappe hooks test".
---

# hooks-guard

A Frappe/ERPNext app wires its behavior through `hooks.py` by **magic string paths** — `doc_events`,
`permission_query_conditions`, `has_permission`, `scheduler_events`, `override_whitelisted_methods`,
`override_doctype_class`. The value is a **string**, not a symbol. Rename a handler, mistype a module
path, or delete a function, and **Frappe raises no error at boot** — the hook just never fires, and the
feature silently stops working *in production*. The unit suite stays green because it calls the function
directly and never exercises the wiring. The worst case is security: a broken
`permission_query_conditions` does not raise — it degrades to **no filter**, so `frappe.get_list` returns
**every** row to a limited user. That is a real data leak.

This skill pins hooks.py wiring as a **proven invariant**: it reads the app's OWN `hooks.py`, and for
each declared hook writes a test that proves the wiring **takes effect** — triggering the real event and
asserting the handler's observable effect, seeding a permitted + a forbidden row and asserting the
forbidden one is **absent**, resolving each scheduler/override path to a real callable. It **reports**
(with the hook + handler path) any wiring that doesn't fire or doesn't restrict, and never rewrites
`hooks.py` or app code. Frappe/ERPNext only. Additive; leaves changes for review. Read
`../generate-tests/stack-conventions.md` for the Frappe `FrappeTestCase` pattern and the `data-factory`
master-reuse rule; reuse `../mock-externals` when a triggered handler or job calls out.

This is distinct from **`permissions-guard`** (which asserts the access *policy* generically across any
stack): `hooks-guard` is Frappe-specific and proves the **hooks.py wiring** that delivers that policy
actually fires — in particular that the `permission_query_conditions` string is wired and restricting.

## Inputs

`/testctl:hooks-guard [path-or-stack]`: a path/stack narrows scope to one Frappe app; empty → discover
the configured Frappe app(s) that declare hooks and confirm the list first. Frappe/ERPNext only — if the
project has no Frappe app, say so and stop.

## Steps

1. **Discover the hooks — read, don't guess.** For each target Frappe app, read its `hooks.py` and
   enumerate the declared entries in the four families below. Confirm at runtime via
   `frappe.get_hooks("doc_events")` / `frappe.get_hooks("permission_query_conditions")` / etc. so you
   test the **app's own** wiring, never a hardcoded list. Use
   `node "<skill-base>/../../dist/testctl.cjs" run --changed --quiet` (read `TESTCTL_JSON`) to scope to
   edited apps. Confirm the target hook list before writing tests.

2. **`doc_events` — prove the handler actually RUNS.** Covers `validate` / `before_validate` /
   `before_save` / `before_insert` / `after_insert` / `on_update` / `on_submit` / `on_cancel` /
   `on_trash` / `on_update_after_submit`, **including the `"*"` wildcard**. In a `FrappeTestCase`,
   reusing existing masters (never heavy creates — see `data-factory`):
   - **Trigger the real event** on a lightweight doc of the wired doctype (save / submit / cancel) and
     assert the handler's **observable effect** — a field it sets, a value it computes, or an exception
     it raises on invalid input. For the `"*"` wildcard, trigger the event on one doctype and assert its
     cross-cutting effect (e.g. an audit row, a flag). **Event applicability:** trigger the event that
     matches the wired method — `on_submit` / `on_cancel` / `on_update_after_submit` require a
     SUBMITTABLE doctype (`is_submittable`); pick a doc whose lifecycle actually reaches the wired event,
     or the handler silently never runs / errors.
   - **Anti-vacuous-green:** it is NOT enough that `frappe.get_hooks("doc_events")` contains the string —
     a string can be present but point at a renamed function. **Prefer triggering the event and asserting
     the effect.** If a test can only check registration (the effect is not cleanly observable), it must
     ALSO assert the path **resolves to an importable callable** (`frappe.get_attr(path)` / import) so a
     dangling string is caught. A bare "the dict contains this string" assertion is forbidden.
   - **Silent failure caught:** a renamed/mistyped handler stops firing with no error → the expected
     effect is absent → the test fails.

3. **`permission_query_conditions` / `has_permission` — prove the filter actually RESTRICTS** (the
   headline). In a `FrappeTestCase`, reusing existing masters:
   - **Seed BOTH a permitted and a forbidden record** for the wired doctype.
   - As a **limited-role user** (`frappe.set_user(...)`), call `frappe.get_list(doctype)` (which applies
     `permission_query_conditions`) and assert the **forbidden row is ABSENT** from the result — and that
     the permitted row is present. The restricted user must be a **genuinely restricted user**: a
     non-Administrator, non-System-Manager user whose role grants read on the doctype but relies on the
     `permission_query_condition` to scope rows. Administrator and System Manager **bypass
     `permission_query_conditions` entirely** — a test run as either is **vacuously green and proves
     nothing**. Restore the user (`frappe.set_user("Administrator")`) in teardown. For `has_permission`,
     assert `frappe.has_permission(doc=forbidden, user=...)` is **False** and **True** for the permitted
     doc.
   - **Administrator-sees-both cross-check (mandatory):** also assert that the SAME `get_list`/`get_all`
     query run **as Administrator** returns **BOTH** the permitted AND the forbidden row. This proves the
     forbidden row actually exists in the database and is hidden by the filter — not by a role bypass or
     by the row simply not existing. The test is only meaningful when: Administrator sees both rows, the
     restricted user sees only the permitted one.
   - **Anti-vacuous-green (mandatory):** asserting only that permitted rows appear is **vacuous** — an
     all-rows leak still shows the permitted rows, so a permitted-only check passes on a fully broken
     filter. The **forbidden-row-absent** assertion is the load-bearing check and must be present.
   - **Silent failure caught:** a broken `permission_query_condition` (renamed function, swallowed
     exception, empty string) silently returns ALL rows → the forbidden row appears → the test fails.
     This is the real data leak no other skill catches.

4. **`scheduler_events` — prove each job path RESOLVES.** Covers `all` / `daily` / `hourly` / `weekly`
   / `monthly` / `cron`. For each declared job string, resolve the **exact string taken from the hook**
   (via `frappe.get_hooks("scheduler_events")`, not a hand-retyped path) and assert it **resolves to a
   real importable callable** (`frappe.get_attr(path)` / import succeeds and the result is callable).
   Optionally, only if the job is safe and side-effect-free (or its externals are stubbed via
   `mock-externals`), invoke it in a controlled way inside a `FrappeTestCase` and assert it does not
   raise. **Never trigger the live scheduler** (`bench scheduler` / enqueue). A mistyped scheduler path =
   a job that never runs and is never noticed → the resolve assertion fails.

5. **`override_whitelisted_methods` / `override_doctype_class` — prove the override is IN EFFECT.**
   Assert the override is registered (`frappe.get_hooks(...)` lists the mapping) **and** that it actually
   resolves — `frappe.get_doc(doctype)` returns the override class for `override_doctype_class`; the
   override path is importable and callable for `override_whitelisted_methods`; where safe, assert the
   overriding behavior's observable difference. A dangling override path (renamed class/method) silently
   does not take effect → the resolve/effect assertion fails. Registration alone is insufficient (a
   present-but-dangling string is the exact bug).

6. **Run to green.** A real wiring bug (a doc_event that doesn't fire, a permission filter that doesn't
   restrict, a dangling scheduler/override path) is **reported** (skip the assertion with a clear reason,
   naming the hook + handler path) for `/testctl:fix-failures` — never rewrite `hooks.py` or app code,
   never weaken an assertion to force green. If a handler's effect is genuinely not observable in a test
   environment, REPORT that the family is registration-checked-only (with the resolve assertion) rather
   than fabricating a false-green effect assertion.

7. **Frappe safety:** only run against a site with `allow_tests` enabled. If a triggered handler or
   scheduled job calls out (email / PDF / HTTP), stub it via `mock-externals` so the wiring test is
   deterministic.

8. **Leave for review.** Do NOT commit. Report the hooks covered (per family), which were proven by
   effect vs registration-checked-only, and every wiring bug surfaced (with the hook + handler path).
   Tell the user to review `git diff` and commit.

## Rules

- **Frappe/ERPNext only.** No other stack has this hooks.py wiring surface. If no Frappe app is
  configured, say so and stop.
- **Discover, don't hardcode.** Read the app's OWN `hooks.py` and confirm via `frappe.get_hooks(...)`;
  never hardcode hook names or handler paths.
- **Assert the EFFECT, not the string.** For `doc_events`, trigger the real event and assert the
  observable effect; if only registration is checkable, ALSO assert the path resolves to an importable
  callable. A bare "the hooks dict contains this string" assertion is forbidden — it passes on a renamed
  handler.
- **Permission filters: restricted user + forbidden row ABSENT + Administrator-sees-both (mandatory).**
  Seed BOTH a permitted and a forbidden row. Run the restricted query as a **genuinely restricted user**:
  a non-Administrator, non-System-Manager user whose role grants read on the doctype but relies on the
  `permission_query_condition` to scope rows (`frappe.set_user(...)`; restore in teardown).
  Administrator and System Manager **bypass `permission_query_conditions` entirely** — a test run as
  either is vacuously green and proves nothing. Also assert that the SAME `get_list`/`get_all` query run
  **as Administrator** returns **BOTH** the permitted AND the forbidden row — this proves the forbidden
  row exists and is hidden by the filter, not by a role bypass or by the row simply not existing.
- **Scheduler / override paths must RESOLVE to a callable using the exact configured string.** Resolve
  the exact path taken from `frappe.get_hooks(...)`, not a hand-retyped copy. Registration is necessary
  but not sufficient — a present-but-dangling string is the exact bug; resolve the path (and optionally
  invoke when safe).
- Reuse existing masters; never create heavyweight records that trigger framework setup cascades.
  Stub outbound calls (email/PDF/HTTP) via `mock-externals` when a handler or job calls out.
- Additive only — new test files; never modify `hooks.py` or other app code. A real wiring bug is
  reported (with the hook + handler path) and handed to `fix-failures`, never rewritten or
  weakened-around here.
- Frappe/ERPNext only; run only against an `allow_tests` site; never commit to the user's repos.
