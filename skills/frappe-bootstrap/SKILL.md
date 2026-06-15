---
name: frappe-bootstrap
description: Fix a Frappe test run that aborts before any test executes because Frappe can't build its auto-created test masters. Handles all three shapes in one pass — a missing mandatory FIELD value (MandatoryError), a missing required MASTER record (LinkValidationError: Could not find …: _Test …), and a standard field PROMOTED to mandatory by a Property Setter. Front-loads the known ERPNext _Test masters and flips Property-Setter-promoted reqd fields, then iterates only for stragglers. Generates an idempotent, test-only before_tests hook. Frappe/ERPNext only; leaves changes uncommitted for review. Use when the user runs /testctl:frappe-bootstrap, or sees a Frappe "MandatoryError: [Doctype, _Test ...]", "LinkValidationError: Could not find ...: _Test ...", or "test bootstrap failed" during tests, or says "tests won't bootstrap", "_Test Company mandatory field", "missing test master", "_Test Holiday List", "fix before_tests", or "make Frappe tests run".
---

# frappe-bootstrap

Frappe's test runner auto-creates shared test masters (`_Test Company`, `_Test Holiday List`, …) and
loads ERPNext's `test_records` before any test module runs. On a customised / restored-prod bench this
aborts the whole run before your code is exercised. Blockers come in **three shapes**:

```
# 1. missing mandatory FIELD value on a master
frappe.exceptions.MandatoryError: [Company, _Test Company]: default_warehouse_for_sales_return

# 2. missing required MASTER record (referenced by ERPNext test_records)
frappe.exceptions.LinkValidationError: Could not find Default Holiday List: _Test Holiday List

# 3. a STANDARD field promoted to mandatory by a Property Setter (reqd=0 on the field itself)
#    -> editing the Custom Field / DocField does nothing; you must flip the Property Setter
```

This skill writes a durable, **test-only** `before_tests` hook that **front-loads** the known masters
and **relaxes** the promoted mandatory fields in one pass, so a bench clears in ~2 iterations instead
of discovering blockers one-at-a-time. It is the remediation half of testctl's `classifyFrappeFailure()`
diagnosis.

## Rules
- **Frappe/ERPNext only.** If this is not a Frappe app, say so and stop — write nothing.
- **Prod-safe.** The generated hook runs only under `frappe.flags.in_test`. Never mutate the live site
  from this skill outside that guard; the deliverable is reviewable app code.
- **Mandatory ≠ Custom Field.** A standard field is usually made `reqd` by a **Property Setter**
  (`tabProperty Setter`, `property='reqd'`, `value='1'`) — the field's own `reqd` is still 0. Check the
  Property Setter FIRST and flip *it* to `'0'` for tests; only set `reqd=0` on a genuine Custom Field.
- **Relax > pre-create for company-level fields.** `before_tests` writes can be rolled back before
  Frappe auto-creates its masters, so pre-creating `_Test Company` may not stick — relax its mandatory
  fields (Property Setter flip, which persists) instead.
- **Idempotent + additive.** Every seed is gated on `frappe.db.exists`; every relax is safe to repeat.
  If the app already has a `before_tests` hook, EXTEND it (call the new function) — never overwrite.
- **Leave changes uncommitted** for the user to review.

## Workflow
1. **Confirm Frappe + locate the app.** Read `testctl.yaml` `stacks.frappe` (`benchPath`, `site`,
   `apps`). If absent, ask or run `/testctl:init`. Pick the blocked app.
2. **Discover everything in ONE upfront sweep** (don't iterate to find these):
   - the latest testctl classifier error (the currently-named blocker), AND
   - mandatory **Custom Fields**:
     `bench --site <site> mariadb -e "SELECT dt, fieldname FROM \`tabCustom Field\` WHERE reqd=1 AND dt IN ('Company','Customer','Supplier','Item','Warehouse','Account','Cost Center','Payment Term','Lead','Tax Category','Fiscal Year','Holiday List','Department','Employee');"`, AND
   - **Property-Setter-promoted** mandatory fields:
     `bench --site <site> mariadb -e "SELECT doc_type, field_name FROM \`tabProperty Setter\` WHERE property='reqd' AND value='1' AND doc_type IN ('Company','Customer','Supplier','Item','Warehouse','Account','Cost Center','Payment Term','Lead','Tax Category','Fiscal Year','Holiday List','Department','Employee');"`, AND
   - the **known-master catalog** below (these are referenced by ERPNext `test_records` and are NOT
     discoverable by scanning — pre-create them anyway).
   - Show the combined list (masters to create + fields to relax) before writing.
3. **Generate the hook** — `<app>/<app>/tests/bootstrap.py`, wired in `hooks.py` as
   `before_tests = "<app>.tests.bootstrap.before_tests"` (extend an existing hook, don't clobber).
   `frappe.flags.in_test`-guarded, idempotent. Adapt names to the real findings:
   ```python
   import frappe

   def before_tests():
       """testctl: make Frappe's test-master bootstrap succeed (test-only)."""
       if not frappe.flags.in_test:
           return
       _relax_mandatory()   # do this FIRST so master auto-create doesn't trip on reqd
       _ensure_masters()

   # Standard ERPNext _Test masters referenced by test_records but absent on a fresh/restored
   # site — pre-create the known set in one pass (a scan can't find these).
   def _ensure_masters():
       if not frappe.db.exists("Holiday List", "_Test Holiday List"):
           frappe.get_doc({
               "doctype": "Holiday List", "holiday_list_name": "_Test Holiday List",
               "from_date": "2020-01-01", "to_date": "2050-12-31", "weekly_off": "Sunday",
           }).insert(ignore_permissions=True, ignore_mandatory=True)
       for tc in ("_Test Tax Category 1", "_Test Tax Category 2"):
           if not frappe.db.exists("Tax Category", tc):
               frappe.get_doc({"doctype": "Tax Category", "title": tc}).insert(
                   ignore_permissions=True, ignore_mandatory=True)
       for yr in range(2013, 2031):
           name = f"_Test Fiscal Year {yr}"
           if not frappe.db.exists("Fiscal Year", name):
               frappe.get_doc({
                   "doctype": "Fiscal Year", "year": name,
                   "year_start_date": f"{yr}-01-01", "year_end_date": f"{yr}-12-31",
               }).insert(ignore_permissions=True, ignore_mandatory=True)
       for email in ("test@example.com", "test1@example.com", "test2@example.com"):
           if not frappe.db.exists("User", email):
               frappe.get_doc({
                   "doctype": "User", "email": email, "first_name": email.split("@")[0],
                   "send_welcome_email": 0,
               }).insert(ignore_permissions=True, ignore_mandatory=True)

   # Fields made mandatory for THIS bench. A standard field promoted by a Property Setter must be
   # relaxed via the Property Setter; a genuine Custom Field via its own reqd. List both kinds here.
   def _relax_mandatory():
       # (doctype, fieldname) discovered in step 2 — extend as stragglers surface.
       blockers = [
           ("Company", "default_warehouse_for_sales_return"),
           ("Payment Term", "credit_days"),
           ("Lead", "custom_party_type"),
           ("Item", "part_number"),
       ]
       for dt, fn in blockers:
           ps = frappe.db.get_value("Property Setter",
               {"doc_type": dt, "field_name": fn, "property": "reqd"}, "name")
           if ps:
               frappe.db.set_value("Property Setter", ps, "value", "0")
               continue
           cf = frappe.db.get_value("Custom Field", {"dt": dt, "fieldname": fn}, "name")
           if cf:
               frappe.db.set_value("Custom Field", cf, "reqd", 0)
       frappe.clear_cache()  # so the relaxed meta is seen when masters auto-create
   ```
4. **Verify — one re-run, then the tail.** Re-run `node "${CLAUDE_PLUGIN_ROOT}/dist/testctl.cjs" run
   frappe --quiet`. Expect a big jump (the chain drains at once). If a *single* new master/field
   straggler appears, add it (a master to `_ensure_masters`, a field to the `blockers` list) and
   re-run. Stop when the error is no longer a bootstrap master/field blocker.
5. **Hand off.** Summarise masters created + fields relaxed (flag which were Property-Setter flips),
   leave everything uncommitted. If the next error is an outbound service (email / `wkhtmltopdf` PDF /
   HTTP `HostNotFoundError`), that's not bootstrap — point at `/testctl:mock-externals` (or
   `mute_emails` in site_config).

## Known-master catalog (starting set, not exhaustive)
- **Holiday List:** `_Test Holiday List` (2020-01-01 → 2050-12-31).
- **Tax Category:** `_Test Tax Category 1`, `_Test Tax Category 2`.
- **Fiscal Year:** one per year across ERPNext's test range (~2013–2030).
- **User:** `test@example.com`, `test1@example.com`, `test2@example.com`.
- `_Test Company` / `_Test Company 1`: prefer relaxing their mandatory fields over pre-creating
  (rollback caveat).
The classifier names any straggler not in this set — add it to the hook and re-run.

## What this is NOT
- Not a per-run auto-heal — it does not mutate the live site each run.
- Not for non-Frappe stacks.
- Not for the post-bootstrap outbound-service wall (email / PDF / HTTP) — that's `/testctl:mock-externals`.
- Not for dev-deps / encryption-key / missing-site blockers — the classifier names each with its own remedy.
