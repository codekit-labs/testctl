---
description: Generate tests protecting money math — rounding, no float drift, totals reconcile, multi-currency — from the project's own currency config
argument-hint: "[path-or-stack]"
---

Guard money math using the money-guard workflow.

1. Determine scope from `$ARGUMENTS`: a path/stack narrows it; empty → discover apps that handle
   money/pricing and confirm the list.

2. Discover apps: `node "${CLAUDE_PLUGIN_ROOT}/dist/testctl.cjs" run --quiet` and read
   `TESTCTL_JSON`. For each target, read the project's OWN currency setup — Frappe company currency
   + currency precision + multi-currency + exchange rates + the rounding rule (`flt(x, precision)`);
   or the other stack's money/precision/rounding module. Never assume two decimals or a fixed rate.

3. Follow the `money-guard` skill: write NEW tests (reusing existing masters) — rounding to the
   currency's precision (exact values, not closeTo), no float drift (line sums == stored totals
   exactly), totals reconcile (subtotal + tax + shipping − discount == grand total), multi-currency
   conversion at the configured rate, and edge values (zero/negative/large/smallest unit).

4. Run to green. A real money bug (drift, wrong rounding, mis-conversion) is reported (skip with a
   reason) for `/testctl:fix-failures`; never weaken a money assertion to force green.

5. Frappe: only run against a site with `allow_tests` enabled.

6. Do NOT commit. Report the rules covered, the currency/precision discovered, and any money bug
   found. Tell the user to review the `git diff` and commit.
