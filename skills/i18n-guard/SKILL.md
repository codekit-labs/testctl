---
name: i18n-guard
description: Generate tests that protect internationalization correctness — translation completeness / key parity, RTL directionality, and locale-aware display formatting — by discovering the project's OWN configured locales and asserting the invariants, so a code change can't silently break localization. Never hardcodes a language (Arabic / RTL is just the common instance). Across Flutter (intl/ARB), Frappe/ERPNext (translation csv/po), and Web (react-i18next / vue-i18n). Use when the user runs /testctl:i18n-guard, or says "test i18n", "RTL layout test", "Arabic layout", "missing translations", "translation completeness", "test localization", "dir=rtl", or wants localization protected from regressions.
---

# i18n-guard

Internationalization breaks silently: a new user-facing string lands **hardcoded** (never wrapped in
the i18n function) and shows English in an Arabic UI; a configured locale's translation file **drifts**
so a key is missing or empty and the user sees a raw key; a layout uses **physical** `left`/`right`
instead of **logical** start/end and visually breaks under `dir=rtl`. None of these fail an ordinary
unit test. This skill pins i18n correctness derived from the project's *own* configured locales — never
a hardcoded language, so it's universal (Arabic / RTL is just the common instance of the same
invariants). It writes a runnable test where the invariant is cleanly testable and **reports**
(file + line) where it can only be a static observation. It never auto-translates, never rewrites app
code, and never weakens an assertion to pass. Additive; leaves changes for review. Read
`../generate-tests/stack-conventions.md` for per-stack patterns and the `data-factory` master-reuse rule.

This protects the **localized display** — distinct from `money-guard` and `date-tz-guard`, which
protect the money/date *math*. Here the question is "does the user see the right format and the right
language for the active locale?", not "is the number correct?".

## Inputs

`/testctl:i18n-guard [path-or-stack]`: a path/stack narrows scope; empty → discover the apps that ship
more than one locale (translation files / configured languages) and confirm the list first.

## Steps

1. **Discover the configured locales — do NOT hardcode a language.** Read the project's own i18n setup
   and derive the locale set it actually ships:
   - **Flutter:** `.arb` files under `lib/l10n` (e.g. `app_en.arb`, `app_ar.arb`); `l10n.yaml` and the
     `supportedLocales` passed to `MaterialApp`.
   - **Frappe/ERPNext:** the configured languages (Language doctype / `frappe.get_all("Language")`) and
     the app's translation files (`<app>/locale/*.csv` or `*.po`).
   - **Web (React/Vue):** the locale **JSON** files (react-i18next resources / vue-i18n messages) and
     the i18n config's configured locale list.
   Pick a **base locale** (usually the source language) and confirm the locale list + the apps in
   scope before writing tests.

2. **Translation completeness / key parity** (the headline runnable invariant). In a NEW test file,
   load the base locale's key-set and each other configured locale's key-set and assert **parity**:
   no key present in the base is missing in another locale, and no value is empty. Flatten nested keys
   (dotted paths) before comparing. A missing or empty key fails the test (or is skipped with a clear
   reason for the user — never silently relaxed).
   - **Flutter:** compare the keys across the `.arb` files (ignore `@`-prefixed metadata entries).
   - **Frappe:** compare the source-string set across the translation `.csv`/`.po` files for the
     configured languages.
   - **Web:** compare the flattened key-set across the locale JSON files.
   Then **report** (static scan, file + line) user-facing strings that are **hardcoded** — not wrapped
   in the i18n function (`Text('literal')` not via the generated localizations in Flutter; a bare
   string not via `_()` / `frappe._` in Frappe py/js/html; literal JSX/template text not via `t()` in
   Web). Report these for the user; do not rewrite them.

3. **RTL directionality.** Where the stack supports it, write a **both-directions render test**: mount
   the component under RTL **and** under LTR and assert it builds with no overflow/clipping.
   - **Flutter:** pump under `Directionality(textDirection: TextDirection.rtl, child: …)` and again
     under `.ltr`; assert it builds (`expect(tester.takeException(), isNull)`). Prefer
     `EdgeInsetsDirectional` / `AlignmentDirectional` / `start`/`end` over physical `left`/`right`.
   - **Web:** render the component inside a `dir="rtl"` wrapper and a `dir="ltr"` wrapper; assert it
     renders. Prefer logical CSS (`margin-inline-start`, not `margin-left`).
   - **Frappe:** assert RTL-relevant fields (print-format / `language`) render under an RTL language.
   Then **report** physical `left`/`right` (`margin-left`, `EdgeInsets.only(left:)`, physical
   `Alignment` edges) found in an app that ships an RTL locale — a directionality risk, reported not
   rewritten.

4. **Locale-aware formatting (lightweight, only if the app formats for display).** If the app formats
   numbers/dates/currency for display (`intl` `NumberFormat`/`DateFormat`, `Intl.NumberFormat`, a
   vue-i18n `$n`/`$d`, or Frappe localized formatting), assert the **displayed** output matches the
   active locale's expectation for a representative value. Skip this family entirely if the app does no
   localized display formatting. (This is display, not math — `money-guard`/`date-tz-guard` own the math.)

5. **Run to green.** A real gap (missing/empty translation, hardcoded user-facing string, physical
   left/right in an RTL app) is **reported** for the user — never auto-translated, never rewritten in
   app code, and an assertion is never weakened to force green.

6. **Frappe safety:** only run against a site with `allow_tests` enabled.

7. **Leave for review.** Do NOT commit. Report the locales covered, the parity/RTL invariants asserted,
   and every gap surfaced (with file + line). Tell the user to review `git diff` and commit.

## Rules

- Discover the configured locales from the project's own files — **never hardcode a language**. Arabic
  / RTL is the common instance, not a constant.
- Report real gaps (missing/empty translations, hardcoded user-facing strings, physical left/right in
  an RTL app) **for the user** — never auto-translate, never rewrite app code, never invent a missing
  translation.
- Key parity is asserted strictly; never weaken/skip a parity assertion to force green. A real gap is
  reported (or skipped with a clear reason), never silently relaxed.
- RTL is checked by rendering under **both** directions (logical start/end, no overflow), not by a
  pixel/screenshot diff.
- Localized formatting protects the **display** for the active locale — distinct from
  `money-guard`/`date-tz-guard`, which protect the math. Add it only if the app formats for display.
- Reuse existing masters (Frappe); never create heavyweight records that trigger framework setup
  cascades.
- Additive only — new test files; never modify existing tests or app code.
- Frappe/ERPNext tests run only against an `allow_tests` site; never commit to the user's repos.
