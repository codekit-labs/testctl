---
description: Generate tests protecting tax correctness on invoices (VAT/GST/sales-tax) from the project's own config — works for any country
argument-hint: "[path-or-stack]"
---

Guard tax compliance using the tax-guard workflow.

1. Determine scope from `$ARGUMENTS`: a path/stack narrows it; empty → discover apps that handle
   invoicing/billing and confirm the list.

2. Discover apps: `node "${CLAUDE_PLUGIN_ROOT}/dist/testctl.cjs" run --quiet` and read
   `TESTCTL_JSON`. For each target, read the project's OWN tax configuration — never hardcode a
   rate. For Frappe/ERPNext: Sales/Purchase Taxes & Charges Templates, Item Tax Templates, Tax
   Categories, tax accounts, company tax ID. For other stacks: the tax/pricing module + its config.

3. Follow the `tax-guard` skill: write NEW tests (reusing existing masters, never creating heavy
   records) for the invariants — tax line present + account set, tax amount == base × configured
   rate (rounded), grand total == net + tax, rate-by-category (standard/zero-rated/exempt), and
   tax-ID present where required. Add country-specific e-invoice/QR/XML checks only if that
   compliance app is installed, kept separate from the core tests.

4. Run to green. A real compliance bug → report it (skip with a reason) for `/testctl:fix-failures`;
   never weaken a tax assertion to force green.

5. Frappe: only run against a site with `allow_tests` enabled.

6. Do NOT commit. Report the tax rules covered, the config values discovered, and any compliance bug
   surfaced. Tell the user to review the `git diff` and commit.
