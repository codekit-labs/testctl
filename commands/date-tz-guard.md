---
description: Generate tests protecting date/time correctness — no tz off-by-one, DST, boundaries, duration math — from the project's own date config
argument-hint: "[path-or-stack]"
---

Guard date/time correctness using the date-tz-guard workflow.

1. Determine scope from `$ARGUMENTS`: a path/stack narrows it; empty → discover apps that do
   date/time work and confirm the list.

2. Discover apps: `node "${CLAUDE_PLUGIN_ROOT}/dist/testctl.cjs" run --quiet` and read
   `TESTCTL_JSON`. For each target, read the project's OWN date/timezone handling — Frappe System
   Settings `time_zone` + `getdate`/`now_datetime` + fiscal year; JS date-fns/dayjs + UTC/local;
   Flutter `DateTime`/`intl`. Don't assume UTC or local.

3. Follow the `date-tz-guard` skill: write NEW tests (reusing existing masters, asserting with
   explicit timezones) — round-trip (stored date reads back same), off-by-one near midnight, DST
   transitions, month/year/leap/fiscal boundaries, duration/age math.

4. Run to green. A real date bug (off-by-one, tz drift, DST miscalc) is reported (skip with a
   reason) for `/testctl:fix-failures`; never weaken a date assertion to force green.

5. Frappe: only run against a site with `allow_tests` enabled.

6. Do NOT commit. Report the cases covered, the tz/date config discovered, and any date bug found.
   Tell the user to review the `git diff` and commit.
