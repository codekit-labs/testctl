---
description: Run Frappe/Flutter/Electron/Next.js/Supabase tests for this project and analyze failures
argument-hint: "[frappe|flutter|electron|nextjs|supabase]"
---

Run the testctl engine bundled with this plugin against the current project, then report and
analyze the results.

1. Decide the target from `$ARGUMENTS`: if it names a stack (`frappe`, `flutter`, `electron`,
   `nextjs`, or `supabase`), run only that one; otherwise run all detected stacks.

2. Run the bundled engine (it is dependency-free, no install needed):
   - All stacks:   `node "${CLAUDE_PLUGIN_ROOT}/dist/testctl.cjs" run`
   - Single stack: `node "${CLAUDE_PLUGIN_ROOT}/dist/testctl.cjs" run $ARGUMENTS`

3. Print the human-readable report table the engine produced.

4. Read the final `TESTCTL_JSON {...}` line. It has `results` and `failedLogs`
   (each with `stack`, `rawLogPath`, `error`).

5. For each entry in `failedLogs`, read its `rawLogPath` and explain, inline:
   **what broke**, the **likely root cause**, and a **concrete suggested fix**.

6. A stack reported "not present" was skipped, not failed — never treat it as an error. If a
   stack `errored` (tool missing, bad config, Supabase not running, Frappe `allow_tests`
   disabled), surface the exact remediation and continue with the others.

7. End with a one-line verdict: overall pass/fail and which stacks need attention. Never claim
   success unless the engine's exit code was 0.
