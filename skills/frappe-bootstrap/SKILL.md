---
name: frappe-bootstrap
description: Fix a Frappe test run that aborts before any test executes because a mandatory field on an auto-created test master (_Test Company, _Test Customer, …) has no value. Generates an idempotent, test-only before_tests hook in the app — seeding a sane value where one exists, relaxing in-test only as a fallback — then verifies the bootstrap clears. Frappe/ERPNext only; leaves changes uncommitted for review. Use when the user runs /testctl:frappe-bootstrap, or sees a Frappe "MandatoryError: [Doctype, _Test ...]" / "test bootstrap failed" during tests, or says "tests won't bootstrap", "_Test Company mandatory field", "fix before_tests", or "make Frappe tests run".
---

# frappe-bootstrap

Frappe's test runner creates shared test masters (e.g. `_Test Company`) during bootstrap. If the app
marks a field `reqd=1` (common with custom fields on restored production data) and the fixture gives
no value, the whole run dies before any test executes:

```
frappe.exceptions.MandatoryError: [Company, _Test Company]: default_warehouse_for_sales_return
```

This skill writes a durable, **test-only** `before_tests` hook that supplies the missing values, so
future runs boot cleanly. It is the remediation half of testctl's `classifyFrappeFailure()` diagnosis.

## Rules
- **Frappe/ERPNext only.** If this is not a Frappe app, say so and stop — write nothing.
- **Prod-safe.** The generated hook runs only under `frappe.flags.in_test`. Never mutate the live
  site directly from this skill; the deliverable is reviewable app code.
- **Seed, don't globally relax, when possible.** Prefer setting the field to an existing sane value
  (e.g. an existing Warehouse). Only when no sensible value exists, relax `reqd` *inside* the
  in-test-guarded hook, and call that out in your summary so the user can choose a real value later.
- **Idempotent + additive.** The hook checks state and only acts when a value is missing. If the app
  already has a `before_tests` hook, EXTEND it (call the new function from the existing one) — never
  overwrite.
- **Leave changes uncommitted** for the user to review.

## Workflow
1. **Confirm Frappe + locate the app.** Read `testctl.yaml` for `stacks.frappe` (`benchPath`, `site`,
   `apps`). If absent, ask for them or run `/testctl:init`. Pick the app to fix (the one whose tests
   are blocked).
2. **Discover the blocking fields.**
   - Take the `Doctype: field` from the latest testctl run / the classifier message if present.
   - Then scan for more: in the bench, read mandatory Custom Fields on the common auto-created test
     masters so you fix the whole class in one pass, e.g.:
     ```
     bench --site <site> console <<'PY'
     import frappe, json
     masters = ["Company","Customer","Supplier","Item","Warehouse","Account","Cost Center"]
     out = {}
     for dt in masters:
         fields = frappe.get_all("Custom Field",
             filters={"dt": dt, "reqd": 1}, pluck="fieldname")
         if fields: out[dt] = fields
     print(json.dumps(out))
     PY
     ```
   - Show the user the discovered `doctype → [fields]` list before writing anything.
3. **Generate the hook.**
   - Create or extend `<app>/<app>/tests/__init__.py` (or the app's existing test-bootstrap module)
     with an idempotent `before_tests()` that, for each blocking field, seeds an existing value, or
     relaxes in-test as the fallback. Example shape (adapt field/doctype to the real findings):
     ```python
     import frappe

     def before_tests():
         """testctl: ensure mandatory fields on auto-created test masters have values (test-only)."""
         if not frappe.flags.in_test:
             return
         _seed_company_defaults()

     def _seed_company_defaults():
         name = "_Test Company"
         if not frappe.db.exists("Company", name):
             return
         company = frappe.get_doc("Company", name)
         if not company.get("default_warehouse_for_sales_return"):
             wh = frappe.db.get_value("Warehouse", {"company": name, "is_group": 0})
             if wh:
                 company.default_warehouse_for_sales_return = wh
                 company.save(ignore_permissions=True)
     ```
   - Wire it in `hooks.py`: `before_tests = "<app>.tests.before_tests"`. If a `before_tests` already
     exists, append to the list / call the new function from the existing entrypoint — do not clobber.
4. **Verify.** Re-run the Frappe stack:
   `node "${CLAUDE_PLUGIN_ROOT}/dist/testctl.cjs" run frappe --quiet` (or `bench --site <site>
   run-tests --app <app>`). Confirm the `MandatoryError` is gone and the bootstrap proceeds to real
   tests. If a new mandatory field surfaces, extend the hook and re-run until bootstrap clears.
5. **Hand off.** Summarise the diff, the exact `doctype:field`s handled, and any field that used the
   relax fallback. Leave everything uncommitted. If the app now has few real tests, suggest
   `/testctl:generate-tests`.

## What this is NOT
- Not a per-run auto-heal — it does not mutate the live site each run.
- Not for non-Frappe stacks.
- Not for dev-deps / encryption-key / missing-site blockers — those are separate (the classifier
  names each with its own remedy).
