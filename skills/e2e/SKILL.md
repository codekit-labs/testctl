---
name: e2e
description: Generate end-to-end / user-journey tests that drive the real UI through complete business workflows (sign-up → core transaction → confirmation) — across Next.js/React/Vue and Electron (Playwright) and Flutter (integration_test). Anti-flaky by construction: role/text locators, auto-waiting (never sleeps), deterministic seeded data, mocked externals. Use when the user runs /testctl:e2e, or says "end-to-end test", "test the whole user journey", "test the sign-up/checkout flow", "Playwright test", "browser test", "integration_test", or wants a critical workflow protected end to end before production.
---

# e2e

Unit tests prove functions work; **only an end-to-end test proves the user can actually complete the
job** — sign up, do the core transaction, see the result. This skill generates E2E / user-journey
tests that drive the real UI across the stacks (web via Playwright, Electron via Playwright-Electron,
Flutter via `integration_test`). Naive E2E is the flakiest testing there is, so this skill is
anti-flaky by construction — and a flaky journey is hardened, never retried-around. Additive; leaves
changes for review. Read `../generate-tests/stack-conventions.md` for per-stack patterns, and reuse
the `mock-externals` skill (isolate the outside world) and `data-factory` skill (deterministic data).

## Inputs

`/testctl:e2e [path-or-stack] [journey description]`: a path/stack narrows scope; a plain-English
journey ("a user signs up, adds an item, checks out") names the flow. Empty → discover the critical
journeys (see Step 1) and confirm the list first.

## Steps

1. **Choose the critical journeys.** Derive the highest-value flows from (a) any plain-English journey
   the user gave, and (b) the app's own routes/screens — Next/React/Vue router config, Flutter routes,
   Electron windows. Default to the money/auth paths: authentication, the core business transaction
   (checkout / invoice / booking), and one critical read path. Confirm the list before generating.

2. **Generate the E2E spec per stack**, driving the UI end to end and asserting on user-visible
   outcomes (text/role/state) — never internal implementation. Place tests in the stack's E2E home
   (`e2e/` for web/Electron, `integration_test/` for Flutter); add the minimal harness config
   (e.g. `playwright.config.ts`) only if absent.
   - **Next.js / React / Vue:** Playwright (`@playwright/test`).
   - **Electron:** Playwright Electron (`_electron.launch`) driving the app window.
   - **Flutter:** `integration_test` + `flutter_test`.

3. **Build every test anti-flaky (mandatory):**
   - **Locate by role/label/text** — Playwright `getByRole`/`getByLabel`/`getByText`; Flutter
     `find.byKey`/`find.text`. NEVER nth-child, pixel coordinates, or auto-generated CSS classes.
   - **Auto-wait, never sleep** — Playwright web-first assertions (`await expect(x).toBeVisible()`);
     Flutter `await tester.pumpAndSettle()`. NEVER `waitForTimeout`/`Future.delayed` as a sync wait.
   - **Deterministic data** — seed exactly what the journey needs via the app's factory/test endpoints
     (reuse `data-factory`) and tear it down; never depend on pre-existing data or test order.
   - **Isolate the world** — stub outbound email/SMS/payment/webhooks/3rd-party HTTP (reuse
     `mock-externals`); a journey must not fire real-world side effects.
   - **Config-driven target** — base URL / app path from config/env, never a hardcoded port or
     machine path.

4. **Run to green** via the framework's native command (`npx playwright test`, `flutter test
   integration_test`). Print the exact command and a one-line note on wiring it into the CI workflow
   from `testctl init --ci`. If a journey fails because the app is genuinely broken, that is a REAL
   bug — report it (do not weaken the assertion, do not fix app code here) for `/testctl:fix-failures`.
   If a journey is flaky, HARDEN it (better locator/wait) — never add a retry or sleep to hide it.

5. **Safety:** NEVER run against production. Drive a local/dev/test target with mocked externals and
   disposable seeded data. Frappe-backed apps: only an `allow_tests` site.

6. **Leave for review.** Do NOT commit. Report the journeys covered, the run command, and any real bug
   surfaced. Tell the user to review `git diff` and commit.

## Rules

- Anti-flaky is non-negotiable: role/text locators (never nth/pixel), auto-wait (never fixed sleeps),
  deterministic seeded+torn-down data, mocked externals, config-driven base URL. A flaky journey is
  hardened, never retried- or slept-around.
- Assert user-visible outcomes (text/role/state), not internal implementation details.
- One web tool: Playwright for Next/React/Vue and Electron; `integration_test` for Flutter. Don't
  introduce Cypress/Selenium.
- Never run against production; reuse `mock-externals` so journeys can't fire real side effects.
- Additive only — new test files + minimal harness config; never modify app code. A real bug is
  reported (handed to `fix-failures`), never patched or asserted-around here. Never commit.
