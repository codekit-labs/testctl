---
name: frappe-bootstrap
description: Fix a Frappe test run that aborts before any test executes because Frappe can't build its auto-created test masters (_Test Company, _Test Holiday List, …) — either a mandatory field has no value (MandatoryError) or a required linked master doesn't exist (LinkValidationError: Could not find …: _Test …). Generates an idempotent, test-only before_tests hook that seeds the missing fields AND creates the missing masters, iterating until the bootstrap clears. Frappe/ERPNext only; leaves changes uncommitted for review. Use when the user runs /testctl:frappe-bootstrap, or sees a Frappe "MandatoryError: [Doctype, _Test ...]", "LinkValidationError: Could not find ...: _Test ...", or "test bootstrap failed" during tests, or says "tests won't bootstrap", "_Test Company mandatory field", "missing test master", "_Test Holiday List", "fix before_tests", or "make Frappe tests run".
---

# frappe-bootstrap

Frappe's test runner creates shared test masters (e.g. `_Test Company`, `_Test Holiday List`) during
bootstrap. If the app needs something those fixtures don't supply, the whole run dies before any test
executes. Two shapes of this blocker:

```
# missing mandatory FIELD on a master
frappe.exceptions.MandatoryError: [Company, _Test Company]: default_warehouse_for_sales_return

# missing required MASTER record
frappe.exceptions.LinkValidationError: Could not find Default Holiday List: _Test Holiday List
```

This skill writes a durable, **test-only** `before_tests` hook that supplies the missing values AND
creates the missing masters, so future runs boot cleanly. It is the remediation half of testctl's
`classifyFrappeFailure()` diagnosis.

## Rules
- **Frappe/ERPNext only.** If this is not a Frappe app, say so and stop — write nothing.
- **Prod-safe.** The generated hook runs only under `frappe.flags.in_test`. Never mutate the live
  site directly from this skill; the deliverable is reviewable app code.
- **Minimal + least-invasive.** For a missing FIELD, seed an existing sane value (relax `reqd`
  in-test only as a fallback). For a missing MASTER, create the *minimal* valid record. Call out any
  fallback (a relaxed field, or a master created with placeholder rows) in your summary.
- **Idempotent + additive.** The hook checks state and only acts when something is missing. If the app
  already has a `before_tests` hook, EXTEND it (call the new function from the existing one) — never
  overwrite.
- **Leave changes uncommitted** for the user to review.

## Workflow
1. **Confirm Frappe + locate the app.** Read `testctl.yaml` for `stacks.frappe` (`benchPath`, `site`,
   `apps`). If absent, ask for them or run `/testctl:init`. Pick the app to fix (the one whose tests
   are blocked).
2. **Discover the blockers.** Identify BOTH shapes:
   - From the latest testctl run / classifier message, note any `MandatoryError: [Doctype, _Test …]:
     <field>` (missing field) and any `LinkValidationError: Could not find <Doctype>: _Test <Name>`
     (missing master).
   - Scan the bench for more mandatory Custom Fields on common auto-created test masters so you fix
     the whole class in one pass, e.g.:
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
   - Show the user the discovered missing `doctype → [fields]` and missing `master` records before
     writing anything.
3. **Generate the hook.** Create or extend `<app>/<app>/tests/__init__.py` (or the app's existing
   test-bootstrap module) with an idempotent `before_tests()` that handles both shapes. Adapt the
   doctype/field/master to the real findings:
   ```python
   import frappe

   def before_tests():
       """testctl: make Frappe's test-master bootstrap succeed (test-only)."""
       if not frappe.flags.in_test:
           return
       _ensure_masters()
       _seed_company_defaults()

   def _ensure_masters():
       # Create minimal required masters Frappe's fixtures reference but don't create.
       if not frappe.db.exists("Holiday List", "_Test Holiday List"):
           frappe.get_doc({
               "doctype": "Holiday List",
               "holiday_list_name": "_Test Holiday List",
               "from_date": "2020-01-01",
               "to_date": "2099-12-31",
           }).insert(ignore_permissions=True, ignore_if_duplicate=True)

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
   Wire it in `hooks.py`: `before_tests = "<app>.tests.before_tests"`. If a `before_tests` already
   exists, append to the list / call the new function from the existing entrypoint — do not clobber.
4. **Verify — iterate until clear.** Re-run the Frappe stack:
   `node "${CLAUDE_PLUGIN_ROOT}/dist/testctl.cjs" run frappe --quiet` (or `bench --site <site>
   run-tests --app <app>`). If a *new* bootstrap blocker surfaces — another missing field OR another
   missing master — extend the hook and re-run. Repeat until the bootstrap proceeds to real tests, so
   one invocation drains the whole chain.
5. **Hand off.** Summarise the diff, the exact fields and masters handled, and any fallback used (a
   relaxed field, or a master created with placeholder rows). Leave everything uncommitted. If the app
   now has few real tests, suggest `/testctl:generate-tests`.

## What this is NOT
- Not a per-run auto-heal — it does not mutate the live site each run.
- Not for non-Frappe stacks.
- Not for dev-deps / encryption-key / missing-site blockers — those are separate (the classifier
  names each with its own remedy).
