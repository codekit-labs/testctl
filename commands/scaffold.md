---
description: Zero-to-one test setup for an app with none — harness/config + a first passing test so `testctl run` works, then hand off to generate-tests
argument-hint: "[path-or-stack]"
---

Scaffold a testing harness using the scaffold workflow.

1. Determine scope from `$ARGUMENTS`: a path/stack narrows it; empty → discover apps with NO tests
   via `node "${CLAUDE_PLUGIN_ROOT}/dist/testctl.cjs" context` and confirm the list (if a harness
   already exists, suggest `/testctl:generate-tests` instead).

2. Follow the `scaffold` skill: set up the stack's harness (jest/vitest config + `test` script for
   Electron/Next.js; `flutter_test` + `test/` for Flutter; a `test_<name>.py` module + the
   allow_tests/unittest-xml-reporting note for Frappe; a `supabase/tests/` pgTAP dir) — additive,
   never overwriting, no heavy deps without saying so.

3. Add ONE passing smoke test so the harness is proven, then run
   `node "${CLAUDE_PLUGIN_ROOT}/dist/testctl.cjs" run [stack]` and confirm the app is now discovered
   green.

4. Hand off: point the user to `/testctl:generate-tests` (or `/testctl:test-this`) for real coverage.

5. Frappe: only run against an `allow_tests` site.

6. Do NOT commit. Report what was scaffolded and the green run; tell the user to review the
   `git diff` and commit.
