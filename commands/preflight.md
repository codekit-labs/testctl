---
description: Check a Frappe bench's test-readiness before running — dev requirements, allow_tests, encryption key, before_tests hook — with the exact fix for each gap.
argument-hint: ""
---

Run the Frappe test-readiness preflight.

1. Run `node "${CLAUDE_PLUGIN_ROOT}/dist/testctl.cjs" preflight` from the project root.
2. Read the checklist. For each ✗ (blocker), apply the suggested fix:
   - dev requirements → `bench setup requirements --dev`
   - allow_tests → `bench --site <site> set-config allow_tests true`
   - encryption_key → restore the original key in site_config.json
   - before_tests → run `/testctl:frappe-bootstrap`
3. A ⚠ is advisory (e.g. no before_tests hook yet) — fix only if the bootstrap actually needs it.
4. Re-run preflight until it reports "Ready to run tests", then `testctl run frappe`.
