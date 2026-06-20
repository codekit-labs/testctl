---
description: Generate tests protecting internationalization — translation completeness / key parity, RTL directionality, locale-aware display formatting — by discovering the project's own configured locales
argument-hint: "[path-or-stack]"
---

Guard internationalization correctness using the i18n-guard workflow.

1. Determine scope from `$ARGUMENTS`: a path/stack narrows it; empty → discover the apps that ship more
   than one locale (translation files / configured languages) and confirm the list.

2. Discover the configured locales — do NOT hardcode a language:
   `node "${CLAUDE_PLUGIN_ROOT}/dist/testctl.cjs" run --changed --quiet` (read `TESTCTL_JSON` to scope
   to changed apps), then read the i18n setup directly — Flutter `.arb` under `lib/l10n` + `l10n.yaml`;
   Frappe configured Languages + `<app>/locale/*.csv`/`*.po`; Web react-i18next / vue-i18n locale JSON.
   Pick a base locale; confirm the locale list.

3. Follow the `i18n-guard` skill. For each app in scope write NEW test files (reuse existing masters,
   never heavy creates):
   - **Translation completeness / key parity:** assert every configured locale covers the base locale's
     key-set with no missing or empty values (flatten nested keys first). REPORT hardcoded user-facing
     strings (not via the i18n function: `Text('literal')` / bare `_()`-less string / literal JSX/template
     text) with file + line — do not rewrite them.
   - **RTL directionality:** render the component under both `rtl` and `ltr` (Flutter `Directionality`,
     Web `dir="rtl"`/`dir="ltr"` wrapper) and assert it builds with no overflow. REPORT physical
     `left`/`right` (prefer logical start/end, `margin-inline-start`, `EdgeInsetsDirectional`).
   - **Locale-aware formatting (only if the app formats for display):** assert numbers/dates/currency
     DISPLAY per the active locale. This is display, not math (money-guard/date-tz-guard own the math).

4. Run to green. A real gap (missing/empty translation, hardcoded string, physical left/right in an RTL
   app) → REPORT it (skip with a reason) for the user; never auto-translate, never rewrite app code,
   never weaken an assertion to force green.

5. Frappe: only run against a site with `allow_tests` enabled.

6. Do NOT commit. Report the locales covered, the parity/RTL invariants asserted, and every gap
   surfaced (with file + line). Tell the user to review the `git diff` and commit.
