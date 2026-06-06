---
name: test-all
description: Run Frappe, Flutter, Electron, Next.js (Vercel) and/or Supabase tests for the current project and analyze any failures. Use when the user runs /testctl:test-all, or says any of "run all tests", "run the tests", "test this project", "test the app", "check my tests", "are my tests passing", or otherwise wants a unified test report across their stacks.
---

# test-all

Run the project's tests across whichever of Frappe / Flutter / Electron / Next.js / Supabase
are present, then explain any failures.

## Engine

This plugin bundles a dependency-free engine at the plugin root:

```
<plugin-root>/dist/testctl.cjs
```

Resolve it relative to THIS skill's base directory (shown above as
"Base directory for this skill: …/skills/test-all") — the engine is at `../../dist/testctl.cjs`
from there. Run it with `node`. No `npm install` is required.

## Steps

1. Determine the target. If the user passed a stack (`/test-all frappe`), set the target to
   that single stack (`frappe`, `flutter`, `electron`, `nextjs`, or `supabase`). Otherwise run
   all detected stacks.

2. Run the bundled engine from the project root (the directory you want tested), resolving the
   path from this skill's base directory:
   - All stacks:    `node "<skill-base>/../../dist/testctl.cjs" run`
   - Single stack:  `node "<skill-base>/../../dist/testctl.cjs" run <stack>`

3. Read the final `TESTCTL_JSON {...}` line of the output. It has `results` and `failedLogs`
   (each with `stack`, `rawLogPath`, `error`).

4. Present the human-readable report table the engine already printed.

5. For each entry in `failedLogs`, read its `rawLogPath` with the Read tool and provide,
   inline: **what broke**, the **likely root cause**, and a **concrete suggested fix**.

6. If a stack `errored` (tool not on PATH, bad config, Supabase not running, Frappe
   `allow_tests` disabled), surface the exact error and remediation, and continue with the
   others. A stack that is "not present" is skipped, not failed.

7. End with a one-line verdict: overall pass/fail and which stacks need attention. Never claim
   success unless the engine's exit code was 0.

## Configuration

Projects describe their stacks in a `testctl.yaml` at the project root (run
`node "<skill-base>/../../dist/testctl.cjs" init` to scaffold one). All stacks are optional;
absent ones are skipped.
