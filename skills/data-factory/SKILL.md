---
name: data-factory
description: Generate reusable test-data builders/factories for an app so tests stop hand-rolling fixtures — and, for Frappe/ERPNext, REUSE existing masters instead of creating heavy ones that trigger setup crashes. Across Flutter, Electron, Next.js, Frappe, and Supabase. Use when the user runs /testctl:data-factory, or says "make test factories", "set up test fixtures", "stop repeating test setup", "build a test data helper", or struggles with fixture boilerplate.
---

# data-factory

Most test pain is fixture pain. This skill builds reusable **builders/factories** — small helpers
that construct valid domain objects with sane defaults and overridable fields — so each test asks
for `makeJob(...)` instead of repeating 30 lines of setup. Additive; leaves changes for review.
Read `../generate-tests/stack-conventions.md` for per-stack conventions.

## Inputs

`/testctl:data-factory [path-or-stack]`: a path/stack narrows scope; empty → discover apps and
confirm which to build factories for.

## Steps

1. **Map the domain.** Read the app's models / DocTypes / schema and the existing tests. Identify
   the core entities tests keep building by hand and their required fields + relationships.

2. **Write factories** in the stack's conventional test-support location (a NEW file, e.g.
   `test/support/factories.dart`, `test/factories.ts`, a Frappe test helper module). Each factory:
   - builds a valid object with sensible defaults, every field overridable via args;
   - composes (a `makeInvoice` can call `makeCustomer`); returns the built/saved object.

3. **Frappe — reuse masters, never create heavy ones.** Creating a `Company` (and similar) cascades
   into ERPNext setup that can crash on a real/restored site. Factories must **discover existing
   masters** (first available Company/Customer/Supplier/Item/Account via `frappe.get_all`/
   `frappe.db.get_value`) and only create the *light* target docs (e.g. the Job, the Invoice). Skip
   gracefully (return None / skipTest) when a required master is absent — never fabricate one that
   triggers fixture cascades. (This is the pattern that unblocked the JMS accounting tests.)

4. **Prove they work.** Add a tiny smoke test that calls each factory and asserts it returns a valid
   object, and (where you can) refactor one existing test to use a factory — to show the win and
   confirm nothing breaks. Run to green.

5. **Frappe safety:** only run against a site with `allow_tests` enabled.

6. **Leave for review.** Do NOT commit. Report the factories added, which masters they reuse, and
   any existing test you simplified. Tell the user to review `git diff` and commit.

## Rules

- Factories produce VALID defaults and allow per-field overrides — no test should need raw setup.
- Frappe/Supabase: reuse existing masters; never create heavyweight records (Company, full CoA) that
  trigger framework setup; skip cleanly when a prerequisite master is missing.
- Additive — never modify existing tests except to demonstrate one refactor (kept green).
- Verify the factories and the smoke test pass before claiming done. Never auto-commit.
