---
description: Generate anti-flaky end-to-end / user-journey tests that drive the real UI through complete workflows — Playwright (Next/React/Vue + Electron) and Flutter integration_test
argument-hint: "[path-or-stack] [journey description]"
---

Generate end-to-end / user-journey tests using the e2e workflow.

1. Determine scope from `$ARGUMENTS`: a path/stack narrows it; a plain-English journey names the flow;
   empty → discover the critical journeys (auth, the core transaction, a key read path, from the app's
   routes/screens) and confirm the list first.

2. Pick the tool per stack: Next.js/React/Vue + Electron → Playwright (`@playwright/test`;
   `_electron.launch` for Electron); Flutter → `integration_test` + `flutter_test`. Add the minimal
   harness config (e.g. `playwright.config.ts`) only if absent.

3. Follow the `e2e` skill: generate journeys that drive the UI end to end and assert user-visible
   outcomes. Anti-flaky is mandatory — role/text locators (`getByRole`/`find.text`, NEVER nth/pixel),
   auto-wait (web-first assertions / `pumpAndSettle`, NEVER `waitForTimeout`/`Future.delayed`),
   deterministic seeded+torn-down data (reuse `data-factory`) with **teardown registered in
   `afterEach`/`tearDown`/`finally` — never inline at the end of the happy path, or a mid-journey
   failure leaks seeded data and poisons later runs**, mocked externals (reuse `mock-externals`),
   config-driven base URL. Assert outcomes, not implementation.

4. Run to green via the native command (`npx playwright test`, `flutter test integration_test`); print
   the command + a note on wiring it into `testctl init --ci`. **Ensure the app is actually served
   before running (e.g. Playwright `webServer` config to auto-start it) and set `retries: 0` in the
   generated Playwright config so flakiness surfaces instead of being silently retried green.** A
   genuine app bug → report it for `/testctl:fix-failures` (never weaken the assertion). A flaky
   journey → harden it (better locator/wait), never add a retry/sleep.

5. NEVER run against production — use a local/dev/test target with mocked externals and disposable
   seeded data; Frappe-backed apps only on an `allow_tests` site. **Before running, confirm the
   resolved base URL/target is a local/dev/test host, not a production domain; if you cannot confirm
   it is non-production, STOP and ask. (`mock-externals` blocks outbound side effects but NOT writes
   to a real DB.)**

6. Do NOT commit. Report the journeys covered, the run command, and any real bug surfaced. Tell the
   user to review the `git diff` and commit.
