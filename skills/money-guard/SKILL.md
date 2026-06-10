---
name: money-guard
description: Generate tests that protect money math — correct rounding to each currency's precision, no floating-point drift, multi-currency conversion, and totals that reconcile — by discovering the project's OWN currency/precision setup. Works for any stack (ERPNext multi-currency, e-commerce/POS, billing). Use when the user runs /testctl:money-guard, or says "test the currency math", "rounding bugs", "totals don't add up", "multi-currency tests", "guard the money", or wants financial calculations protected from regressions.
---

# money-guard

Money math fails quietly — a half-cent rounding drift or a float error becomes a reconciliation
nightmare and a customer-trust problem. This skill writes tests that pin **financial correctness**,
derived from the project's *own* currency and precision configuration — so it's universal across
multi-currency ERP, e-commerce, and POS. Additive; leaves changes for review. Read
`../generate-tests/stack-conventions.md` and the `data-factory` master-reuse rule.

## Inputs

`/testctl:money-guard [path-or-stack]`: a path/stack narrows scope; empty → discover apps that handle
money/pricing and confirm the list.

## Steps

1. **Discover the money setup — don't assume two decimals.** Read the project's own currency and
   rounding configuration:
   - **Frappe/ERPNext:** company default currency, `currency` precision (number of fractional
     digits), multi-currency on transactions, exchange rates, and the rounding rule the code uses
     (`flt(x, precision)`, round-off accounts).
   - **Other stacks:** the money/pricing module, the per-currency precision table, and the rounding
     util.

2. **Write money tests** (NEW files; reuse existing masters, never create heavy records):
   - **Rounding to precision** — amounts round to the currency's configured digits (most 2, JPY 0,
     some 3) the way the code does it; assert exact expected values, not `closeTo`.
   - **No float drift** — the sum of line amounts equals the stored subtotal/total exactly (catch
     `0.1 + 0.2` style errors); large quantities × unit price don't accumulate error.
   - **Totals reconcile** — subtotal + tax + shipping − discount == grand total, to the cent.
   - **Multi-currency** — converting at the configured exchange rate yields the expected base-
     currency amount, rounded correctly; base and transaction totals stay consistent.
   - **Edge values** — zero, negative (where valid), very large amounts, and the smallest unit
     (1 cent) behave correctly.

3. **Run to green.** A real money bug (drift, wrong rounding, mis-conversion) is REPORTED (skip with
   a clear reason) for `fix-failures` — never weaken a money assertion to force green.

4. **Frappe safety:** only run against a site with `allow_tests` enabled.

5. **Leave for review.** Do NOT commit. Report the rules covered, the currency/precision discovered,
   and any money bug surfaced. Tell the user to review `git diff` and commit.

## Rules

- Assert exact expected amounts (to the currency's precision) — never fuzzy/`closeTo` for money.
- Derive precision/rounding/rates from the project's config; never assume 2 decimals or a fixed rate.
- A real money bug is reported, not patched here and never hidden by weakening the assertion.
- Reuse existing masters; never create heavyweight records. Verify green for the right reason. Never
  auto-commit.
