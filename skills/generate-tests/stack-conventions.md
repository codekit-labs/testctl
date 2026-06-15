# Stack Test Conventions

How to write good **smoke + unit-logic** tests for each stack. Smoke = "it builds / renders /
responds without throwing". Unit-logic = pure functions, formatters, validators, calculations,
providers/reducers. Avoid brittle full-UI assertions.

## Flutter
- **Location:** `test/`, files named `*_test.dart`. Add NEW files (e.g. `testctl_smoke_test.dart`); never edit existing ones.
- **Framework:** `package:flutter_test/flutter_test.dart`.
- **Smoke:** pump the root widget and assert it builds:
  ```dart
  testWidgets('app builds', (tester) async {
    await tester.pumpWidget(const MyApp());
    await tester.pump(const Duration(milliseconds: 100)); // NOT pumpAndSettle — it hangs on spinners/animations
    expect(find.byType(MaterialApp), findsOneWidget);
  });
  ```
- **Unit-logic:** import the pure function/model and assert outputs with `test(...)`.
- **Run:** `flutter test` (the app needs `flutter pub get` first).

## Electron
- **Location:** `test/` or alongside source as `*.test.js`.
- **Framework:** jest.
- **Smoke:** require the main/preload/util module and assert it loads and exports expected functions.
- **Unit-logic:** test pure helpers and IPC-handler logic (extract logic from `ipcMain.handle` callbacks where possible).
- **Run:** `npx jest`.

## Next.js
- **Location:** `__tests__/` or `*.test.ts`.
- **Framework:** detect from package.json — vitest (`vitest run`) if present, else jest.
- **Smoke:** render a component with @testing-library/react, or call a route handler / server action and assert it returns the expected shape/status.
- **Unit-logic:** test `lib/`/`utils/` pure functions and server actions.
- **Run:** `npx vitest run` or `npx jest`.
- Note: testctl's `nextjs` stack does live Vercel URL smoke-testing; these GENERATED tests are local jest/vitest tests run directly, not via the nextjs runner.

## Frappe
- **Location:** inside the app, `<app>/<module>/doctype/<doctype>/test_<doctype>.py` or `<app>/tests/test_*.py`.
- **Framework:** `frappe.tests.utils.FrappeTestCase` (Frappe v14+/v15) or `unittest.TestCase`.
- **Smoke:** create + validate a document, or call a whitelisted/controller method, asserting no exception.
- **Unit-logic:** test controller methods and util functions with `FrappeTestCase`.
- **Run:** `bench --site <site> run-tests --app <app>` — ONLY against a site with `allow_tests` enabled (a throwaway/test site). NEVER run against production data. If no safe test site is configured, GENERATE the tests but DO NOT run them; leave a note telling the user to run them on a test site.

## Supabase
- **Location:** `supabase/tests/*.sql`.
- **Framework:** pgTAP.
- **Smoke:** `SELECT has_table('public', 'your_table');` and `SELECT is(... )` that RLS is enabled.
- **Unit-logic:** `SELECT results_eq(...)` for SQL functions; assert constraints/policies.
- **Run:** `supabase test db` (needs `supabase start` / Docker running).

## Web (React / Vue) — Vitest or Jest

- **Runner:** detect from package.json — `vitest` (`npx vitest run`) or `jest` (`npx jest`). testctl's
  `web` stack runs whichever is present and parses the jest-shaped JSON.
- **React:** `@testing-library/react` — `render(<Cmp/>)`, query by role/text, assert on the DOM; fire
  events with `@testing-library/user-event`. Co-locate `Cmp.test.tsx`.
- **Vue:** `@vue/test-utils` — `mount(Cmp, { props })`, assert `wrapper.text()` / `wrapper.find(...)`,
  `await wrapper.trigger('click')`. Co-locate `Cmp.spec.ts`.
- **Pure logic:** test composables / hooks / store modules directly (no render) — fastest, most stable.
- **Network:** never hit real services — mock `fetch`/the client (see `/testctl:mock-externals`).
- Assert behaviour and rendered output, not implementation details.
