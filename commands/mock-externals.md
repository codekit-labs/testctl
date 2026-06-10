---
description: Stub outbound integrations (email/SMS/payment/webhooks/HTTP) in tests so the suite never hits real services — vital on restored prod data
argument-hint: "[path-or-stack]"
---

Isolate external services in tests using the mock-externals workflow.

1. Determine scope from `$ARGUMENTS`: a path/stack narrows it; empty → discover apps and confirm the
   list.

2. Discover apps: `node "${CLAUDE_PLUGIN_ROOT}/dist/testctl.cjs" run --quiet` and read
   `TESTCTL_JSON`. Follow the `mock-externals` skill: scan each app for outbound calls — email/SMS
   (`frappe.sendmail`, SMTP, SMS gateways), payment / e-invoice / tax-authority submitters, and
   third-party HTTP (`requests`/`fetch`/`http`/`dio`/webhooks).

3. Stub them at the test boundary (NEW test files/setup, never editing app code): patch/mock the
   sender and gateway clients (Frappe `unittest.mock.patch`; Next.js/Electron fetch/HTTP mock;
   Flutter `http.MockClient`). Assert the app tried to send the RIGHT thing to the mock — never that
   a real send happened.

4. Run to green and confirm no test reaches a real host (no real email/SMS/payment/HTTP). Anything
   still reaching out isn't mocked yet — fix the stub.

5. Frappe: only run against a site with `allow_tests` enabled — the mock is what makes even a
   restored-prod-data site safe to test.

6. Do NOT commit. Report the integrations stubbed and any still reaching out. Tell the user to review
   the `git diff` and commit.
