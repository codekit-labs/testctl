---
name: date-tz-guard
description: Generate tests that protect date/time correctness — no timezone off-by-one, DST transitions, month/year boundaries, duration/age math, and date round-trips — by discovering the project's OWN date/timezone handling. Works for any stack (Frappe getdate/now_datetime + System Settings tz, JS date-fns/dayjs, Flutter DateTime/intl). Use when the user runs /testctl:date-tz-guard, or says "test timezone handling", "date off-by-one", "DST bug", "test date math", or wants date/time logic protected from regressions.
---

# date-tz-guard

Date and timezone bugs are the most embarrassing kind — an invoice dated a day early, a report
missing the last day of the month, a DST jump breaking a schedule. This skill writes tests that pin
**date/time correctness**, derived from the project's *own* date/timezone handling — so it's
universal. Additive; leaves changes for review. Read `../generate-tests/stack-conventions.md` and the
`data-factory` master-reuse rule.

## Inputs

`/testctl:date-tz-guard [path-or-stack]`: a path/stack narrows scope; empty → discover apps that do
date/time work and confirm the list.

## Steps

1. **Discover the date/time setup.** Read how the project handles dates and zones:
   - **Frappe/ERPNext:** System Settings `time_zone`, `getdate`/`get_datetime`/`now_datetime`,
     fiscal-year boundaries, date vs datetime fields, how dates are stored (server tz) vs shown.
   - **JS (Next.js/Electron):** the date lib (date-fns/dayjs — avoid moment), UTC-vs-local handling,
     ISO parsing/formatting.
   - **Flutter:** `DateTime` (UTC vs local), `intl` formatting, `toUtc()/toLocal()`.

2. **Write date/time tests** (NEW files; reuse existing masters) for the classic failure modes:
   - **Round-trip** — a date stored then read back is the SAME calendar date (no tz shift moving it
     a day); a datetime preserves its instant.
   - **Off-by-one near midnight** — a value just before/after midnight in one tz doesn't land on the
     wrong day when converted; assert with an explicit tz, not the host's.
   - **DST transitions** — durations/schedules across a spring-forward / fall-back boundary compute
     the right elapsed time and wall-clock.
   - **Boundaries** — month-end (28/29/30/31), year-end, leap day (Feb 29), and fiscal-year edges
     are included/excluded correctly in ranges.
   - **Duration / age** — age, days-between, due-date offsets compute exactly (no rounding/tz drift).

3. **Run to green.** A real date bug (off-by-one, tz drift, DST miscalc) is REPORTED (skip with a
   clear reason) for `fix-failures` — never weaken a date assertion to force green.

4. **Frappe safety:** only run against a site with `allow_tests` enabled.

5. **Leave for review.** Do NOT commit. Report the cases covered, the tz/date config discovered, and
   any date bug surfaced. Tell the user to review `git diff` and commit.

## Rules

- Assert with explicit timezones/instants — never rely on the host machine's tz (that hides bugs).
- Derive the tz/date handling from the project's config; don't assume UTC or local.
- A real date/tz bug is reported, not patched here and never hidden by weakening the assertion.
- Reuse existing masters; never create heavyweight records. Verify green for the right reason. Never
  auto-commit.
