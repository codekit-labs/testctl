---
name: mock-externals
description: Make tests safe and deterministic by stubbing outbound integrations — email, SMS, payment, webhooks, and third-party HTTP — so the suite never hits the real world (critical when testing against restored production data). Across Flutter, Electron, Next.js, Frappe, and Supabase. Use when the user runs /testctl:mock-externals, or says "mock the API", "stop tests sending real emails", "stub the payment gateway", "tests are hitting prod services", or wants external calls isolated in tests.
---

# mock-externals

The most dangerous real-world test scenario: a **restored production copy still carries live email /
SMS / payment / webhook credentials**, so a test that creates an invoice or a user can send a real
message to a real customer or call a real payment API. This skill finds those outbound integrations
and **stubs them in tests** — making the suite offline, deterministic, and safe. Additive. Read
`../generate-tests/stack-conventions.md`.

## Inputs

`/testctl:mock-externals [path-or-stack]`: a path/stack narrows scope; empty → discover apps and
confirm the list.

## Steps

1. **Find the outbound calls.** Scan the app for integrations that reach the outside world:
   - **Email/SMS:** `frappe.sendmail`/`sendmail`, SMTP, SMS gateways, notification hooks.
   - **Payment / e-invoice / tax authority:** payment-gateway SDKs, ZATCA/Fatoorah or other
     e-invoice submitters, bank/clearing calls.
   - **HTTP / third-party:** `requests`/`fetch`/`http`/`axios`/`dio` to non-local hosts, webhooks.

2. **Stub them at the test boundary** using the stack's mechanism (NEW test files / setup, never
   overwriting app code):
   - **Frappe:** patch the sender/integration in the test (e.g. `monkeypatch`/`unittest.mock.patch`
     of `frappe.sendmail` and the gateway client), or assert it was *called* without it actually
     firing. For a restored site, also recommend disabling mail/SMS/payment in site config — but the
     test-level mock is the real guard.
   - **Next.js / Electron / Node:** mock `fetch`/the HTTP client (msw, jest mock, nock-style), or
     inject a fake client; never let a test reach a real URL.
   - **Flutter:** inject a fake client / `http.MockClient`; assert the request was built right
     without sending it.

3. **Assert behaviour, not delivery.** Tests should assert the app *tried* to send the right thing
   (recipient, amount, payload) to the mock — never that a real send happened.

4. **Run to green.** Confirm no test reaches a real host (no network, no real email/payment). If a
   test still hits the outside world, that integration isn't mocked yet — fix the stub.

5. **Frappe safety:** only run against a site with `allow_tests` enabled; mocking is what makes even
   a restored-prod-data site safe to test.

6. **Leave for review.** Do NOT commit. Report the integrations found and stubbed, and any that still
   reach out (so the user can finish them). Tell the user to review `git diff` and commit.

## Rules

- No test may reach a real external service — email, SMS, payment, e-invoice, or arbitrary HTTP.
- Stub at the test boundary; never edit app integration code to "make it testable" here.
- Assert the intent (what would have been sent), not real delivery.
- Especially on restored production data: the mock is the safety net — verify nothing fires for real.
- Additive; never auto-commit.
