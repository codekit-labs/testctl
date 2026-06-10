---
name: tax-guard
description: Generate tests that protect tax correctness on invoices — VAT / GST / sales-tax — by discovering the project's OWN tax configuration (rates, accounts, categories) and asserting the invariants, so a code change can't silently break tax compliance. Works for any country (KSA ZATCA, India GST, EU/UK VAT, US sales tax are just instances). Across Frappe/ERPNext and other billing stacks. Use when the user runs /testctl:tax-guard, or says "test the VAT", "guard tax compliance", "make sure invoices apply tax correctly", "GST/VAT tests", or wants tax logic protected from regressions.
---

# tax-guard

Tax bugs are the expensive kind — wrong VAT/GST means rejected e-invoices, penalties, and audit
exposure. This skill writes tests that pin **tax correctness on invoices**, derived from the
project's *own* tax configuration — never a hardcoded country rate — so it's universal: ZATCA (KSA,
15%), India GST, EU/UK VAT, US sales tax are all just instances of the same invariants. Additive;
leaves changes for review. Read `../generate-tests/stack-conventions.md` for per-stack patterns and
the `data-factory` skill's master-reuse rule.

## Inputs

`/testctl:tax-guard [path-or-stack]`: a path/stack narrows scope; empty → discover apps that handle
invoicing/billing and confirm the list.

## Steps

1. **Discover the tax setup — do NOT hardcode a rate.** Read the project's own tax configuration and
   the rate(s)/accounts/categories it actually uses:
   - **Frappe/ERPNext:** Sales/Purchase Taxes and Charges Templates, Item Tax Templates, Tax
     Categories, the configured tax accounts, and the company's tax ID field. Note which rates exist
     (standard / zero-rated / exempt) and how each is selected.
   - **Other stacks:** the tax/pricing module and its config (rate tables, tax-category logic,
     rounding rules).

2. **Write tests for the invariants** (using the discovered config values, not magic numbers) in
   NEW files, reusing existing masters (never creating heavy records — see `data-factory`):
   - **Tax line present + account set** — a taxable invoice has a tax line and a non-empty tax
     account (your "never skip the tax account/VAT line" rule, enforced).
   - **Amount correct** — tax amount == taxable base × the configured rate, rounded per the project's
     rounding rule (no drift).
   - **Totals add up** — grand total == net + tax.
   - **Rate by category** — standard-rated items get the standard rate; **zero-rated** get 0%;
     **exempt** get none — each asserted against the config, so a mis-categorised item fails.
   - **Tax ID present** — company/customer registration/tax number set where the config requires it.

3. **Optional, country-specific extras (only if that app is present):** if a compliance app is
   installed (e.g. a ZATCA / e-invoice module), add a thin check that its required fields / QR / XML
   are generated — kept separate so the core tax tests stay universal.

4. **Run to green.** If a test reveals a real compliance bug (wrong rate, missing account, bad
   total), do NOT patch app code here — report it (skip with a clear reason) for `fix-failures`.
   Never weaken a tax assertion to make it pass.

5. **Frappe safety:** only run against a site with `allow_tests` enabled.

6. **Leave for review.** Do NOT commit. Report the tax rules covered, the config values discovered,
   and any compliance bug surfaced. Tell the user to review `git diff` and commit.

## Rules

- Universal first — derive rates/accounts/categories from the project's config; never hardcode a
  country's number. Country-specific e-invoice checks are an optional add-on, gated on that app.
- Reuse existing masters; never create heavyweight records that trigger framework setup cascades.
- Additive only; never weaken/skip a tax assertion to force green. A real compliance bug is reported,
  not patched here.
- Verify the new tests pass for the right reason before claiming done. Never auto-commit.
