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
   - **Frappe:** see the **Frappe outbound recipe** below — it covers `frappe.sendmail`,
     background-job / workflow emails, PDF rendering (`attach_print`/`get_pdf`/wkhtmltopdf), and the
     integration clients, with both a session-level guard and per-test intent mocks.
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

## Frappe outbound recipe

Frappe sends from more places than a single test wraps — workflows, doc events, hooks, and the test
bootstrap can all fire email/PDF/HTTP. Cover both *what a test drives* and *what fires around it*.

**Surfaces to look for**
- **Email:** `frappe.sendmail`, Email Account sending, the Email Queue.
- **Async:** `frappe.enqueue(...)` and background jobs that send — notably
  `frappe/workflow/doctype/workflow_action/workflow_action.py:send_workflow_action_email`.
- **PDF:** `frappe.attach_print`, `frappe.utils.pdf.get_pdf`, `pdfkit`/wkhtmltopdf — the HTML it
  renders may fetch remote images/fonts, so a PDF render can hit the network.
- **Integrations:** payment gateways, ZATCA / e-invoice / tax-authority submitters, `requests`/HTTP to
  non-local hosts, webhooks.

**Layer 1 — session-level guard (for outbound a test does NOT drive: workflows, doc events, hooks).**
Use when an unrelated test trips email/PDF fired by framework code you don't call directly (this is the
classic `wkhtmltopdf … HostNotFoundError` from a workflow email):
- Mute mail: `bench --site <site> set-config mute_emails 1` for the test site, or set
  `frappe.flags.mute_emails = True` in a shared test base / `setUp`.
- Stub the PDF path so it never invokes wkhtmltopdf:
  ```python
  from unittest.mock import patch
  # in a shared TestCase.setUp (addCleanup to undo):
  p = patch("frappe.attach_print", return_value={"fname": "x.pdf", "fcontent": b""})
  p.start(); self.addCleanup(p.stop)
  # if get_pdf is called directly, also: patch("frappe.utils.pdf.get_pdf", return_value=b"")
  ```

**Layer 2 — per-test mock (for outbound the test DOES drive; assert intent, not delivery).**
```python
from unittest.mock import patch
with patch("frappe.sendmail") as m:
    submit_invoice(inv)            # the thing under test
    m.assert_called_once()
    assert m.call_args.kwargs["recipients"] == ["customer@example.com"]
# same shape for the payment / e-invoice client
```

**Worked example (the avientek wall).** After bootstrap cleared, a `Workflow Action` enqueued
`send_workflow_action_email` → `frappe.attach_print` → `get_pdf` → wkhtmltopdf, which failed offline
with `OSError: wkhtmltopdf reported an error … HostNotFoundError`. That is an *outbound* problem, not a
bootstrap one — fix it with Layer 1 (`mute_emails` + patch `attach_print`), so the workflow's email/PDF
path is inert during tests. (Bootstrap blockers are `/testctl:frappe-bootstrap`.)

## Rules

- No test may reach a real external service — email, SMS, payment, e-invoice, or arbitrary HTTP.
- Stub at the test boundary; never edit app integration code to "make it testable" here.
- Frappe: for outbound fired by code a test doesn't drive (workflows, doc events, hooks, bootstrap), a
  session-level guard (`mute_emails` + stubbing `attach_print`/`get_pdf`) is the right tool — it
  complements, not replaces, per-test intent assertions.
- Assert the intent (what would have been sent), not real delivery.
- Especially on restored production data: the mock is the safety net — verify nothing fires for real.
- Additive; never auto-commit.
